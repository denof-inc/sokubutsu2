import { jest } from '@jest/globals';
import { NotificationService } from '../../services/NotificationService.js';
import { TelegramNotifier } from '../../telegram.js';
import { User } from '../../entities/User.js';
import { UserUrl } from '../../entities/UserUrl.js';
import type { NewPropertyDetectionResult } from '../../types.js';

// 型安全なモック設定
const mockTelegramNotifier = {
  sendMessage: jest.fn<(message: string) => Promise<void>>(),
  sendNewListingNotification: jest.fn<(properties: any[], count: number) => Promise<void>>(),
  sendErrorAlert: jest.fn<(error: Error, context: string) => Promise<void>>(),
  sendStatisticsReport: jest.fn<(stats: any) => Promise<void>>(),
  testConnection: jest.fn<() => Promise<boolean>>(),
  getBotInfo: jest.fn<() => Promise<{ username: string }>>(),
  sendStartupNotice: jest.fn<() => Promise<void>>(),
  sendShutdownNotice: jest.fn<() => Promise<void>>(),
};

// UserServiceのモック
const mockUserService = {
  getUserUrls: jest.fn<(userId: string) => Promise<UserUrl[]>>(),
  getUserById: jest.fn<(userId: string) => Promise<User | null>>(),
};

// TelegramNotifierクラスのモック
jest.mock('../../telegram.js', () => ({
  TelegramNotifier: jest.fn().mockImplementation(() => mockTelegramNotifier),
}));

// UserServiceのモック
jest.mock('../../services/UserService.js', () => ({
  UserService: jest.fn().mockImplementation(() => mockUserService),
}));

// loggerのモック
jest.mock('../../logger.js', () => ({
  vibeLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService('test-bot-token');
  });

  describe('sendNewPropertyNotification', () => {
    it('新着物件通知を送信できること', async () => {
      // 型安全なテストデータ
      const user: User = Object.create(User.prototype);
      Object.assign(user, {
        id: 'test-user-id',
        telegramChatId: 'test-chat-id',
        telegramUsername: 'testuser',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
        urls: [],
        canAddUrl: () => true,
        getUrlsByPrefecture: () => [],
        canAddUrlInPrefecture: () => true,
      });

      const userUrl: UserUrl = Object.create(UserUrl.prototype);
      Object.assign(userUrl, {
        id: 'test-url-id',
        name: 'テスト物件',
        url: 'https://example.com',
        prefecture: '東京都',
        isActive: true,
        isMonitoring: true,
        userId: user.id,
        user: user,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalChecks: 0,
        newListingsCount: 0,
        errorCount: 0,
      });

      const detectionResult: NewPropertyDetectionResult = {
        hasNewProperty: true,
        newPropertyCount: 2,
        newProperties: [
          {
            signature: 'prop-1',
            title: '新築マンション',
            price: '3,000万円',
            location: '東京都渋谷区',
            detectedAt: new Date(),
          },
          {
            signature: 'prop-2',
            title: '中古戸建て',
            price: '4,500万円',
            location: '東京都世田谷区',
            detectedAt: new Date(),
          },
        ],
        totalMonitored: 10,
        detectedAt: new Date(),
        confidence: 'high',
      };

      mockTelegramNotifier.sendMessage.mockResolvedValue(undefined);

      await notificationService.sendNewPropertyNotification(userUrl, detectionResult);

      expect(TelegramNotifier).toHaveBeenCalledWith('test-bot-token', 'test-chat-id');
      expect(mockTelegramNotifier.sendMessage).toHaveBeenCalled();

      const sentMessage = mockTelegramNotifier.sendMessage.mock.calls[0]?.[0];
      expect(sentMessage).toContain('新着物件発見');
      expect(sentMessage).toContain('テスト物件');
      expect(sentMessage).toContain('2件');
      expect(sentMessage).toContain('新築マンション');
      expect(sentMessage).toContain('3,000万円');
    });
  });

  describe('sendUserStatisticsReport', () => {
    it('ユーザー統計レポートを送信できること', async () => {
      const user: User = Object.create(User.prototype);
      Object.assign(user, {
        id: 'test-user-id',
        telegramChatId: 'test-chat-id',
        telegramUsername: 'testuser',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
        urls: [],
      });

      const urls: UserUrl[] = [
        Object.assign(Object.create(UserUrl.prototype), {
          id: 'url-1',
          name: '物件1',
          url: 'https://example.com/1',
          prefecture: '東京都',
          userId: user.id,
          isActive: true,
          isMonitoring: true,
          totalChecks: 100,
          newListingsCount: 5,
          errorCount: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        Object.assign(Object.create(UserUrl.prototype), {
          id: 'url-2',
          name: '物件2',
          url: 'https://example.com/2',
          prefecture: '神奈川県',
          userId: user.id,
          isActive: true,
          isMonitoring: false,
          totalChecks: 50,
          newListingsCount: 3,
          errorCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      mockUserService.getUserUrls.mockResolvedValue(urls);
      mockUserService.getUserById.mockResolvedValue(user);
      mockTelegramNotifier.sendMessage.mockResolvedValue(undefined);

      await notificationService.sendUserStatisticsReport('test-user-id');

      expect(mockUserService.getUserUrls).toHaveBeenCalledWith('test-user-id');
      expect(mockUserService.getUserById).toHaveBeenCalledWith('test-user-id');
      expect(TelegramNotifier).toHaveBeenCalledWith('test-bot-token', 'test-chat-id');
      expect(mockTelegramNotifier.sendMessage).toHaveBeenCalled();

      const sentMessage = mockTelegramNotifier.sendMessage.mock.calls[0]?.[0];
      expect(sentMessage).toContain('監視統計レポート');
      expect(sentMessage).toContain('150回'); // 総チェック数
      expect(sentMessage).toContain('8回'); // 新着検知数
      expect(sentMessage).toContain('物件1');
      expect(sentMessage).toContain('物件2');
    });

    it('ユーザーが見つからない場合は何もしないこと', async () => {
      mockUserService.getUserUrls.mockResolvedValue([]);
      mockUserService.getUserById.mockResolvedValue(null);

      await notificationService.sendUserStatisticsReport('test-user-id');

      expect(TelegramNotifier).not.toHaveBeenCalled();
      expect(mockTelegramNotifier.sendMessage).not.toHaveBeenCalled();
    });

    it('URLがない場合は何もしないこと', async () => {
      const user: User = Object.create(User.prototype);
      Object.assign(user, {
        id: 'test-user-id',
        telegramChatId: 'test-chat-id',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
        urls: [],
      });

      mockUserService.getUserUrls.mockResolvedValue([]);
      mockUserService.getUserById.mockResolvedValue(user);

      await notificationService.sendUserStatisticsReport('test-user-id');

      expect(TelegramNotifier).not.toHaveBeenCalled();
      expect(mockTelegramNotifier.sendMessage).not.toHaveBeenCalled();
    });
  });
});
