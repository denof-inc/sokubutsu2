import { jest } from '@jest/globals';

export const TelegramNotifier = jest.fn().mockImplementation(() => ({
  testConnection: jest.fn(() => Promise.resolve(true)),
  sendStartupNotice: jest.fn(() => Promise.resolve(undefined)),
  sendNewListingNotification: jest.fn(() => Promise.resolve(undefined)),
  sendErrorAlert: jest.fn(() => Promise.resolve(undefined)),
  sendStatisticsReport: jest.fn(() => Promise.resolve(undefined)),
  sendShutdownNotice: jest.fn(() => Promise.resolve(undefined)),
  sendMessage: jest.fn(() => Promise.resolve(undefined)),
  getBotInfo: jest.fn(() => Promise.resolve({ username: 'test_bot', id: 123456 })),
}));
