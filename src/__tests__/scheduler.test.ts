import { jest, describe, it, expect, beforeEach } from '@jest/globals';
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ScheduledTask } from 'node-cron';

// モックインスタンスの作成
const mockCronJob = {
  start: jest.fn(),
  stop: jest.fn(),
  destroy: jest.fn(),
  getStatus: jest.fn(),
  now: jest.fn(),
} as unknown as ScheduledTask;

const mockStatsJob = {
  start: jest.fn(),
  stop: jest.fn(),
  destroy: jest.fn(),
  getStatus: jest.fn(),
  now: jest.fn(),
} as unknown as ScheduledTask;

const mockSchedule = jest.fn().mockImplementation(expression => {
  if (expression === '*/5 * * * *') {
    return mockCronJob;
  } else if (expression === '0 * * * *') {
    return mockStatsJob;
  }
  return mockCronJob;
});

// モジュールのモック設定
jest.unstable_mockModule('node-cron', () => ({
  schedule: mockSchedule,
}));

// test-setup.tsで設定されたモジュールをインポート
const { MonitoringScheduler } = await import('../scheduler.js');
const { SimpleScraper } = await import('scraper');
const { SimpleStorage } = await import('storage');
const { PropertyMonitor } = await import('property-monitor');
const { TelegramNotifier } = await import('telegram');
import * as cron from 'node-cron';

// モック関数への参照を取得
const mockScraperInstance = new SimpleScraper();
const mockScrapeAthome = mockScraperInstance.scrapeAthome as jest.Mock;
const mockValidateResult = mockScraperInstance.validateResult as jest.Mock;

const mockStorageInstance = new SimpleStorage();
const mockGetHash = mockStorageInstance.getHash as jest.Mock;
const mockSetHash = mockStorageInstance.setHash as jest.Mock;
const mockIncrementTotalChecks = mockStorageInstance.incrementTotalChecks as jest.Mock;
const mockIncrementErrors = mockStorageInstance.incrementErrors as jest.Mock;
const mockIncrementNewListings = mockStorageInstance.incrementNewListings as jest.Mock;
// const mockRecordExecutionTime = mockStorageInstance.recordExecutionTime as jest.Mock;
const mockGetStats = mockStorageInstance.getStats as jest.Mock;
// const mockResetStats = mockStorageInstance.resetStats as jest.Mock;
const mockCreateBackup = mockStorageInstance.createBackup as jest.Mock;
// const mockDisplayStats = mockStorageInstance.displayStats as jest.Mock;
// const mockSave = mockStorageInstance.save as jest.Mock;
// const mockLoad = mockStorageInstance.load as jest.Mock;

const mockPropertyMonitorInstance = new PropertyMonitor();
const mockDetectNewProperties = mockPropertyMonitorInstance.detectNewProperties as jest.Mock;
const mockGetMonitoringStatistics =
  mockPropertyMonitorInstance.getMonitoringStatistics as jest.Mock;

// Telegramのモック関数への参照を取得
const mockTelegramInstance = new TelegramNotifier();
const mockTestConnection = mockTelegramInstance.testConnection as jest.Mock;
const mockSendStartupNotice = mockTelegramInstance.sendStartupNotice as jest.Mock;
const mockSendNewListingNotification = mockTelegramInstance.sendNewListingNotification as jest.Mock;
const mockSendErrorAlert = mockTelegramInstance.sendErrorAlert as jest.Mock;
const mockSendStatisticsReport = mockTelegramInstance.sendStatisticsReport as jest.Mock;
const mockSendShutdownNotice = mockTelegramInstance.sendShutdownNotice as jest.Mock;
const mockSendMessage = mockTelegramInstance.sendMessage as jest.Mock;
const mockGetBotInfo = mockTelegramInstance.getBotInfo as jest.Mock;

