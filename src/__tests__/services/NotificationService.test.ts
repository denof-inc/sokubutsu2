import { jest } from '@jest/globals';
import { NotificationService } from '../../services/NotificationService.js';
import { TelegramNotifier } from '../../telegram.js';
import { UserService } from '../../services/UserService.js';
import { UserUrl } from '../../entities/UserUrl.js';
import { User } from '../../entities/User.js';
import { NewPropertyDetectionResult } from '../../types.js';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockUserService: jest.Mocked<UserService>;
  let mockTelegramNotifier: jest.Mocked<TelegramNotifier>;

  beforeEach(() => {
    // UserServiceモックの設定
    mockUserService = {
      getUserUrls: jest.fn(),
      getUserById: jest.fn(),
    } as any;

    // TelegramNotifierモックの設定
    mockTelegramNotifier = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as any;

    (UserService as jest.Mock).mockImplementation(() => mockUserService);
    (TelegramNotifier as jest.Mock).mockImplementation(() => mockTelegramNotifier);

    notificationService = new NotificationService('test-bot-token');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNewPropertyNotification', () => {
    it('新着物件通知を送信できること', async () => {
      const user = new User();
      user.id = 'user-123';
      user.telegramChatId = 'chat-123';
      user.telegramUsername = 'testuser';

      const userUrl = new UserUrl();
      userUrl.id = 'url-123';
      userUrl.name = '東京の物件';
      userUrl.prefecture = '東京都';
      userUrl.url = 'https://example.com/properties';
      userUrl.user = user;

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
      expect(TelegramNotifier).toHaveBeenCalledWith('test-bot-token', 'chat-123');
      
      // sendMessageが呼ばれたことを確認
      const notifierInstances = (TelegramNotifier as jest.Mock).mock.results;
      const lastNotifier = notifierInstances[notifierInstances.length - 1].value;
      expect(lastNotifier.sendMessage).toHaveBeenCalled();
      
      // メッセージ内容の確認
      const sentMessage = lastNotifier.sendMessage.mock.calls[0][0];
      expect(sentMessage).toContain('新着物件発見');
      expect(sentMessage).toContain('東京の物件');
      expect(sentMessage).toContain('2件');
      expect(sentMessage).toContain('新築マンション');
      expect(sentMessage).toContain('3,000万円');
    });
  });

  describe('sendUserStatisticsReport', () => {
    it('ユーザー統計レポートを送信できること', async () => {
      const user = new User();
      user.id = 'user-123';
      user.telegramChatId = 'chat-123';

      const urls = [
        {
          id: 'url-1',
          name: '物件1',
          totalChecks: 100,
          newListingsCount: 5,
          errorCount: 2,
          isMonitoring: true,
        } as UserUrl,
        {
          id: 'url-2',
          name: '物件2',
          totalChecks: 50,
          newListingsCount: 3,
          errorCount: 1,
          isMonitoring: false,
        } as UserUrl,
      ];

      (mockUserService.getUserUrls as jest.Mock).mockResolvedValue(urls);
      (mockUserService.getUserById as jest.Mock).mockResolvedValue(user);

      await notificationService.sendUserStatisticsReport('user-123');

      expect(mockUserService.getUserUrls as jest.Mock).toHaveBeenCalledWith('user-123');
      expect(mockUserService.getUserById as jest.Mock).toHaveBeenCalledWith('user-123');

      // TelegramNotifierのインスタンス作成を確認
      expect(TelegramNotifier).toHaveBeenCalledWith('test-bot-token', 'chat-123');
      
      // sendMessageが呼ばれたことを確認
      const notifierInstances = (TelegramNotifier as jest.Mock).mock.results;
      const lastNotifier = notifierInstances[notifierInstances.length - 1].value;
      expect(lastNotifier.sendMessage).toHaveBeenCalled();
      
      // メッセージ内容の確認
      const sentMessage = lastNotifier.sendMessage.mock.calls[0][0];
      expect(sentMessage).toContain('監視統計レポート');
      expect(sentMessage).toContain('150回'); // 総チェック数
      expect(sentMessage).toContain('8回'); // 新着検知数
      expect(sentMessage).toContain('物件1');
      expect(sentMessage).toContain('物件2');
    });

    it('ユーザーが見つからない場合は何もしないこと', async () => {
      (mockUserService.getUserUrls as jest.Mock).mockResolvedValue([]);
      (mockUserService.getUserById as jest.Mock).mockResolvedValue(null);

      await notificationService.sendUserStatisticsReport('user-123');

      // TelegramNotifierが作成されないことを確認
      expect(TelegramNotifier).not.toHaveBeenCalled();
    });

    it('URLがない場合は何もしないこと', async () => {
      const user = new User();
      user.id = 'user-123';

      (mockUserService.getUserUrls as jest.Mock).mockResolvedValue([]);
      (mockUserService.getUserById as jest.Mock).mockResolvedValue(user);

      await notificationService.sendUserStatisticsReport('user-123');

      // TelegramNotifierが作成されないことを確認
      expect(TelegramNotifier).not.toHaveBeenCalled();
    });

    it('成功率が低い場合に警告メッセージを含むこと', async () => {
      const user = new User();
      user.id = 'user-123';
      user.telegramChatId = 'chat-123';

      const urls = [
        {
          id: 'url-1',
          name: '物件1',
          totalChecks: 100,
          newListingsCount: 5,
          errorCount: 10, // 高いエラー率
          isMonitoring: true,
        } as UserUrl,
      ];

      (mockUserService.getUserUrls as jest.Mock).mockResolvedValue(urls);
      (mockUserService.getUserById as jest.Mock).mockResolvedValue(user);

      await notificationService.sendUserStatisticsReport('user-123');

      const notifierInstances = (TelegramNotifier as jest.Mock).mock.results;
      const lastNotifier = notifierInstances[notifierInstances.length - 1].value;
      const sentMessage = lastNotifier.sendMessage.mock.calls[0][0];
      
      expect(sentMessage).toContain('エラー率が高めです');
    });
  });

  describe('private methods', () => {
    it('escapeMarkdown - マークダウン文字をエスケープすること', () => {
      // privateメソッドのテストのため、直接アクセスできないが、
      // sendNewPropertyNotificationの結果から間接的に確認
      const user = new User();
      user.telegramChatId = 'chat-123';

      const userUrl = new UserUrl();
      userUrl.name = 'Test_Property*';
      userUrl.prefecture = '東京都[渋谷区]';
      userUrl.url = 'https://example.com';
      userUrl.user = user;

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

      void notificationService.sendNewPropertyNotification(userUrl, detectionResult);

      const notifierInstances = (TelegramNotifier as jest.Mock).mock.results;
      const lastNotifier = notifierInstances[notifierInstances.length - 1].value;
      const sentMessage = lastNotifier.sendMessage.mock.calls[0][0];
      
      // エスケープされた文字が含まれることを確認
      expect(sentMessage).toContain('\\*');
      expect(sentMessage).toContain('\\_');
      expect(sentMessage).toContain('\\[');
      expect(sentMessage).toContain('\\]');
    });

    it('getConfidenceText - 信頼度テキストを返すこと', async () => {
      const user = new User();
      user.telegramChatId = 'chat-123';

      const userUrl = new UserUrl();
      userUrl.name = 'Test';
      userUrl.prefecture = '東京都';
      userUrl.url = 'https://example.com';
      userUrl.user = user;

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

      const notifierInstances = (TelegramNotifier as jest.Mock).mock.results;
      const lastNotifier = notifierInstances[notifierInstances.length - 1].value;
      const sentMessage = lastNotifier.sendMessage.mock.calls[0][0];
      
      expect(sentMessage).toContain('非常に高い');
      expect(sentMessage).toContain('⭐⭐⭐');
    });
  });

  describe('error handling', () => {
    it('通知送信エラーをログに記録すること', async () => {
      const user = new User();
      user.telegramChatId = 'chat-123';

      const userUrl = new UserUrl();
      userUrl.name = 'Test';
      userUrl.prefecture = '東京都';
      userUrl.url = 'https://example.com';
      userUrl.user = user;

      const detectionResult: NewPropertyDetectionResult = {
        hasNewProperty: true,
        newPropertyCount: 1,
        newProperties: [],
        totalMonitored: 1,
        detectedAt: new Date(),
        confidence: 'high',
      };

      // sendMessageがエラーを投げるように設定
      const error = new Error('Network error');
      mockTelegramNotifier.sendMessage.mockRejectedValue(error);

      // エラーを投げないことを確認（内部でキャッチされる）
      await expect(
        notificationService.sendNewPropertyNotification(userUrl, detectionResult)
      ).resolves.not.toThrow();
    });
  });
});