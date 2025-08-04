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

// 共通モックの事前登録
jest.mock('../storage.js', () => {
  const mockStorage = {
    load: jest.fn(),
    save: jest.fn(),
    updateStatistics: jest.fn(),
  };
  return {
    SimpleStorage: jest.fn(() => mockStorage),
  };
});

jest.mock('../telegram.js', () => ({
  TelegramNotifier: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue(undefined),
    sendNewListingNotification: jest.fn().mockResolvedValue(undefined),
    sendErrorAlert: jest.fn().mockResolvedValue(undefined),
    sendStatisticsReport: jest.fn().mockResolvedValue(undefined),
    testConnection: jest.fn().mockResolvedValue(true),
    getBotInfo: jest.fn().mockResolvedValue({ username: 'testbot' }),
  })),
}));

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
    getRepository: jest.fn(),
    isInitialized: false,
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
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