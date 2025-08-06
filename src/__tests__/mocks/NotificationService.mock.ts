import { jest } from '@jest/globals';
import type { NotificationService } from '../../services/NotificationService.js';
import type { UserUrl } from '../../entities/UserUrl.js';
import type { NewPropertyDetectionResult } from '../../types.js';

export const createMockNotificationService = (): jest.Mocked<NotificationService> => {
  const mock = {
    sendNewPropertyNotification: jest.fn<(userUrl: UserUrl, detectionResult: NewPropertyDetectionResult) => Promise<void>>().mockResolvedValue(undefined),
    sendUserStatisticsReport: jest.fn<(userId: string) => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationService>;

  return mock;
};

export const createMockTelegramNotifier = () => {
  return {
    sendMessage: jest.fn<(message: string) => Promise<void>>().mockResolvedValue(undefined),
    sendNewListingNotification: jest.fn<(properties: any[], count: number) => Promise<void>>().mockResolvedValue(undefined),
    sendErrorAlert: jest.fn<(error: Error, context: string) => Promise<void>>().mockResolvedValue(undefined),
    sendStatisticsReport: jest.fn<(stats: any) => Promise<void>>().mockResolvedValue(undefined),
    testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    getBotInfo: jest.fn<() => Promise<{ username: string; id: number }>>().mockResolvedValue({ username: 'testbot', id: 12345 }),
  };
};