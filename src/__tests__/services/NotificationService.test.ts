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

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockTelegramNotifier: jest.Mocked<TelegramNotifier>;
  let mockUserService: jest.Mocked<UserService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // モックインスタンスの取得
    mockTelegramNotifier = (TelegramNotifier as jest.MockedClass<typeof TelegramNotifier>).mock.instances[0] as jest.Mocked<TelegramNotifier>;
    mockUserService = (UserService as jest.MockedClass<typeof UserService>).mock.instances[0] as jest.Mocked<UserService>;
    
    notificationService = new NotificationService('test-bot-token');
  });

  describe('sendNewPropertyNotification', () => {
    it('新着物件通知を送信できること', async () => {
      // 実際のメソッドに基づくテストデータ
      const userUrl = Object.assign(Object.create(UserUrl.prototype), {
        id: 'test-url-id',
        name: 'テストURL',
        url: 'https://example.com',
        prefecture: '東京都',
        isActive: true,
        isMonitoring: true,
        userId: 'test-user-id',
        user: {} as User,
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

      // 実際のAPIに基づくモック設定
      mockTelegramNotifier.sendMessage.mockResolvedValue(undefined);

      await notificationService.sendNewPropertyNotification(userUrl, detectionResult);

      // 実際のAPI呼び出しを確認
      expect(mockTelegramNotifier.sendMessage).toHaveBeenCalledWith(
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
          totalChecks: 0,
          newListingsCount: 0,
          errorCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      mockUserService.getUserUrls.mockResolvedValue(urls);
      mockUserService.getUserById.mockResolvedValue(user);
      mockTelegramNotifier.sendMessage.mockResolvedValue(undefined);

      await notificationService.sendUserStatisticsReport(userId);

      expect(mockUserService.getUserUrls).toHaveBeenCalledWith(userId);
      expect(mockUserService.getUserById).toHaveBeenCalledWith(userId);
      expect(mockTelegramNotifier.sendMessage).toHaveBeenCalled();
    });
  });
});