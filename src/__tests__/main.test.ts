import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Main - Simple', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockExit: jest.SpiedFunction<typeof process.exit>;
  let consoleSpy: jest.SpiedFunction<typeof console.log>;
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();

    // 環境変数をバックアップ
    originalEnv = { ...process.env };

    // 必要な環境変数を設定
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat';
    process.env.MONITORING_URLS = 'https://example.com';

    // process.exitのモック
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    // console出力のモック
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // 環境変数を復元
    process.env = originalEnv;

    // モックを復元
    mockExit.mockRestore();
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('設定エラー時にvalidateConfigがfalseを返すこと', async () => {
    // 環境変数を別のオブジェクトにバックアップして削除
    const savedToken = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;

    // configモジュールをリロードして新しい環境変数を反映
    jest.resetModules();
    const { validateConfig } = await import('../config.js');

    // validateConfigがfalseを返すことを確認
    expect(validateConfig()).toBe(false);

    // 環境変数を復元
    process.env.TELEGRAM_BOT_TOKEN = savedToken;
  });

  it('必要な環境変数が設定されていることを確認', () => {
    expect(process.env.TELEGRAM_BOT_TOKEN).toBe('test-token');
    expect(process.env.TELEGRAM_CHAT_ID).toBe('test-chat');
    expect(process.env.MONITORING_URLS).toBe('https://example.com');
  });
});
