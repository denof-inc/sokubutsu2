import { jest } from '@jest/globals';
import type { NotificationData, Statistics } from '../types.js';

export class TelegramNotifier {
  constructor(
    public botToken: string,
    public chatId: string
  ) {}

  sendMessage = jest.fn<(message: string) => Promise<void>>().mockResolvedValue(undefined);

  sendNewListingNotification = jest
    .fn<(data: NotificationData) => Promise<void>>()
    .mockResolvedValue(undefined);

  sendErrorAlert = jest
    .fn<(url: string, error: string) => Promise<void>>()
    .mockResolvedValue(undefined);

  sendStatisticsReport = jest
    .fn<(stats: Statistics) => Promise<void>>()
    .mockResolvedValue(undefined);

  sendStartupNotice = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

  sendShutdownNotice = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

  testConnection = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);

  getBotInfo = jest
    .fn<() => Promise<{ username: string; id: number }>>()
    .mockResolvedValue({ username: 'testbot', id: 12345 });
}
