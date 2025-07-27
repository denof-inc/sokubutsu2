import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User, UserSettings } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

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

  const mockCreateUserDto: CreateUserDto = {
    telegramId: '123456789',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    languageCode: 'ja',
    isActive: true,
    settings: {
      notifications: { enabled: true, silent: false },
      language: 'ja',
    },
  };

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockUser);
      repository.save.mockResolvedValue(mockUser);

      const result = await service.create(mockCreateUserDto);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { telegramId: '123456789' },
      });
      expect(repository.create).toHaveBeenCalledWith(mockCreateUserDto);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(mockCreateUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should handle database errors', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockUser);
      repository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create(mockCreateUserDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findByTelegramId', () => {
    it('should find user by telegram ID', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByTelegramId('123456789');

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { telegramId: '123456789' },
      });
    });

    it('should return null if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByTelegramId('999999999');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      repository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.findByTelegramId('123456789')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('update', () => {
    it('should update existing user', async () => {
      const updateDto: UpdateUserDto = {
        lastActiveAt: new Date(),
        isActive: true,
      };

      repository.findOne.mockResolvedValue(mockUser);
      const updatedUser = { ...mockUser, ...updateDto } as User;
      repository.save.mockResolvedValue(updatedUser);

      const result = await service.update('123456789', updateDto);

      expect(result.isActive).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining(updateDto),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.update('999999999', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle database errors during update', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.update('123456789', {})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('exists', () => {
    it('should return true if user exists', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.exists('123456789');

      expect(result).toBe(true);
    });

    it('should return false if user does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.exists('999999999');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      repository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.exists('123456789')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate active user', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      const deactivatedUser = { ...mockUser, isActive: false } as User;
      repository.save.mockResolvedValue(deactivatedUser);

      await service.deactivate('123456789');
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.deactivate('999999999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateSettings', () => {
    it('should update user settings', async () => {
      const newSettings = {
        notifications: { enabled: false, silent: true },
        language: 'en',
      };

      repository.findOne.mockResolvedValue(mockUser);
      const updatedUser = { ...mockUser, settings: newSettings } as User;
      repository.save.mockResolvedValue(updatedUser);

      const result = await service.updateSettings('123456789', newSettings);

      expect(result.settings).toEqual(newSettings);
    });

    it('should merge settings correctly', async () => {
      const partialSettings: Partial<UserSettings> = {
        notifications: {
          enabled: false,
          silent: false,
        },
      };

      repository.findOne.mockResolvedValue(mockUser);
      const mergedSettings = {
        ...mockUser,
        settings: {
          ...mockUser.settings,
          notifications: {
            ...(mockUser.settings?.notifications ?? {}),
            enabled: false,
          },
          language: mockUser.settings?.language ?? 'ja',
        },
      } as User;
      repository.save.mockResolvedValue(mergedSettings);

      const result = await service.updateSettings('123456789', partialSettings);

      expect(result.settings?.notifications.enabled).toBe(false);
      expect(result.settings?.notifications.silent).toBe(false); // 既存値を保持
    });
  });

  describe('findActiveUsers', () => {
    it('should find active users', async () => {
      const mockActiveUsers = [mockUser];

      repository.find = jest.fn().mockResolvedValue(mockActiveUsers);

      const result = await service.findActiveUsers();

      expect(result).toEqual(mockActiveUsers);
      expect(repository.find).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });
});
