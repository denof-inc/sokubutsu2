import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NotificationData, Statistics } from '../types.js';

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

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('新着物件検知！'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          link_preview_options: {
            is_disabled: true,
          },
        })
      );

      const sentMessage = mockSendMessage.mock.calls[0]?.[1] as string;
      expect(sentMessage).toContain('+5件増加');
      expect(sentMessage).toContain('15件');
      expect(sentMessage).toContain('10件');
      expect(sentMessage).toContain('3.5秒');
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

      const sentMessage = mockSendMessage.mock.calls[0]?.[1] as string;
      expect(sentMessage).toContain('2件減少');
    });
  });

  describe('sendErrorAlert', () => {
    it('エラーアラートを正しく送信すること', async () => {
      const url = 'https://example.com/error';
      const error = 'Network timeout';

      await notifier.sendErrorAlert(url, error);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('監視エラー発生'),
        expect.any(Object)
      );

      const sentMessage = mockSendMessage.mock.calls[0]?.[1] as string;
      expect(sentMessage).toContain('example.com/error');
      expect(sentMessage).toContain(error);
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

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('ソクブツ統計レポート'),
        expect.any(Object)
      );

      const sentMessage = mockSendMessage.mock.calls[0]?.[1] as string;
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

      const sentMessage = mockSendMessage.mock.calls[0]?.[1] as string;
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

    it('最大リトライ回数を超えたらエラーを投げること', async () => {
      mockSendMessage.mockRejectedValue(new Error('Permanent error'));

      await expect(notifier.sendStartupNotice()).rejects.toThrow('Permanent error');
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
