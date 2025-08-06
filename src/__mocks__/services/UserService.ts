import { jest } from '@jest/globals';
import type { User } from '../../entities/User.js';
import type { UserUrl } from '../../entities/UserUrl.js';

export class UserService {
  registerOrGetUser = jest.fn<(chatId: string, username?: string) => Promise<User>>()
    .mockResolvedValue({
      id: 'user-123',
      telegramChatId: 'chat-123',
      telegramUsername: 'testuser',
      isActive: true,
      registeredAt: new Date(),
      updatedAt: new Date(),
      urls: [],
      canAddUrl: () => true,
      getUrlsByPrefecture: () => [],
      canAddUrlInPrefecture: () => true,
    } as User);

  registerUrl = jest.fn<(userId: string, url: string, name: string, prefecture: string) => Promise<{ success: boolean; message: string; userUrl?: UserUrl }>>()
    .mockResolvedValue({
      success: true,
      message: 'URL registered successfully',
      userUrl: {
        id: 'url-123',
        url: 'https://example.com',
        name: 'Test Property',
        prefecture: 'Tokyo',
        isActive: true,
        isMonitoring: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-123',
        totalChecks: 0,
        errorCount: 0,
        newListingsCount: 0,
      } as UserUrl,
    });

  getUserUrls = jest.fn<(userId: string) => Promise<UserUrl[]>>()
    .mockResolvedValue([]);

  getUserById = jest.fn<(userId: string) => Promise<User | null>>()
    .mockResolvedValue(null);

  getUserByChatId = jest.fn<(chatId: string) => Promise<User | null>>()
    .mockResolvedValue(null);

  toggleUrlMonitoring = jest.fn<(userId: string, urlId: string) => Promise<{ success: boolean; message: string; isMonitoring?: boolean }>>()
    .mockResolvedValue({
      success: true,
      message: 'Monitoring toggled',
      isMonitoring: false,
    });

  deleteUrl = jest.fn<(userId: string, urlId: string) => Promise<{ success: boolean; message: string }>>()
    .mockResolvedValue({
      success: true,
      message: 'URL deleted',
    });

  getAllActiveMonitoringUrls = jest.fn<() => Promise<UserUrl[]>>()
    .mockResolvedValue([]);

  getAllUsers = jest.fn<() => Promise<User[]>>()
    .mockResolvedValue([]);

  getAllActiveUsers = jest.fn<() => Promise<User[]>>()
    .mockResolvedValue([]);

  deactivateUser = jest.fn<(userId: string) => Promise<{ success: boolean; message: string }>>()
    .mockResolvedValue({
      success: true,
      message: 'User deactivated',
    });

  adminDeleteUrl = jest.fn<(urlId: string) => Promise<{ success: boolean; message: string }>>()
    .mockResolvedValue({
      success: true,
      message: 'URL deleted by admin',
    });
}