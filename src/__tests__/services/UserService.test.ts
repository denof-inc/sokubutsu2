import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { UserService } from '../../services/UserService.js';
import { User } from '../../entities/User.js';
import { UserUrl } from '../../entities/UserUrl.js';
import { AppDataSource } from '../../database/connection.js';

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: Partial<Repository<User>>;
  let mockUrlRepository: Partial<Repository<UserUrl>>;

  beforeEach(() => {
    // リポジトリモックの設定
    mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    mockUrlRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    // AppDataSourceモックの設定
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
      if (entity === User) return mockUserRepository;
      if (entity === UserUrl) return mockUrlRepository;
      return null;
    });

    userService = new UserService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerOrGetUser', () => {
    it('既存ユーザーを返すこと', async () => {
      const existingUser = new User();
      existingUser.id = 'user-123';
      existingUser.telegramChatId = 'chat-123';
      existingUser.telegramUsername = 'testuser';
      existingUser.isActive = true;
      existingUser.urls = [];

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(existingUser);

      const result = await userService.registerOrGetUser('chat-123', 'testuser');

      expect(result).toBe(existingUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { telegramChatId: 'chat-123' },
        relations: ['urls'],
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('新規ユーザーを作成すること', async () => {
      const newUser = new User();
      newUser.id = 'user-456';
      newUser.telegramChatId = 'chat-456';
      newUser.telegramUsername = 'newuser';
      newUser.isActive = true;

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);
      (mockUserRepository.save as jest.Mock).mockResolvedValue(newUser);

      const result = await userService.registerOrGetUser('chat-456', 'newuser');

      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toBe(newUser);
    });

    it('usernameなしでユーザーを作成できること', async () => {
      const newUser = new User();
      newUser.id = 'user-789';
      newUser.telegramChatId = 'chat-789';
      newUser.isActive = true;

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);
      (mockUserRepository.save as jest.Mock).mockResolvedValue(newUser);

      const result = await userService.registerOrGetUser('chat-789');

      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toBe(newUser);
    });
  });

  describe('registerUrl', () => {
    let mockUser: User;

    beforeEach(() => {
      mockUser = new User();
      mockUser.id = 'user-123';
      mockUser.telegramChatId = 'chat-123';
      mockUser.urls = [];
      mockUser.canAddUrl = jest.fn().mockReturnValue(true);
      mockUser.canAddUrlInPrefecture = jest.fn().mockReturnValue(true);
    });

    it('URLを正常に登録できること', async () => {
      const newUrl = new UserUrl();
      newUrl.id = 'url-123';
      newUrl.url = 'https://example.com';
      newUrl.name = 'テスト物件';
      newUrl.prefecture = '東京都';

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockUrlRepository.findOne as jest.Mock).mockResolvedValue(null);
      (mockUrlRepository.create as jest.Mock).mockReturnValue(newUrl);
      (mockUrlRepository.save as jest.Mock).mockResolvedValue(newUrl);

      const result = await userService.registerUrl(
        'user-123',
        'https://example.com',
        'テスト物件',
        '東京都'
      );

      expect(result.success).toBe(true);
      expect(result.userUrl).toBe(newUrl);
      expect(mockUrlRepository.save).toHaveBeenCalled();
    });

    it('ユーザーが見つからない場合はエラーを返すこと', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await userService.registerUrl(
        'user-123',
        'https://example.com',
        'テスト物件',
        '東京都'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('ユーザーが見つかりません');
    });

    it('URL数制限に達している場合はエラーを返すこと', async () => {
      mockUser.canAddUrl = jest.fn().mockReturnValue(false);
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.registerUrl(
        'user-123',
        'https://example.com',
        'テスト物件',
        '東京都'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('上限（3件）');
    });

    it('都道府県制限に違反する場合はエラーを返すこと', async () => {
      mockUser.canAddUrlInPrefecture = jest.fn().mockReturnValue(false);
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.registerUrl(
        'user-123',
        'https://example.com',
        'テスト物件',
        '東京都'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('東京都では既にURL');
    });

    it('重複URLの場合はエラーを返すこと', async () => {
      const existingUrl = new UserUrl();
      existingUrl.url = 'https://example.com';

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockUrlRepository.findOne as jest.Mock).mockResolvedValue(existingUrl);

      const result = await userService.registerUrl(
        'user-123',
        'https://example.com',
        'テスト物件',
        '東京都'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('同じURLが既に');
    });
  });

  describe('getUserUrls', () => {
    it('ユーザーのURL一覧を取得できること', async () => {
      const urls = [
        { id: 'url-1', url: 'https://example1.com' },
        { id: 'url-2', url: 'https://example2.com' },
      ];

      (mockUrlRepository.find as jest.Mock).mockResolvedValue(urls);

      const result = await userService.getUserUrls('user-123');

      expect(result).toEqual(urls);
      expect(mockUrlRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123', isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('toggleUrlMonitoring', () => {
    it('監視状態を切り替えられること', async () => {
      const userUrl = new UserUrl();
      userUrl.id = 'url-123';
      userUrl.name = 'テスト物件';
      userUrl.isMonitoring = true;

      (mockUrlRepository.findOne as jest.Mock).mockResolvedValue(userUrl);
      (mockUrlRepository.save as jest.Mock).mockResolvedValue(userUrl);

      const result = await userService.toggleUrlMonitoring('user-123', 'url-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('一時停止');
      expect(result.isMonitoring).toBe(false);
      expect(mockUrlRepository.save).toHaveBeenCalled();
    });

    it('URLが見つからない場合はエラーを返すこと', async () => {
      (mockUrlRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await userService.toggleUrlMonitoring('user-123', 'url-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('URLが見つかりません');
    });
  });

  describe('deleteUrl', () => {
    it('URLを削除（無効化）できること', async () => {
      const userUrl = new UserUrl();
      userUrl.id = 'url-123';
      userUrl.name = 'テスト物件';
      userUrl.isActive = true;

      (mockUrlRepository.findOne as jest.Mock).mockResolvedValue(userUrl);
      (mockUrlRepository.save as jest.Mock).mockResolvedValue(userUrl);

      const result = await userService.deleteUrl('user-123', 'url-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('削除しました');
      expect(userUrl.isActive).toBe(false);
      expect(mockUrlRepository.save).toHaveBeenCalled();
    });
  });

  describe('getAllActiveMonitoringUrls', () => {
    it('全ての監視対象URLを取得できること', async () => {
      const urls = [
        { id: 'url-1', isActive: true, isMonitoring: true },
        { id: 'url-2', isActive: true, isMonitoring: true },
      ];

      (mockUrlRepository.find as jest.Mock).mockResolvedValue(urls);

      const result = await userService.getAllActiveMonitoringUrls();

      expect(result).toEqual(urls);
      expect(mockUrlRepository.find).toHaveBeenCalledWith({
        where: { isActive: true, isMonitoring: true },
        relations: ['user'],
      });
    });
  });

  describe('getUserById', () => {
    it('IDでユーザーを取得できること', async () => {
      const user = new User();
      user.id = 'user-123';

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(user);

      const result = await userService.getUserById('user-123');

      expect(result).toBe(user);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        relations: ['urls'],
      });
    });
  });

  describe('getAllUsers', () => {
    it('全ユーザーを取得できること', async () => {
      const users = [
        { id: 'user-1', telegramChatId: 'chat-1' },
        { id: 'user-2', telegramChatId: 'chat-2' },
      ];

      (mockUserRepository.find as jest.Mock).mockResolvedValue(users);

      const result = await userService.getAllUsers();

      expect(result).toEqual(users);
      expect(mockUserRepository.find).toHaveBeenCalledWith({
        relations: ['urls'],
        order: { registeredAt: 'DESC' },
      });
    });
  });

  describe('deactivateUser', () => {
    it('ユーザーを無効化できること', async () => {
      const user = new User();
      user.id = 'user-123';
      user.isActive = true;

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(user);
      (mockUserRepository.save as jest.Mock).mockResolvedValue(user);

      const result = await userService.deactivateUser('user-123');

      expect(result.success).toBe(true);
      expect(user.isActive).toBe(false);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });

  describe('adminDeleteUrl', () => {
    it('管理者権限でURLを削除できること', async () => {
      const userUrl = new UserUrl();
      userUrl.id = 'url-123';
      userUrl.isActive = true;

      (mockUrlRepository.findOne as jest.Mock).mockResolvedValue(userUrl);
      (mockUrlRepository.save as jest.Mock).mockResolvedValue(userUrl);

      const result = await userService.adminDeleteUrl('url-123');

      expect(result.success).toBe(true);
      expect(userUrl.isActive).toBe(false);
      expect(mockUrlRepository.save).toHaveBeenCalled();
    });
  });
});