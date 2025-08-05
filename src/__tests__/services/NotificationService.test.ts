import { jest } from '@jest/globals';
import { NotificationService } from '../../services/NotificationService.js';
import { TelegramNotifier } from '../../telegram.js';
import { UserService } from '../../services/UserService.js';
import { User } from '../../entities/User.js';
import { UserUrl } from '../../entities/UserUrl.js';
import type { NewPropertyDetectionResult } from '../../types.js';

// 実際のAPIに基づくモック設定
jest.mock('../../telegram.js');
jest.mock('../../services/UserService.js');
jest.mock('../../logger.js');

const mockedTelegramNotifier = jest.mocked(TelegramNotifier);
const mockedUserService = jest.mocked(UserService);

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService('test-bot-token');
  });

  describe('sendNewPropertyNotification', () => {
    it('新着物件通知を送信できること', async () => {
      // 実際のメソッドに基づくテストデータ
      const user = Object.create(User.prototype);
      Object.assign(user, {
        id: 'test-user-id',
        telegramChatId: 'test-chat-id',
        telegramUsername: 'testuser',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
        urls: [],
      });

      const userUrl = Object.create(UserUrl.prototype);
      Object.assign(userUrl, {
        id: 'test-url-id',
        name: 'テストURL',
        url: 'https://example.com',
        prefecture: '東京都',
        isActive: true,
        isMonitoring: true,
        userId: 'test-user-id',
        user: user,
        totalChecks: 0,
        newListingsCount: 0,
        errorCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const detectionResult: NewPropertyDetectionResult = {
        hasNewProperty: true,
        newPropertyCount: 1,
        newProperties: [
          {
            signature: 'prop-1',
            title: 'テスト物件',
            price: '10万円',
            location: '東京都渋谷区',
            detectedAt: new Date(),
          }
        ],
        totalMonitored: 10,
        detectedAt: new Date(),
        confidence: 'high',
      };

      // モックインスタンスの設定
      const mockTelegramInstance = {
        sendMessage: jest.fn().mockResolvedValue(undefined),
      };
      mockedTelegramNotifier.mockImplementation(() => mockTelegramInstance as any);

      await notificationService.sendNewPropertyNotification(userUrl, detectionResult);

      // TelegramNotifierのコンストラクタ呼び出しを確認
      expect(mockedTelegramNotifier).toHaveBeenCalledWith('test-bot-token', 'test-chat-id');
      
      // sendMessageメソッドの呼び出しを確認
      expect(mockTelegramInstance.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('新着物件')
      );
    });
  });

  describe('sendUserStatisticsReport', () => {
    it('ユーザー統計レポートを送信できること', async () => {
      const userId = 'test-user-id';
      
      const user = Object.create(User.prototype);
      Object.assign(user, {
        id: userId,
        telegramChatId: 'test-chat-id',
        telegramUsername: 'testuser',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
        urls: [],
      });

      const urls: UserUrl[] = [
        Object.assign(Object.create(UserUrl.prototype), {
          id: 'url1',
          name: 'テストURL1',
          url: 'https://example.com/1',
          prefecture: '東京都',
          isActive: true,
          isMonitoring: true,
          userId: userId,
          user: user,
          totalChecks: 100,
          newListingsCount: 5,
          errorCount: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      // モックインスタンスの設定
      const mockUserServiceInstance = {
        getUserUrls: jest.fn().mockResolvedValue(urls),
        getUserById: jest.fn().mockResolvedValue(user),
      };
      mockedUserService.mockImplementation(() => mockUserServiceInstance as any);

      const mockTelegramInstance = {
        sendMessage: jest.fn().mockResolvedValue(undefined),
      };
      mockedTelegramNotifier.mockImplementation(() => mockTelegramInstance as any);

      await notificationService.sendUserStatisticsReport(userId);

      expect(mockUserServiceInstance.getUserUrls).toHaveBeenCalledWith(userId);
      expect(mockUserServiceInstance.getUserById).toHaveBeenCalledWith(userId);
      expect(mockedTelegramNotifier).toHaveBeenCalledWith('test-bot-token', 'test-chat-id');
      expect(mockTelegramInstance.sendMessage).toHaveBeenCalled();
    });

    it('ユーザーが見つからない場合は何もしないこと', async () => {
      const mockUserServiceInstance = {
        getUserUrls: jest.fn().mockResolvedValue([]),
        getUserById: jest.fn().mockResolvedValue(null),
      };
      mockedUserService.mockImplementation(() => mockUserServiceInstance as any);

      await notificationService.sendUserStatisticsReport('test-user-id');

      expect(mockUserServiceInstance.getUserUrls).toHaveBeenCalledWith('test-user-id');
      expect(mockUserServiceInstance.getUserById).toHaveBeenCalledWith('test-user-id');
      expect(mockedTelegramNotifier).not.toHaveBeenCalled();
    });

    it('URLがない場合は何もしないこと', async () => {
      const user = Object.create(User.prototype);
      Object.assign(user, {
        id: 'test-user-id',
        telegramChatId: 'test-chat-id',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
        urls: [],
      });

      const mockUserServiceInstance = {
        getUserUrls: jest.fn().mockResolvedValue([]),
        getUserById: jest.fn().mockResolvedValue(user),
      };
      mockedUserService.mockImplementation(() => mockUserServiceInstance as any);

      await notificationService.sendUserStatisticsReport('test-user-id');

      expect(mockUserServiceInstance.getUserUrls).toHaveBeenCalledWith('test-user-id');
      expect(mockUserServiceInstance.getUserById).toHaveBeenCalledWith('test-user-id');
      expect(mockedTelegramNotifier).not.toHaveBeenCalled();
    });
  });
});