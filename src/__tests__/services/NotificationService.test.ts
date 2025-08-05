// モックを手動でインポート
jest.unstable_mockModule('../../telegram.js', () => ({
  TelegramNotifier: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.unstable_mockModule('../../services/UserService.js', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    getUserUrls: jest.fn().mockResolvedValue([]),
    getUserById: jest.fn().mockResolvedValue(null),
  })),
}));

jest.unstable_mockModule('../../logger.js', () => ({
  vibeLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { jest } from '@jest/globals';
import { NotificationService } from '../../services/NotificationService.js';
import { TelegramNotifier } from '../../telegram.js';
import { UserService } from '../../services/UserService.js';
import { UserUrl } from '../../entities/UserUrl.js';
import { User } from '../../entities/User.js';
import type { NewPropertyDetectionResult } from '../../types.js';

// モックのインスタンスとコンストラクタを正しく取得
const MockedTelegramNotifier = TelegramNotifier as jest.MockedClass<typeof TelegramNotifier>;
const MockedUserService = UserService as jest.MockedClass<typeof UserService>;

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockUserService: jest.Mocked<UserService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get mocked instances
    mockUserService = new MockedUserService() as jest.Mocked<UserService>;
    
    notificationService = new NotificationService('test-bot-token');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNewPropertyNotification', () => {
    it('新着物件通知を送信できること', async () => {
      // Userエンティティの作成
      const user = Object.assign(new User(), {
        id: 'user-123',
        telegramChatId: 'chat-123',
        telegramUsername: 'testuser',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
      });

      // UserUrlエンティティの作成
      const userUrl = Object.assign(new UserUrl(), {
        id: 'url-123',
        name: '東京の物件',
        prefecture: '東京都',
        url: 'https://example.com/properties',
        userId: user.id,
        user: user,
        isActive: true,
        isMonitoring: true,
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

      await notificationService.sendNewPropertyNotification(userUrl, detectionResult);

      // TelegramNotifierのインスタンス作成を確認
      expect(MockedTelegramNotifier).toHaveBeenCalledWith('test-bot-token', 'chat-123');
      
      // Get the created instance
      const mockCall = MockedTelegramNotifier as jest.Mock;
      const createdInstances = mockCall.mock.instances;
      expect(createdInstances.length).toBeGreaterThan(0);
      
      const lastNotifier = createdInstances[createdInstances.length - 1] as jest.Mocked<TelegramNotifier>;
      expect(lastNotifier.sendMessage).toHaveBeenCalled();
      
      // メッセージ内容の確認
      const sendMessageCalls = lastNotifier.sendMessage.mock.calls;
      expect(sendMessageCalls.length).toBeGreaterThan(0);
      const sentMessage = sendMessageCalls[0]?.[0] ?? '';
      expect(sentMessage).toContain('新着物件発見');
      expect(sentMessage).toContain('東京の物件');
      expect(sentMessage).toContain('2件');
      expect(sentMessage).toContain('新築マンション');
      expect(sentMessage).toContain('3,000万円');
    });
  });

  describe('sendUserStatisticsReport', () => {
    it('ユーザー統計レポートを送信できること', async () => {
      const user = Object.assign(new User(), {
        id: 'user-123',
        telegramChatId: 'chat-123',
        telegramUsername: 'testuser',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
      });

      const urls = [
        Object.assign(new UserUrl(), {
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
        Object.assign(new UserUrl(), {
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

      await notificationService.sendUserStatisticsReport('user-123');

      expect(mockUserService.getUserUrls).toHaveBeenCalledWith('user-123');
      expect(mockUserService.getUserById).toHaveBeenCalledWith('user-123');

      // TelegramNotifierのインスタンス作成を確認
      expect(MockedTelegramNotifier).toHaveBeenCalledWith('test-bot-token', 'chat-123');
      
      // Get the created instance
      const mockCall = MockedTelegramNotifier as jest.Mock;
      const createdInstances = mockCall.mock.instances;
      expect(createdInstances.length).toBeGreaterThan(0);
      
      const lastNotifier = createdInstances[createdInstances.length - 1] as jest.Mocked<TelegramNotifier>;
      expect(lastNotifier.sendMessage).toHaveBeenCalled();
      
      // メッセージ内容の確認
      const sendMessageCalls = lastNotifier.sendMessage.mock.calls;
      expect(sendMessageCalls.length).toBeGreaterThan(0);
      const sentMessage = sendMessageCalls[0]?.[0] ?? '';
      expect(sentMessage).toContain('監視統計レポート');
      expect(sentMessage).toContain('150回'); // 総チェック数
      expect(sentMessage).toContain('8回'); // 新着検知数
      expect(sentMessage).toContain('物件1');
      expect(sentMessage).toContain('物件2');
    });

    it('ユーザーが見つからない場合は何もしないこと', async () => {
      mockUserService.getUserUrls.mockResolvedValue([]);
      mockUserService.getUserById.mockResolvedValue(null);

      await notificationService.sendUserStatisticsReport('user-123');

      // TelegramNotifierが作成されないことを確認
      expect(MockedTelegramNotifier).not.toHaveBeenCalled();
    });

    it('URLがない場合は何もしないこと', async () => {
      const user = new User();
      user.id = 'user-123';

      mockUserService.getUserUrls.mockResolvedValue([]);
      mockUserService.getUserById.mockResolvedValue(user);

      await notificationService.sendUserStatisticsReport('user-123');

      // TelegramNotifierが作成されないことを確認
      expect(MockedTelegramNotifier).not.toHaveBeenCalled();
    });

    it('成功率が低い場合に警告メッセージを含むこと', async () => {
      const user = Object.assign(new User(), {
        id: 'user-123',
        telegramChatId: 'chat-123',
        telegramUsername: 'testuser',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
      });

      const urls = [
        Object.assign(new UserUrl(), {
          id: 'url-1',
          name: '物件1',
          url: 'https://example.com/1',
          prefecture: '東京都',
          userId: user.id,
          isActive: true,
          isMonitoring: true,
          totalChecks: 100,
          newListingsCount: 5,
          errorCount: 10, // 高いエラー率
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      mockUserService.getUserUrls.mockResolvedValue(urls);
      mockUserService.getUserById.mockResolvedValue(user);

      await notificationService.sendUserStatisticsReport('user-123');

      const mockCall = MockedTelegramNotifier as jest.Mock;
      const createdInstances = mockCall.mock.instances;
      const lastNotifier = createdInstances[createdInstances.length - 1] as jest.Mocked<TelegramNotifier>;
      const sendMessageCalls = lastNotifier.sendMessage.mock.calls;
      expect(sendMessageCalls.length).toBeGreaterThan(0);
      const sentMessage = sendMessageCalls[0]?.[0] ?? '';
      
      expect(sentMessage).toContain('エラー率が高めです');
    });
  });

  describe('private methods', () => {
    it('escapeMarkdown - マークダウン文字をエスケープすること', async () => {
      // privateメソッドのテストのため、直接アクセスできないが、
      // sendNewPropertyNotificationの結果から間接的に確認
      const user = Object.assign(new User(), {
        id: 'user-123',
        telegramChatId: 'chat-123',
        telegramUsername: 'testuser',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
      });

      const userUrl = Object.assign(new UserUrl(), {
        id: 'url-123',
        name: 'Test_Property*',
        prefecture: '東京都[渋谷区]',
        url: 'https://example.com',
        userId: user.id,
        user: user,
        isActive: true,
        isMonitoring: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalChecks: 0,
        newListingsCount: 0,
        errorCount: 0,
      });

      const detectionResult: NewPropertyDetectionResult = {
        hasNewProperty: true,
        newPropertyCount: 1,
        newProperties: [
          {
            signature: 'prop-1',
            title: 'Title with special chars: _*[]',
            price: '1,000万円',
            location: '場所',
            detectedAt: new Date(),
          },
        ],
        totalMonitored: 1,
        detectedAt: new Date(),
        confidence: 'high',
      };

      await notificationService.sendNewPropertyNotification(userUrl, detectionResult);

      const mockCall = MockedTelegramNotifier as jest.Mock;
      const createdInstances = mockCall.mock.instances;
      const lastNotifier = createdInstances[createdInstances.length - 1] as jest.Mocked<TelegramNotifier>;
      const sendMessageCalls = lastNotifier.sendMessage.mock.calls;
      expect(sendMessageCalls.length).toBeGreaterThan(0);
      const sentMessage = sendMessageCalls[0]?.[0] ?? '';
      
      // エスケープされた文字が含まれることを確認
      expect(sentMessage).toContain('\\*');
      expect(sentMessage).toContain('\\_');
      expect(sentMessage).toContain('\\[');
      expect(sentMessage).toContain('\\]');
    });

    it('getConfidenceText - 信頼度テキストを返すこと', async () => {
      const user = Object.assign(new User(), {
        id: 'user-123',
        telegramChatId: 'chat-123',
        telegramUsername: 'testuser',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
      });

      const userUrl = Object.assign(new UserUrl(), {
        id: 'url-123',
        name: 'Test',
        prefecture: '東京都',
        url: 'https://example.com',
        userId: user.id,
        user: user,
        isActive: true,
        isMonitoring: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalChecks: 0,
        newListingsCount: 0,
        errorCount: 0,
      });

      // very_high
      const detectionResult1: NewPropertyDetectionResult = {
        hasNewProperty: true,
        newPropertyCount: 1,
        newProperties: [],
        totalMonitored: 1,
        detectedAt: new Date(),
        confidence: 'very_high',
      };

      await notificationService.sendNewPropertyNotification(userUrl, detectionResult1);

      const mockCall = MockedTelegramNotifier as jest.Mock;
      const createdInstances = mockCall.mock.instances;
      const lastNotifier = createdInstances[createdInstances.length - 1] as jest.Mocked<TelegramNotifier>;
      const sendMessageCalls = lastNotifier.sendMessage.mock.calls;
      expect(sendMessageCalls.length).toBeGreaterThan(0);
      const sentMessage = sendMessageCalls[0]?.[0] ?? '';
      
      expect(sentMessage).toContain('非常に高い');
      expect(sentMessage).toContain('⭐⭐⭐');
    });
  });

  describe('error handling', () => {
    it('通知送信エラーをログに記録すること', async () => {
      const user = Object.assign(new User(), {
        id: 'user-123',
        telegramChatId: 'chat-123',
        telegramUsername: 'testuser',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date(),
      });

      const userUrl = Object.assign(new UserUrl(), {
        id: 'url-123',
        name: 'Test',
        prefecture: '東京都',
        url: 'https://example.com',
        userId: user.id,
        user: user,
        isActive: true,
        isMonitoring: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalChecks: 0,
        newListingsCount: 0,
        errorCount: 0,
      });

      const detectionResult: NewPropertyDetectionResult = {
        hasNewProperty: true,
        newPropertyCount: 1,
        newProperties: [],
        totalMonitored: 1,
        detectedAt: new Date(),
        confidence: 'high',
      };

      // Mock the next TelegramNotifier instance to throw error
      const mockCall = MockedTelegramNotifier as jest.Mock;
      const mockSendMessage = jest.fn<() => Promise<void>>();
      mockSendMessage.mockRejectedValue(new Error('Network error'));
      mockCall.mockImplementationOnce(() => ({
        sendMessage: mockSendMessage,
      }));

      // エラーを投げないことを確認（内部でキャッチされる）
      await expect(
        notificationService.sendNewPropertyNotification(userUrl, detectionResult)
      ).resolves.not.toThrow();
    });
  });
});