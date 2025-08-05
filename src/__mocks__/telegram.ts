import { jest } from '@jest/globals';

export class TelegramNotifier {
  constructor(public botToken: string, public chatId: string) {}

  sendMessage = jest.fn<(message: string) => Promise<void>>()
    .mockResolvedValue(undefined);

  sendNewListingNotification = jest.fn<(properties: any[], count: number) => Promise<void>>()
    .mockResolvedValue(undefined);

  sendErrorAlert = jest.fn<(error: Error, context: string) => Promise<void>>()
    .mockResolvedValue(undefined);

  sendStatisticsReport = jest.fn<(stats: any) => Promise<void>>()
    .mockResolvedValue(undefined);

  testConnection = jest.fn<() => Promise<boolean>>()
    .mockResolvedValue(true);

  getBotInfo = jest.fn<() => Promise<{ username: string; id: number }>>()
    .mockResolvedValue({ username: 'testbot', id: 12345 });
}