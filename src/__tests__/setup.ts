/**
 * Jestテスト環境のセットアップ
 */

import { jest } from '@jest/globals';

// グローバルモック設定
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// 環境変数の設定
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
process.env.TELEGRAM_ENABLED = 'false';
process.env.MONITORING_URLS = 'https://example.com/test';
process.env.DATA_DIR = './test-data';

// タイムアウト設定
jest.setTimeout(10000);

// モックレジストリの初期化
// @ts-expect-error - テスト用のグローバル設定
globalThis.__JEST_MOCK_REGISTRY__ = new Map();

// Storage mock is now in __mocks__ directory

jest.mock('../telegram.js', () => {
  const createMockNotifier = () => ({
    sendMessage: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    sendNewListingNotification: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    sendErrorAlert: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    sendStatisticsReport: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    getBotInfo: jest.fn<() => Promise<{ username: string }>>().mockResolvedValue({ username: 'testbot' }),
  });
  
  return {
    TelegramNotifier: jest.fn().mockImplementation(() => createMockNotifier()),
  };
});

jest.mock('../logger.js', () => ({
  vibeLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    step: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('../database/connection.js', () => ({
  AppDataSource: {
    getRepository: jest.fn<() => any>(),
    isInitialized: false,
    initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    destroy: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  },
}));

// テスト後のクリーンアップ
afterEach(() => {
  jest.clearAllMocks();
});

// テストスイート終了後のクリーンアップ
afterAll(async () => {
  // データベース接続のクリーンアップ
  const { AppDataSource } = await import('../database/connection.js');
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});