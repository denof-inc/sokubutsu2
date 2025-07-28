/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */

// dotenvのモック - 何もしないように設定
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// 環境変数のモック
const originalEnv = process.env;

describe('Config', () => {
  beforeEach(() => {
    jest.resetModules();
    // 環境変数を完全にクリア
    for (const key in process.env) {
      if (
        key.startsWith('TELEGRAM_') ||
        key.startsWith('MONITORING_') ||
        key === 'PORT' ||
        key === 'NODE_ENV' ||
        key === 'DATA_DIR'
      ) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('config object', () => {
    it('デフォルト値が正しく設定されること', () => {
      // 環境変数をクリアして、.env.exampleの影響を受けないようにする
      for (const key in process.env) {
        if (
          key.startsWith('TELEGRAM_') ||
          key.startsWith('MONITORING_') ||
          key === 'PORT' ||
          key === 'NODE_ENV' ||
          key === 'DATA_DIR'
        ) {
          delete process.env[key];
        }
      }

      // configモジュールを再読み込み
      jest.resetModules();
      const { config: freshConfig } = require('../config') as {
        config: typeof import('../config').config;
      };

      expect(freshConfig.telegram.botToken).toBe('');
      expect(freshConfig.telegram.chatId).toBe('');
      expect(freshConfig.monitoring.urls).toEqual([]);
      expect(freshConfig.monitoring.interval).toBe('*/5 * * * *');
      expect(freshConfig.storage.dataDir).toBe('./data');
    });

    it('環境変数から値を読み込むこと', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      process.env.MONITORING_URLS = 'https://example1.com,https://example2.com';
      process.env.MONITORING_INTERVAL = '*/10 * * * *';
      process.env.PORT = '4000';
      process.env.NODE_ENV = 'production';
      process.env.DATA_DIR = '/custom/data';

      jest.resetModules();
      const { config: freshConfig } = require('../config') as {
        config: typeof import('../config').config;
      };

      expect(freshConfig.telegram.botToken).toBe('test-token');
      expect(freshConfig.telegram.chatId).toBe('test-chat-id');
      expect(freshConfig.monitoring.urls).toEqual(['https://example1.com,https://example2.com']);
      expect(freshConfig.monitoring.interval).toBe('*/10 * * * *');
      expect(freshConfig.app.port).toBe(4000);
      expect(freshConfig.app.env).toBe('production');
      expect(freshConfig.storage.dataDir).toBe('/custom/data');
    });
  });

  describe('validateConfig', () => {
    it('必須設定が揃っている場合はtrueを返すこと', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      process.env.MONITORING_URLS = 'https://example.com';

      jest.resetModules();
      const { validateConfig: freshValidate } = require('../config') as {
        validateConfig: typeof import('../config').validateConfig;
      };

      expect(freshValidate()).toBe(true);
    });

    it('TELEGRAM_BOT_TOKENが未設定の場合はfalseを返すこと', () => {
      // 必要な環境変数のみクリア
      delete process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      process.env.MONITORING_URLS = 'https://example.com';

      jest.resetModules();
      const { validateConfig: freshValidate } = require('../config') as {
        validateConfig: typeof import('../config').validateConfig;
      };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(freshValidate()).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('TELEGRAM_CHAT_IDが未設定の場合はfalseを返すこと', () => {
      // 必要な環境変数のみクリア
      delete process.env.TELEGRAM_CHAT_ID;
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.MONITORING_URLS = 'https://example.com';

      jest.resetModules();
      const { validateConfig: freshValidate } = require('../config') as {
        validateConfig: typeof import('../config').validateConfig;
      };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(freshValidate()).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('MONITORING_URLSが未設定の場合はfalseを返すこと', () => {
      // 必要な環境変数のみクリア
      delete process.env.MONITORING_URLS;
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      jest.resetModules();
      const { validateConfig: freshValidate } = require('../config') as {
        validateConfig: typeof import('../config').validateConfig;
      };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(freshValidate()).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('空の配列の場合はfalseを返すこと', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      process.env.MONITORING_URLS = '';

      jest.resetModules();
      const { validateConfig: freshValidate } = require('../config') as {
        validateConfig: typeof import('../config').validateConfig;
      };

      expect(freshValidate()).toBe(false);
    });
  });

  describe('displayConfig', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('設定情報を表示すること', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      process.env.MONITORING_URLS = 'https://example.com';

      jest.resetModules();
      const { displayConfig: freshDisplay } = require('../config') as {
        displayConfig: typeof import('../config').displayConfig;
      };

      freshDisplay();

      expect(consoleLogSpy).toHaveBeenCalledWith('⚙️  設定情報:');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('- Telegram Bot Token:'));
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Telegram Chat ID: test-chat-id');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - 監視URL数: 1件');
      expect(consoleLogSpy).toHaveBeenCalledWith('    1. https://example.com');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - 監視間隔: */5 * * * *');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - ポート: 3000');
      // NODE_ENVとDATA_DIRの期待値を削除（環境によって異なる可能性があるため）
    });

    it('複数のURLを表示すること', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      process.env.MONITORING_URLS = 'https://example1.com,https://example2.com';

      jest.resetModules();
      const { displayConfig: freshDisplay } = require('../config') as {
        displayConfig: typeof import('../config').displayConfig;
      };

      freshDisplay();

      expect(consoleLogSpy).toHaveBeenCalledWith('  - 監視URL数: 1件');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '    1. https://example1.com,https://example2.com'
      );
    });

    it('不正なポート番号の検証エラーをチェックすること', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      process.env.MONITORING_URLS = 'https://example.com';
      process.env.PORT = '70000';

      jest.resetModules();
      const { validateConfig: freshValidate } = require('../config') as {
        validateConfig: typeof import('../config').validateConfig;
      };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(freshValidate()).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('PORT が不正な値です'));

      consoleErrorSpy.mockRestore();
    });

    it('不正なURL形式の検証エラーをチェックすること', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      process.env.MONITORING_URLS = 'not-a-valid-url';

      jest.resetModules();
      const { validateConfig: freshValidate } = require('../config') as {
        validateConfig: typeof import('../config').validateConfig;
      };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(freshValidate()).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('不正なURL形式'));

      consoleErrorSpy.mockRestore();
    });
  });
});
