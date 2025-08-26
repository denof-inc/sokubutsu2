import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// コマンド登録を捕捉するレジストリ
const registeredCommands: Record<string, (ctx: any) => any> = {};

// Telegrafモック
const mockGetMe = jest.fn<() => Promise<any>>();
const mockSendMessage = jest.fn<() => Promise<any>>();
const mockLaunch = jest.fn<() => Promise<void>>();
const mockStop = jest.fn<() => void>();
const mockCommand = jest.fn((name: string, handler: (ctx: any) => any) => {
  registeredCommands[name] = handler;
});

const mockTelegraf = jest.fn(() => ({
  telegram: {
    getMe: mockGetMe,
    sendMessage: mockSendMessage,
  },
  command: mockCommand,
  launch: mockLaunch,
  stop: mockStop,
}));

// telegrafをモック
jest.unstable_mockModule('telegraf', () => ({
  Telegraf: mockTelegraf,
}));

// モック後に対象を動的インポート
const { TelegramNotifier } = await import('../telegram.js');

describe('TelegramNotifier command handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(registeredCommands)) delete registeredCommands[k];

    mockGetMe.mockResolvedValue({
      id: 1,
      is_bot: true,
      first_name: 'Bot',
      username: 'bot_test',
    });
    mockSendMessage.mockResolvedValue({ ok: true });
    mockLaunch.mockResolvedValue();
  });

  it('registers and responds to basic commands', async () => {
    const notifier = new TelegramNotifier('token', 'chat');

    const fakeScheduler = {
      getStatus: async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
        return {
          isRunning: true,
          urlCount: 2,
          lastCheck: new Date(),
          totalChecks: 10,
          successRate: 100,
        };
      },
      getStatistics: async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
        return {
          totalChecks: 10,
          errors: 0,
          newListings: 0,
          lastCheck: new Date(),
          averageExecutionTime: 1,
          successRate: 100,
        };
      },
      runManualCheck: async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
        return {
          urlCount: 2,
          successCount: 2,
          errorCount: 0,
          newPropertyCount: 0,
          executionTime: 1000,
        };
      },
    } as any;

    notifier.setupCommandHandlers(fakeScheduler);

    // 登録されたコマンドを確認
    const expected = ['status', 'stats', 'check', 'help', 'start'];
    for (const cmd of expected) {
      expect(registeredCommands[cmd]).toBeDefined();
    }

    // 各コマンドが返信できることを検証
    for (const cmd of expected) {
      const reply = jest.fn();
      await registeredCommands[cmd]?.({ reply });
      expect(reply).toHaveBeenCalled();
    }
  });
});

