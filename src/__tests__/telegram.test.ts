import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NotificationData, Statistics, UrlStatistics } from '../types.js';

// モック関数を作成
const mockGetMe = jest.fn<() => Promise<any>>();
const mockSendMessage = jest.fn<() => Promise<any>>();

const mockTelegraf = jest.fn(() => ({
  telegram: {
    getMe: mockGetMe,
    sendMessage: mockSendMessage,
  },
}));

// Telegrafのモック
jest.unstable_mockModule('telegraf', () => ({
  Telegraf: mockTelegraf,
}));

// モックの後でインポート
const { TelegramNotifier } = await import('../telegram.js');

describe('TelegramNotifier', () => {
  let notifier: InstanceType<typeof TelegramNotifier>;

  beforeEach(() => {
    jest.clearAllMocks();

    // デフォルトのモック設定
    mockGetMe.mockResolvedValue({
      id: 123456789,
      is_bot: true,
      first_name: 'Test Bot',
      username: 'test_bot',
    });

    mockSendMessage.mockResolvedValue({
      message_id: 1,
      date: Date.now(),
      chat: { id: -123456789, type: 'group' },
      text: 'Test message',
    });

    notifier = new TelegramNotifier('test-token', 'test-chat-id');
  });

  describe('testConnection', () => {
    it('接続成功時にtrueを返すこと', async () => {
      const result = await notifier.testConnection();

      expect(result).toBe(true);
      expect(mockGetMe).toHaveBeenCalled();
    });

    it('接続失敗時にfalseを返すこと', async () => {
      mockGetMe.mockRejectedValue(new Error('Connection failed'));

      const result = await notifier.testConnection();

      expect(result).toBe(false);
      expect(mockGetMe).toHaveBeenCalled();
    });
  });

  describe('sendNewListingNotification', () => {
    it('新着物件通知を正しく送信すること', async () => {
      const notificationData: NotificationData = {
        currentCount: 15,
        previousCount: 10,
        detectedAt: new Date('2024-01-01T10:00:00'),
        url: 'https://example.com',
        executionTime: 3.5,
      };

      await notifier.sendNewListingNotification(notificationData);

      expect(mockSendMessage).toHaveBeenCalled();
      const calls = mockSendMessage.mock.calls as unknown as Array<[string, string, any]>;
      expect(calls[0]?.[0]).toBe('test-chat-id');
      expect(calls[0]?.[1]).toContain('新着物件あり');

      const sentMessage = calls[0]?.[1] ?? '';
      expect(sentMessage).not.toContain('+5件'); // 件数は削除されたので含まれない
      expect(sentMessage).toContain('https://example.com');
    });

    it('物件数減少時も正しく通知すること', async () => {
      const notificationData: NotificationData = {
        currentCount: 8,
        previousCount: 10,
        detectedAt: new Date(),
        url: 'https://example.com',
        executionTime: 2.0,
      };

      await notifier.sendNewListingNotification(notificationData);

      const calls = mockSendMessage.mock.calls as unknown as Array<[string, string, any]>;
      const sentMessage = calls[0]?.[1] ?? '';
      expect(sentMessage).not.toContain('2件減少'); // 件数は削除されたので含まれない
    });
  });

  describe('sendErrorAlert', () => {
    it('エラーアラートを正しく送信すること', async () => {
      const url = 'https://example.com/error';
      const error = 'Network timeout';

      await notifier.sendErrorAlert(url, error);

      expect(mockSendMessage).toHaveBeenCalled();
      const calls = mockSendMessage.mock.calls as unknown as Array<[string, string, any]>;
      expect(calls[0]?.[0]).toBe('test-chat-id');
      expect(calls[0]?.[1]).toContain('監視エラーのお知らせ');

      const sentMessage = calls[0]?.[1] ?? '';
      expect(sentMessage).toContain('エリア物件'); // 監視名が含まれる
      expect(sentMessage).toContain('3回連続（15分間）'); // エラー数の表示
      expect(sentMessage).toContain('サイトの応答が遅くなっています'); // ユーザーフレンドリーなエラーメッセージ
    });
  });

  describe('sendUrlSummaryReport', () => {
    it('1時間サマリーレポートを正しく送信すること', async () => {
      const stats: UrlStatistics = {
        url: 'https://www.athome.co.jp/chintai/tokyo/list/',
        totalChecks: 12,
        successCount: 10,
        errorCount: 2,
        successRate: 83.3,
        averageExecutionTime: 3.5,
        hasNewProperty: false,
        newPropertyCount: 0,
        lastNewProperty: null,
        hourlyHistory: [
          { time: '10:00', status: 'なし' },
          { time: '10:05', status: 'なし' },
          { time: '10:10', status: 'あり' },
          { time: '10:15', status: 'エラー' },
          { time: '10:20', status: 'なし' },
        ]
      };

      await notifier.sendUrlSummaryReport(stats);

      expect(mockSendMessage).toHaveBeenCalled();
      const calls = mockSendMessage.mock.calls as unknown as Array<[string, string, any]>;
      const sentMessage = calls[0]?.[1] ?? '';
      
      expect(sentMessage).toContain('1時間サマリー');
      expect(sentMessage).toContain('tokyo');
      expect(sentMessage).toContain('5分ごとの結果');
      expect(sentMessage).toContain('10:00 ✅ なし');
      expect(sentMessage).toContain('10:10 🆕 あり');
      expect(sentMessage).toContain('10:15 ❌ エラー');
      expect(sentMessage).toContain('成功率: 83.3%');
    });
  });

  describe('sendStatisticsReport', () => {
    it('統計レポートを正しく送信すること', async () => {
      const stats: Statistics = {
        totalChecks: 100,
        errors: 5,
        newListings: 10,
        lastCheck: new Date('2024-01-01T10:00:00'),
        averageExecutionTime: 2.5,
        successRate: 95,
      };

      await notifier.sendStatisticsReport(stats);

      expect(mockSendMessage).toHaveBeenCalled();
      const calls = mockSendMessage.mock.calls as unknown as Array<[string, string, any]>;
      expect(calls[0]?.[0]).toBe('test-chat-id');
      expect(calls[0]?.[1]).toContain('ソクブツ統計レポート');

      const sentMessage = calls[0]?.[1] ?? '';
      expect(sentMessage).toContain('100回');
      expect(sentMessage).toContain('95%');
      expect(sentMessage).toContain('2.50秒');
      expect(sentMessage).toContain('10回');
      expect(sentMessage).toContain('5回');
    });

    it('成功率が低い場合に警告メッセージを含むこと', async () => {
      const stats: Statistics = {
        totalChecks: 100,
        errors: 10,
        newListings: 5,
        lastCheck: new Date(),
        averageExecutionTime: 3.0,
        successRate: 90,
      };

      await notifier.sendStatisticsReport(stats);

      const calls = mockSendMessage.mock.calls as unknown as Array<[string, string, any]>;
      const sentMessage = calls[0]?.[1] ?? '';
      expect(sentMessage).toContain('エラー率が高めです');
    });
  });

  describe('リトライ機能', () => {
    it('送信失敗時にリトライすること', async () => {
      mockSendMessage
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue({
          message_id: 1,
          date: Date.now(),
          chat: { id: -123456789, type: 'group' },
          text: 'Test message',
        });

      await notifier.sendStartupNotice();

      expect(mockSendMessage).toHaveBeenCalledTimes(3);
    });

    it('最大リトライ回数を超えてもエラーを投げずに終了すること', async () => {
      mockSendMessage.mockRejectedValue(new Error('Permanent error'));

      // エラーを投げずに正常終了することを確認
      await expect(notifier.sendStartupNotice()).resolves.toBeUndefined();
      expect(mockSendMessage).toHaveBeenCalledTimes(4); // 初回 + 3回リトライ
    });
  });

  describe('getBotInfo', () => {
    it('Bot情報を正しく取得すること', async () => {
      const botInfo = await notifier.getBotInfo();

      expect(botInfo).toEqual({
        username: 'test_bot',
        id: 123456789,
      });
      expect(mockGetMe).toHaveBeenCalled();
    });

    it('usernameがない場合にunknownを返すこと', async () => {
      mockGetMe.mockResolvedValue({
        id: 123456789,
        is_bot: true,
        first_name: 'Test Bot',
        username: undefined,
      });

      const botInfo = await notifier.getBotInfo();

      expect(botInfo.username).toBe('unknown');
    });
  });
});
