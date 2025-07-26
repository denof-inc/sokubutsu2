import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../../domain/users/users.service';
import { TelegramUser } from '../../common/interfaces/telegram-user.interface';
import { User } from '../../domain/users/entities/user.entity';
import { InvalidTelegramDataException } from '../../common/exceptions/auth.exceptions';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;

  const mockTelegramUser: TelegramUser = {
    id: 123456789,
    is_bot: false,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'ja',
  };

  const mockUser: User = {
    id: 1,
    telegramId: '123456789',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    isActive: true,
    languageCode: 'ja',
    settings: {
      notifications: { enabled: true, silent: false },
      language: 'ja',
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    fullName: 'Test User',
    displayName: 'testuser',
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByTelegramId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('authenticateTelegramUser', () => {
    it('should create new user when user does not exist', async () => {
      usersService.findByTelegramId.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);

      const result = await service.authenticateTelegramUser(mockTelegramUser);

      expect(result).toEqual(mockUser);
      expect(usersService.findByTelegramId).toHaveBeenCalledWith('123456789');
      expect(usersService.create).toHaveBeenCalled();
    });

    it('should update existing user', async () => {
      usersService.findByTelegramId.mockResolvedValue(mockUser);
      usersService.update.mockResolvedValue(mockUser);

      const result = await service.authenticateTelegramUser(mockTelegramUser);

      expect(result).toEqual(mockUser);
      expect(usersService.update).toHaveBeenCalled();
    });

    it('should throw error for invalid telegram user data', async () => {
      const invalidUser = { ...mockTelegramUser, first_name: '' };

      await expect(
        service.authenticateTelegramUser(invalidUser),
      ).rejects.toThrow(InvalidTelegramDataException);
    });

    it('should reactivate inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false } as User;
      usersService.findByTelegramId.mockResolvedValue(inactiveUser);
      const activeUser = { ...mockUser, isActive: true } as User;
      usersService.update.mockResolvedValue(activeUser);

      const result = await service.authenticateTelegramUser(mockTelegramUser);

      expect(usersService.update).toHaveBeenCalledWith(
        '123456789',
        expect.objectContaining({ isActive: true }),
      );
    });
  });

  describe('handleStartCommand', () => {
    it('should handle start command for new user', async () => {
      usersService.exists.mockResolvedValue(false);
      usersService.findByTelegramId.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);

      const result = await service.handleStartCommand(mockTelegramUser);

      expect(result.isNewUser).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.welcomeMessage).toContain('はじめまして');
    });

    it('should handle start command for existing user', async () => {
      usersService.exists.mockResolvedValue(true);
      usersService.findByTelegramId.mockResolvedValue(mockUser);
      usersService.update.mockResolvedValue(mockUser);

      const result = await service.handleStartCommand(mockTelegramUser);

      expect(result.isNewUser).toBe(false);
      expect(result.user).toEqual(mockUser);
      expect(result.welcomeMessage).toContain('おかえりなさい');
    });
  });

  describe('validateUser', () => {
    it('should return true for active user', async () => {
      usersService.findByTelegramId.mockResolvedValue(mockUser);

      const result = await service.validateUser('123456789');

      expect(result).toBe(true);
    });

    it('should return false for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false } as User;
      usersService.findByTelegramId.mockResolvedValue(inactiveUser);

      const result = await service.validateUser('123456789');

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      usersService.findByTelegramId.mockResolvedValue(null);

      const result = await service.validateUser('123456789');

      expect(result).toBe(false);
    });
  });
});
