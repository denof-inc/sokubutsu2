import { jest } from '@jest/globals';

// テスト環境のセットアップ
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_CHAT_ID = 'test-chat';
process.env.MONITORING_URLS = 'https://example.com';

describe('Main', () => {
  let mockScheduler: any;
  let mockExit: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    jest.clearAllMocks();

    // process.exitのモック
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    // MonitoringSchedulerのモック
    mockScheduler = {
      start: jest.fn(),
      stop: jest.fn(),
    };

    // 動的インポートのモック
    jest.unstable_mockModule('../scheduler.js', () => ({
      MonitoringScheduler: jest.fn(() => mockScheduler),
    }));
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  it('正常に起動すること', async () => {
    mockScheduler.start.mockResolvedValue(undefined);

    try {
      await import('../main.js');
    } catch (error: any) {
      // process.exitが呼ばれることは想定内
      if (error.message !== 'process.exit') {
        throw error;
      }
    }

    expect(mockScheduler.start).toHaveBeenCalled();
  });

  it('設定エラー時に終了すること', async () => {
    // 必須環境変数を削除
    delete process.env.TELEGRAM_BOT_TOKEN;

    try {
      await import('../main.js');
    } catch (error: any) {
      // process.exit(1)が呼ばれることを確認
      expect(error.message).toBe('process.exit');
    }

    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
