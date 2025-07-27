/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { MonitoringScheduler } from '../scheduler';
import { SimpleScraper } from '../scraper';
import { TelegramNotifier } from '../telegram';
import { SimpleStorage } from '../storage';
import * as cron from 'node-cron';

// モックの作成
jest.mock('../scraper');
jest.mock('../telegram');
jest.mock('../storage');
jest.mock('node-cron');

const MockedScraper = SimpleScraper as jest.MockedClass<typeof SimpleScraper>;
const MockedTelegramNotifier = TelegramNotifier as jest.MockedClass<typeof TelegramNotifier>;
const MockedStorage = SimpleStorage as jest.MockedClass<typeof SimpleStorage>;

describe('MonitoringScheduler', () => {
  let scheduler: MonitoringScheduler;
  let mockScraper: jest.Mocked<SimpleScraper>;
  let mockTelegram: jest.Mocked<TelegramNotifier>;
  let mockStorage: jest.Mocked<SimpleStorage>;
  let mockCronJob: jest.Mocked<cron.ScheduledTask>;
  let mockStatsJob: jest.Mocked<cron.ScheduledTask>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Cronジョブのモック
    mockCronJob = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
      getStatus: jest.fn(),
      now: jest.fn(),
    } as any;

    mockStatsJob = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
      getStatus: jest.fn(),
      now: jest.fn(),
    } as any;

    // cron.scheduleのモック
    (cron.schedule as jest.Mock).mockImplementation(expression => {
      if (expression === '*/5 * * * *') {
        return mockCronJob;
      } else if (expression === '0 * * * *') {
        return mockStatsJob;
      }
      return mockCronJob;
    });

    // 各モックインスタンスの設定
    mockScraper = {
      scrapeAthome: jest.fn().mockResolvedValue({
        success: true,
        hash: 'test-hash',
        count: 10,
        executionTime: 2000,
        memoryUsage: 40,
      }),
      validateResult: jest.fn().mockReturnValue(true),
    } as any;

    mockTelegram = {
      testConnection: jest.fn().mockResolvedValue(true),
      sendStartupNotice: jest.fn().mockResolvedValue(undefined),
      sendNewListingNotification: jest.fn().mockResolvedValue(undefined),
      sendErrorAlert: jest.fn().mockResolvedValue(undefined),
      sendStatisticsReport: jest.fn().mockResolvedValue(undefined),
      sendShutdownNotice: jest.fn().mockResolvedValue(undefined),
      getBotInfo: jest.fn().mockResolvedValue({ username: 'test_bot', id: 123456 }),
    } as any;

    mockStorage = {
      getHash: jest.fn().mockReturnValue(undefined),
      setHash: jest.fn(),
      incrementTotalChecks: jest.fn(),
      incrementErrors: jest.fn(),
      incrementNewListings: jest.fn(),
      recordExecutionTime: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        totalChecks: 100,
        errors: 5,
        newListings: 10,
        lastCheck: new Date(),
        averageExecutionTime: 2.5,
        successRate: 95,
      }),
      resetStats: jest.fn(),
      createBackup: jest.fn().mockReturnValue('/path/to/backup.json'),
      displayStats: jest.fn(),
    } as any;

    MockedScraper.mockImplementation(() => mockScraper);
    MockedTelegramNotifier.mockImplementation(() => mockTelegram);
    MockedStorage.mockImplementation(() => mockStorage);

    scheduler = new MonitoringScheduler('test-token', 'test-chat-id');
  });

  describe('start', () => {
    it('監視を開始できること', async () => {
      const urls = ['https://example.com/1', 'https://example.com/2'];

      await scheduler.start(urls);

      expect(mockTelegram.testConnection).toHaveBeenCalled();
      expect(mockTelegram.sendStartupNotice).toHaveBeenCalled();
      expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
    });

    it('Telegram接続失敗時はエラーを投げること', async () => {
      mockTelegram.testConnection.mockResolvedValue(false);

      await expect(scheduler.start(['https://example.com'])).rejects.toThrow(
        'Telegram接続に失敗しました。環境変数を確認してください。'
      );
    });
  });

  describe('監視サイクル', () => {
    it('新着物件を検知して通知すること', async () => {
      const urls = ['https://example.com'];
      await scheduler.start(urls);

      // 初回チェック（ハッシュなし）
      mockStorage.getHash.mockReturnValue(undefined);

      // cronジョブのコールバックを取得して実行
      const cronCallback = (cron.schedule as jest.Mock).mock.calls[0][1];
      await cronCallback();

      expect(mockStorage.incrementTotalChecks).toHaveBeenCalled();
      expect(mockScraper.scrapeAthome).toHaveBeenCalledWith(urls[0]);
      expect(mockStorage.setHash).toHaveBeenCalledWith(urls[0], 'test-hash');

      // 初回は新着通知しない
      expect(mockStorage.incrementNewListings).not.toHaveBeenCalled();
      expect(mockTelegram.sendNewListingNotification).not.toHaveBeenCalled();

      // モックをリセット
      mockStorage.incrementTotalChecks.mockClear();
      mockStorage.setHash.mockClear();
      mockStorage.incrementNewListings.mockClear();
      mockTelegram.sendNewListingNotification.mockClear();
      mockScraper.scrapeAthome.mockClear();

      // 2回目のチェック（ハッシュが変更）
      mockStorage.getHash.mockReturnValue('test-hash'); // 以前のハッシュ
      mockScraper.scrapeAthome
        .mockResolvedValueOnce({
          success: true,
          hash: 'new-hash',
          count: 12,
          executionTime: 2000,
          memoryUsage: 40,
        })
        .mockResolvedValueOnce({
          // estimatePreviousCount内のscrapeAthome呼び出し用
          success: true,
          hash: 'new-hash',
          count: 12,
          executionTime: 2000,
          memoryUsage: 40,
        });

      await cronCallback();

      expect(mockStorage.incrementNewListings).toHaveBeenCalled();
      expect(mockTelegram.sendNewListingNotification).toHaveBeenCalled();
    });

    it('スクレイピングエラー時にエラー通知を送ること', async () => {
      const urls = ['https://example.com'];
      await scheduler.start(urls);

      mockScraper.scrapeAthome.mockResolvedValue({
        success: false,
        hash: '',
        count: 0,
        error: 'Network error',
        executionTime: 1000,
        memoryUsage: 30,
      });

      const cronCallback = (cron.schedule as jest.Mock).mock.calls[0][1];
      await cronCallback();

      expect(mockStorage.incrementErrors).toHaveBeenCalled();
      expect(mockTelegram.sendErrorAlert).toHaveBeenCalledWith(urls[0], 'Network error');
    });
  });

  describe('統計レポート', () => {
    it('統計レポートを送信できること', async () => {
      await scheduler.start(['https://example.com']);

      // 統計ジョブのコールバックを取得して実行
      const statsCallback = (cron.schedule as jest.Mock).mock.calls[1][1];
      await statsCallback();

      expect(mockTelegram.sendStatisticsReport).toHaveBeenCalledWith({
        totalChecks: 100,
        errors: 5,
        newListings: 10,
        lastCheck: expect.any(Date),
        averageExecutionTime: 2.5,
        successRate: 95,
      });
    });
  });

  describe('stop', () => {
    it('監視を停止できること', async () => {
      await scheduler.start(['https://example.com']);

      scheduler.stop();

      expect(mockCronJob.stop).toHaveBeenCalled();
      expect(mockStatsJob.stop).toHaveBeenCalled();
      expect(mockTelegram.sendShutdownNotice).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('ステータスを取得できること', async () => {
      await scheduler.start(['https://example.com']);

      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: false, // startメソッドが完了した後はfalseになる
        consecutiveErrors: 0,
        hasJobs: true,
      });
    });
  });
});