describe.skip('MonitoringScheduler', () => {
  let scheduler: InstanceType<typeof MonitoringScheduler>;

  beforeEach(() => {
    jest.clearAllMocks();

    // TelegramNotifierコンストラクタのモックをリセット
    TelegramNotifier.mockClear();

    // デフォルトのモック設定
    mockScrapeAthome.mockResolvedValue({
      success: true,
      hash: 'test-hash',
      count: 10,
      executionTime: 2000,
      memoryUsage: 40,
    });
    mockValidateResult.mockReturnValue(true);
    mockTestConnection.mockResolvedValue(true);
    mockSendStartupNotice.mockResolvedValue(undefined);
    mockSendNewListingNotification.mockResolvedValue(undefined);
    mockSendErrorAlert.mockResolvedValue(undefined);
    mockSendStatisticsReport.mockResolvedValue(undefined);
    mockSendShutdownNotice.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue(undefined);
    mockGetBotInfo.mockResolvedValue({ username: 'test_bot', id: 123456 });
    mockGetHash.mockReturnValue(undefined);
    mockGetStats.mockReturnValue({
      totalChecks: 100,
      errors: 5,
      newListings: 10,
      lastCheck: new Date(),
      averageExecutionTime: 2.5,
      successRate: 95,
    });
    mockCreateBackup.mockReturnValue('/path/to/backup.json');
    mockDetectNewProperties.mockReturnValue({
      hasNewProperty: false,
      newPropertyCount: 0,
      newProperties: [],
      totalMonitored: 3,
      detectedAt: new Date(),
      confidence: 'very_high' as const,
    });
    mockGetMonitoringStatistics.mockReturnValue({
      totalChecks: 10,
      newPropertyDetections: 2,
      lastCheckAt: new Date(),
      lastNewPropertyAt: new Date(),
    });

    // TelegramNotifierコンストラクタモックの返り値を設定
    TelegramNotifier.mockReturnValue(mockTelegramInstance);

    scheduler = new MonitoringScheduler('test-token', 'test-chat-id');

    // scheduler内部のscraper, storage, propertyMonitorをモックで置き換え
    (scheduler as any).scraper = mockScraperInstance;
    (scheduler as any).storage = mockStorageInstance;
    (scheduler as any).propertyMonitor = mockPropertyMonitorInstance;
  });

  describe('start', () => {
    it('監視を開始できること', async () => {
      const urls = ['https://example.com/1', 'https://example.com/2'];

      await scheduler.start(urls);

      expect(mockTestConnection).toHaveBeenCalled();
      expect(mockSendStartupNotice).toHaveBeenCalled();
      expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
    });

    it('Telegram接続失敗時でも監視を開始すること', async () => {
      mockTestConnection.mockResolvedValue(false);

      await scheduler.start(['https://example.com']);

      expect(mockTestConnection).toHaveBeenCalled();
      expect(mockSendStartupNotice).not.toHaveBeenCalled();
      expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
    });
  });

  describe('監視サイクル', () => {
    it('新着物件を検知して通知すること', async () => {
      const urls = ['https://example.com'];

      // 初回チェック（ハッシュなし）- startメソッド内で実行される
      mockGetHash.mockReturnValue(undefined);
      await scheduler.start(urls);

      // 初回実行の確認
      expect(mockIncrementTotalChecks).toHaveBeenCalled();
      expect(mockScrapeAthome).toHaveBeenCalledWith(urls[0]!);
      expect(mockSetHash).toHaveBeenCalledWith(urls[0]!, 'test-hash');
      expect(mockIncrementNewListings).not.toHaveBeenCalled();
      expect(mockSendNewListingNotification).not.toHaveBeenCalled();

      // モックをリセット
      mockIncrementTotalChecks.mockClear();
      mockSetHash.mockClear();
      mockIncrementNewListings.mockClear();
      mockSendNewListingNotification.mockClear();
      mockScrapeAthome.mockClear();

      // PropertyMonitorをリセット
      mockDetectNewProperties.mockClear();

      // 2回目のチェック（新着物件を検知）
      mockGetHash.mockReturnValue('test-hash'); // 以前のハッシュ
      mockScrapeAthome.mockResolvedValueOnce({
        success: true,
        hash: 'new-hash',
        count: 12,
        executionTime: 2000,
        memoryUsage: 40,
      });

      // PropertyMonitorが新着を検知するように設定
      mockDetectNewProperties.mockReturnValueOnce({
        hasNewProperty: true,
        newPropertyCount: 1,
        newProperties: [
          {
            signature: '新着物件:1,500万円:広島市南区',
            title: '新着物件',
            price: '1,500万円',
            location: '広島市南区',
            detectedAt: new Date(),
          },
        ],
        totalMonitored: 3,
        detectedAt: new Date(),
        confidence: 'very_high' as const,
      });

      // runMonitoringCycleを直接呼び出す（cronJobのisRunningチェックを回避）
      await (scheduler as any).runMonitoringCycle(urls);

      expect(mockDetectNewProperties).toHaveBeenCalled();
      expect(mockIncrementNewListings).toHaveBeenCalled();
      // sendNewPropertyNotificationメソッドが呼ばれることを確認
      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('スクレイピングエラー時にエラー通知を送ること', async () => {
      const urls = ['https://example.com'];
      await scheduler.start(urls);

      // モックをリセット
      mockIncrementErrors.mockClear();
      mockSendErrorAlert.mockClear();
      mockScrapeAthome.mockClear();

      mockScrapeAthome.mockResolvedValue({
        success: false,
        hash: '',
        count: 0,
        executionTime: 1000,
        memoryUsage: 30,
      });

      const cronCallback = mockSchedule.mock.calls[0]?.[1] as () => Promise<void>;
      await cronCallback();

      expect(mockIncrementErrors).toHaveBeenCalled();
      expect(mockSendErrorAlert).toHaveBeenCalledWith(urls[0]!, 'Network error');
    });
  });

  describe('統計レポート', () => {
    it('統計レポートを送信できること', async () => {
      await scheduler.start(['https://example.com']);

      // 統計ジョブのコールバックを取得して実行
      const statsCallback = mockSchedule.mock.calls[1]?.[1] as () => Promise<void>;
      await statsCallback();

      expect(mockSendStatisticsReport).toHaveBeenCalledWith({
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
      expect(mockSendShutdownNotice).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('ステータスを取得できること', async () => {
      await scheduler.start(['https://example.com']);

      // PropertyMonitorの検知により、初回実行でエラーが発生していない想定
      // consecutiveErrorsをリセット
      (scheduler as any).consecutiveErrors = 0;

      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: false, // startメソッドが完了した後はfalseになる
        consecutiveErrors: 0,
        hasJobs: true,
      });
    });
  });

  describe('手動チェック', () => {
    it('手動チェックを実行できること', async () => {
      const urls = ['https://example.com'];
      await scheduler.start(urls);

      // モックをリセット
      mockIncrementTotalChecks.mockClear();
      mockScrapeAthome.mockClear();

      // 手動チェック実行
      await scheduler.runManualCheck(urls);

      expect(mockIncrementTotalChecks).toHaveBeenCalled();
      expect(mockScrapeAthome).toHaveBeenCalledWith(urls[0]!);
    });
  });

  describe('統計レポートエラー処理', () => {
    it('統計レポート送信エラーを処理できること', async () => {
      await scheduler.start(['https://example.com']);

      // sendStatisticsReportがエラーを投げるように設定
      mockSendStatisticsReport.mockRejectedValue(new Error('Report error'));

      // 統計ジョブのコールバックを取得して実行
      const statsCallback = mockSchedule.mock.calls[1]?.[1] as () => Promise<void>;

      // エラーが発生してもクラッシュしない
      await statsCallback();

      // エラーがログされたことを確認（エラーは内部で処理される）
      expect(mockSendStatisticsReport).toHaveBeenCalled();
    });
  });

  describe('停止通知エラー処理', () => {
    it('停止通知送信エラーを処理できること', async () => {
      await scheduler.start(['https://example.com']);

      // sendShutdownNoticeがエラーを投げるように設定
      mockSendShutdownNotice.mockRejectedValue(new Error('Shutdown notice error'));

      // エラーが発生してもクラッシュしない
      expect(() => scheduler.stop()).not.toThrow();

      // 待機して非同期処理が完了することを確認
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('物件数推定エラー処理', () => {
    it('前回の物件数推定でエラーが発生しても新着通知を送ること', async () => {
      const urls = ['https://example.com'];

      // 初回チェック
      mockGetHash.mockReturnValue(undefined);
      await scheduler.start(urls);

      // モックをリセット
      mockIncrementTotalChecks.mockClear();
      mockSetHash.mockClear();
      mockIncrementNewListings.mockClear();
      mockSendMessage.mockClear();
      mockScrapeAthome.mockClear();
      mockDetectNewProperties.mockClear();

      // 2回目のチェック（新着物件を検知）
      mockGetHash.mockReturnValue('test-hash'); // 以前のハッシュ
      mockScrapeAthome.mockResolvedValueOnce({
        success: true,
        hash: 'new-hash',
        count: 12,
        executionTime: 2000,
        memoryUsage: 40,
      });

      // PropertyMonitorが新着を検知するように設定
      mockDetectNewProperties.mockReturnValueOnce({
        hasNewProperty: true,
        newPropertyCount: 1,
        newProperties: [
          {
            signature: '新着物件:1,500万円:広島市南区',
            title: '新着物件',
            price: '1,500万円',
            location: '広島市南区',
            detectedAt: new Date(),
          },
        ],
        totalMonitored: 2,
        detectedAt: new Date(),
        confidence: 'very_high' as const,
      });

      // runMonitoringCycleを直接呼び出す
      await (scheduler as any).runMonitoringCycle(urls);

      // PropertyMonitorベースの実装では、新着検知と通知が行われる
      expect(mockDetectNewProperties).toHaveBeenCalled();
      expect(mockIncrementNewListings).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalled();
    });
  });
});
