/**
 * Jest テスト環境設定
 */

import { jest } from '@jest/globals';

// テスト用環境変数設定
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token';
process.env.TELEGRAM_CHAT_ID = 'test_chat_id';
process.env.MONITORING_URLS = 'https://example.com/test';
process.env.DATA_DIR = './test-data';

// コンソール出力を抑制（テスト時）
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// グローバルモックの設定
// @ts-expect-error - テスト用のグローバル設定
globalThis.__JEST_MOCK_REGISTRY__ = new Map();

// 共通モックの事前登録 - 最小限に留める
// ESMモジュールの手動モック設定
jest.mock('./storage.js', () => {
  const mockStorage = {
    load: jest.fn(),
    save: jest.fn(),
    updateStatistics: jest.fn(),
  };
  return {
    SimpleStorage: jest.fn(() => mockStorage),
  };
});

jest.mock('./telegram.js', () => ({
  TelegramNotifier: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn(),
    sendNewListingNotification: jest.fn(),
    sendErrorAlert: jest.fn(),
    sendStatisticsReport: jest.fn(),
    testConnection: jest.fn(),
    getBotInfo: jest.fn(),
  })),
}));

jest.mock('./logger.js', () => ({
  vibeLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    step: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('./database/connection.js', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    isInitialized: false,
    initialize: jest.fn(),
  },
}));

// テスト後のクリーンアップ
afterEach(() => {
  jest.clearAllMocks();
});
