import { jest } from '@jest/globals';
import { UserService } from '../../services/UserService.js';
import { User } from '../../entities/User.js';
import { UserUrl } from '../../entities/UserUrl.js';
import { AppDataSource } from '../../database/connection.js';

// TypeORMのRepository型のモックを作成するためのヘルパー型
type MockRepository<T> = {
  findOne: jest.MockedFunction<(options?: any) => Promise<T | null>>;
  find: jest.MockedFunction<(options?: any) => Promise<T[]>>;
  create: jest.MockedFunction<(entityLike?: any) => T>;
  save: jest.MockedFunction<(entity: T) => Promise<T>>;
};

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: MockRepository<User>;
  let mockUrlRepository: MockRepository<UserUrl>;

  beforeEach(() => {
    // リポジトリモックの設定
    mockUserRepository = {
      findOne: jest.fn<(options?: any) => Promise<User | null>>().mockResolvedValue(null),
      find: jest.fn<(options?: any) => Promise<User[]>>().mockResolvedValue([]),
      create: jest.fn<(entityLike?: any) => User>().mockImplementation(() => new User()),
      save: jest.fn<(entity: User) => Promise<User>>().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockUrlRepository = {
      findOne: jest.fn<(options?: any) => Promise<UserUrl | null>>().mockResolvedValue(null),
      find: jest.fn<(options?: any) => Promise<UserUrl[]>>().mockResolvedValue([]),
      create: jest.fn<(entityLike?: any) => UserUrl>().mockImplementation(() => new UserUrl()),
      save: jest.fn<(entity: UserUrl) => Promise<UserUrl>>().mockImplementation((entity) => Promise.resolve(entity)),
    };

    // AppDataSourceモックの設定
    const getRepositoryMock = AppDataSource.getRepository as jest.MockedFunction<typeof AppDataSource.getRepository>;
    getRepositoryMock.mockImplementation((entity: any) => {
      if (entity === User) return mockUserRepository as any;
      if (entity === UserUrl) return mockUrlRepository as any;
      return null as any;
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

      mockUserRepository.findOne.mockResolvedValue(existingUser);

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

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(newUser);
      mockUserRepository.save.mockResolvedValue(newUser);

      const result = await userService.registerOrGetUser('chat-456', 'newuser');

      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toBe(newUser);
    });

    it('usernameなしでユーザーを作成できること', async () => {
      const newUser = new User();
      newUser.id = 'user-789';
      newUser.telegramChatId = 'chat-789';
      newUser.isActive = true;

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(newUser);
      mockUserRepository.save.mockResolvedValue(newUser);

      const result = await userService.registerOrGetUser('chat-789');

      expect(mockUserRepository.create).toHaveBeenCalled();
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
      mockUser.canAddUrl = jest.fn<() => boolean>().mockReturnValue(true);
      mockUser.canAddUrlInPrefecture = jest.fn<(prefecture: string) => boolean>().mockReturnValue(true);
    });

    it('URLを正常に登録できること', async () => {
      const newUrl = new UserUrl();
      newUrl.id = 'url-123';
      newUrl.url = 'https://example.com';
      newUrl.name = 'テスト物件';
      newUrl.prefecture = '東京都';

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUrlRepository.findOne.mockResolvedValue(null);
      mockUrlRepository.create.mockReturnValue(newUrl);
      mockUrlRepository.save.mockResolvedValue(newUrl);

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
      mockUserRepository.findOne.mockResolvedValue(null);

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
      mockUser.canAddUrl = jest.fn<() => boolean>().mockReturnValue(false);
      mockUserRepository.findOne.mockResolvedValue(mockUser);

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
      mockUser.canAddUrlInPrefecture = jest.fn<(prefecture: string) => boolean>().mockReturnValue(false);
      mockUserRepository.findOne.mockResolvedValue(mockUser);

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

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUrlRepository.findOne.mockResolvedValue(existingUrl);

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
        Object.assign(new UserUrl(), {
          id: 'url-1',
          url: 'https://example1.com',
          name: '物件1',
          prefecture: '東京都',
          userId: 'user-123',
          isActive: true,
          isMonitoring: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          totalChecks: 0,
          newListingsCount: 0,
          errorCount: 0,
        }),
        Object.assign(new UserUrl(), {
          id: 'url-2',
          url: 'https://example2.com',
          name: '物件2',
          prefecture: '神奈川県',
          userId: 'user-123',
          isActive: true,
          isMonitoring: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          totalChecks: 0,
          newListingsCount: 0,
          errorCount: 0,
        }),
      ];

      mockUrlRepository.find.mockResolvedValue(urls);

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

      mockUrlRepository.findOne.mockResolvedValue(userUrl);
      mockUrlRepository.save.mockResolvedValue(userUrl);

      const result = await userService.toggleUrlMonitoring('user-123', 'url-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('一時停止');
      expect(result.isMonitoring).toBe(false);
      expect(mockUrlRepository.save).toHaveBeenCalled();
    });

    it('URLが見つからない場合はエラーを返すこと', async () => {
      mockUrlRepository.findOne.mockResolvedValue(null);

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

      mockUrlRepository.findOne.mockResolvedValue(userUrl);
      mockUrlRepository.save.mockResolvedValue(userUrl);

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
        Object.assign(new UserUrl(), {
          id: 'url-1',
          url: 'https://example1.com',
          name: '物件1',
          prefecture: '東京都',
          userId: 'user-123',
          isActive: true,
          isMonitoring: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          totalChecks: 0,
          newListingsCount: 0,
          errorCount: 0,
        }),
        Object.assign(new UserUrl(), {
          id: 'url-2',
          url: 'https://example2.com',
          name: '物件2',
          prefecture: '神奈川県',
          userId: 'user-456',
          isActive: true,
          isMonitoring: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          totalChecks: 0,
          newListingsCount: 0,
          errorCount: 0,
        }),
      ];

      mockUrlRepository.find.mockResolvedValue(urls);

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

      mockUserRepository.findOne.mockResolvedValue(user);

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
        Object.assign(new User(), {
          id: 'user-1',
          telegramChatId: 'chat-1',
          telegramUsername: 'user1',
          isActive: true,
          registeredAt: new Date(),
          updatedAt: new Date(),
          urls: [],
        }),
        Object.assign(new User(), {
          id: 'user-2',
          telegramChatId: 'chat-2',
          telegramUsername: 'user2',
          isActive: true,
          registeredAt: new Date(),
          updatedAt: new Date(),
          urls: [],
        }),
      ];

      mockUserRepository.find.mockResolvedValue(users);

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

      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

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

      mockUrlRepository.findOne.mockResolvedValue(userUrl);
      mockUrlRepository.save.mockResolvedValue(userUrl);

      const result = await userService.adminDeleteUrl('url-123');

      expect(result.success).toBe(true);
      expect(userUrl.isActive).toBe(false);
      expect(mockUrlRepository.save).toHaveBeenCalled();
    });
  });
});