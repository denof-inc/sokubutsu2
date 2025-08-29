import { jest, describe, it, expect, beforeEach } from '@jest/globals';

interface IMonitoringScheduler {
  getStatus(): Promise<{
    isRunning: boolean;
    urlCount: number;
    lastCheck: Date | null;
    totalChecks: number;
    successRate: number;
  }>;
  getStatistics(): {
    totalChecks: number;
    errors: number;
    newListings: number;
    lastCheck: Date;
    averageExecutionTime: number;
    successRate: number;
  };
  runManualCheck(): Promise<{
    urlCount: number;
    successCount: number;
    errorCount: number;
    newPropertyCount: number;
    executionTime: number;
  }>;
}

// コマンド登録を捕捉するレジストリ
const registeredCommands: Record<string, (ctx: any) => any> = {};

// grammy Botモック
const mockGetMe = jest.fn<() => Promise<any>>();
const mockSendMessage = jest.fn<() => Promise<any>>();
const mockStart = jest.fn<() => Promise<void>>();
const mockStop = jest.fn<() => void>();
const mockCommand = jest.fn((name: string, handler: (ctx: any) => any) => {
  registeredCommands[name] = handler;
});
const mockCatch = jest.fn();
const mockOn = jest.fn();

const MockBot = jest.fn(() => ({
  api: {
    getMe: mockGetMe,
    sendMessage: mockSendMessage,
  },
  command: mockCommand,
  catch: mockCatch,
  start: mockStart,
  stop: mockStop,
  on: mockOn,
}));

// grammyをモック
jest.unstable_mockModule('grammy', () => ({
  Bot: MockBot,
  webhookCallback: jest.fn(() => {
    const handler = (_req: unknown, _res: unknown, next?: () => void) => {
      if (typeof next === 'function') next();
    };
    return handler as unknown as import('express').RequestHandler;
  }),
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
    mockStart.mockResolvedValue();
  });

  it('registers and responds to basic commands', async () => {
    const notifier = new TelegramNotifier('token', 'chat');

    const fakeScheduler: IMonitoringScheduler = {
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
      getStatistics: () => {
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
    };

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
      const args = (reply.mock.calls[0] ?? []) as any[];
      const opts = (args[1] as { parse_mode?: string }) ?? undefined;
      // help/startは常にHTMLのはず
      if (cmd === 'help' || cmd === 'start') {
        expect(opts?.parse_mode).toBe('HTML');
      }
      reply.mockClear();
    }
  });
});
