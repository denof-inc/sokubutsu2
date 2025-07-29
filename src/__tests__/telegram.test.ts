import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TelegramNotifier } from '../telegram.js';
import { Telegraf } from 'telegraf';
import { NotificationData, Statistics } from '../types.js';

// Telegram API レスポンス型定義
interface TelegramMessage {
  message_id: number;
  date: number;
  chat: {
    id: number;
    type: string;
  };
  text: string;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

// Telegrafのモック型定義
type MockTelegramApi = {
  getMe: jest.Mock;
  sendMessage: jest.Mock;
};

type MockTelegrafInstance = {
  telegram: MockTelegramApi;
};

// Telegrafのモック
jest.mock('telegraf');
const MockedTelegraf = Telegraf as jest.MockedClass<typeof Telegraf>;

describe('TelegramNotifier', () => {
  let notifier: TelegramNotifier;
  let mockBot: MockTelegrafInstance;
  let mockTelegram: MockTelegramApi;

  beforeEach(() => {
    jest.clearAllMocks();

    // Telegramモックの設定
    const mockGetMeResponse: TelegramUser = {
      id: 123456789,
      is_bot: true,
      first_name: 'Test Bot',
      username: 'test_bot',
    };

    const mockSendMessageResponse: TelegramMessage = {
      message_id: 1,
      date: Date.now(),
      chat: { id: -123456789, type: 'group' },
      text: 'Test message',
    };

    mockTelegram = {
      getMe: jest.fn(() => Promise.resolve(mockGetMeResponse)),
      sendMessage: jest.fn(() => Promise.resolve(mockSendMessageResponse)),
    };

    mockBot = {
      telegram: mockTelegram,
    };

    MockedTelegraf.mockImplementation(() => mockBot as any);

    notifier = new TelegramNotifier('test-token', 'test-chat-id');
  });

  describe('testConnection', () => {
    it('接続成功時にtrueを返すこと', async () => {
      const result = await notifier.testConnection();

      expect(result).toBe(true);
      expect(mockTelegram.getMe).toHaveBeenCalled();
    });

    it('接続失敗時にfalseを返すこと', async () => {
      (mockTelegram.getMe).mockRejectedValue(new Error('Connection failed'));

      const result = await notifier.testConnection();

      expect(result).toBe(false);
      expect(mockTelegram.getMe).toHaveBeenCalled();
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

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('新着物件検知！'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          link_preview_options: {
            is_disabled: true,
          },
        })
      );

      const sentMessage = (mockTelegram.sendMessage).mock.calls[0]?.[1] as string;
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

      const sentMessage = (mockTelegram.sendMessage).mock.calls[0]?.[1] as string;
      expect(sentMessage).toContain('2件減少');
    });
  });

  describe('sendErrorAlert', () => {
    it('エラーアラートを正しく送信すること', async () => {
      const url = 'https://example.com/error';
      const error = 'Network timeout';

      await notifier.sendErrorAlert(url, error);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('監視エラー発生'),
        expect.any(Object)
      );

      const sentMessage = (mockTelegram.sendMessage).mock.calls[0]?.[1] as string;
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

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('ソクブツ統計レポート'),
        expect.any(Object)
      );

      const sentMessage = (mockTelegram.sendMessage).mock.calls[0]?.[1] as string;
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

      const sentMessage = (mockTelegram.sendMessage).mock.calls[0]?.[1] as string;
      expect(sentMessage).toContain('エラー率が高めです');
    });
  });

  describe('リトライ機能', () => {
    it('送信失敗時にリトライすること', async () => {
      const mockResponse: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: -123456789, type: 'group' },
        text: 'Test message',
      };

      (mockTelegram.sendMessage)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(mockResponse);

      await notifier.sendStartupNotice();

      expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(3);
    });

    it('最大リトライ回数を超えたらエラーを投げること', async () => {
      (mockTelegram.sendMessage).mockRejectedValue(new Error('Permanent error'));

      await expect(notifier.sendStartupNotice()).rejects.toThrow('Permanent error');
      expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(4); // 初回 + 3回リトライ
    });
  });

  describe('getBotInfo', () => {
    it('Bot情報を正しく取得すること', async () => {
      const botInfo = await notifier.getBotInfo();

      expect(botInfo).toEqual({
        username: 'test_bot',
        id: 123456789,
      });
      expect(mockTelegram.getMe).toHaveBeenCalled();
    });

    it('usernameがない場合にunknownを返すこと', async () => {
      const mockUserWithoutUsername: TelegramUser = {
        id: 123456789,
        is_bot: true,
        first_name: 'Test Bot',
      };

      (mockTelegram.getMe).mockResolvedValue(mockUserWithoutUsername);

      const botInfo = await notifier.getBotInfo();

      expect(botInfo.username).toBe('unknown');
    });
  });
});
