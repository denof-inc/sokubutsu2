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

// テスト後のクリーンアップ
afterEach(() => {
  jest.clearAllMocks();
});
