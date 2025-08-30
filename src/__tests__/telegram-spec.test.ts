import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Capture registered command handlers
const registeredCommands: Record<string, (ctx: any) => any> = {};

// grammy mock
const mockGetMe = jest.fn<() => Promise<any>>();
const mockSendMessage = jest.fn<() => Promise<any>>();
const mockSetMyCommands = jest.fn<(_cmds?: any) => Promise<any>>();
const mockCommand = jest.fn((name: string, handler: (ctx: any) => any) => {
  registeredCommands[name] = handler;
});
const mockCatch = jest.fn();
const mockOn = jest.fn();

const MockBot = jest.fn(() => ({
  api: {
    getMe: mockGetMe,
    sendMessage: mockSendMessage,
    setMyCommands: mockSetMyCommands,
  },
  command: mockCommand,
  catch: mockCatch,
  on: mockOn,
}));

// Mutable stubs for UserService behaviors
let stubUser: any = null;
let stubUrls: any[] = [];
let stubRegisterResult: any = { success: true, userUrl: null };
let stubToggleResult: any = { success: true, message: 'toggled' };
let stubDeleteResult: any = { success: true, message: 'deleted' };

// Mock modules
jest.unstable_mockModule('grammy', () => ({
  Bot: MockBot,
  webhookCallback: jest.fn(() => {
    const handler = (_req: unknown, _res: unknown, next?: () => void) => {
      if (typeof next === 'function') next();
    };
    return handler as unknown as import('express').RequestHandler;
  }),
}));

jest.unstable_mockModule('../services/UserService.js', () => ({
  UserService: class {
    async registerOrGetUser() {
      await Promise.resolve();
      return stubUser ?? { id: 'user-1', telegramChatId: 'test', isActive: true };
    }
    async getUserUrls() {
      await Promise.resolve();
      return stubUrls;
    }
    async registerUrl(userId: string, url: string, name: string, prefecture: string) {
      await Promise.resolve();
      return (
        stubRegisterResult ?? {
          success: true,
          userUrl: { id: 'abcd1234-xxxx', url, name, prefecture },
        }
      );
    }
    async toggleUrlMonitoring() {
      await Promise.resolve();
      return stubToggleResult;
    }
    async deleteUrl() {
      await Promise.resolve();
      return stubDeleteResult;
    }
  },
}));

// Import after mocks
const { TelegramNotifier } = await import('../telegram.js');
const { config } = await import('../config.js');

// Scheduler interface (local copy)
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
// Fake scheduler (most commands use UserService, but keep shape)
const fakeScheduler: IMonitoringScheduler = {
  getStatus: async () => {
    await Promise.resolve();
    return {
      isRunning: true,
      urlCount: 1,
      lastCheck: new Date('2025-08-30T18:05:37+09:00'),
      totalChecks: 17,
      successRate: 100,
    };
  },
  getStatistics: () => ({
    totalChecks: 17,
    errors: 0,
    newListings: 1,
    lastCheck: new Date('2025-08-30T18:05:37+09:00'),
    averageExecutionTime: 28.3,
    successRate: 100,
  }),
  runManualCheck: async () => {
    await Promise.resolve();
    return {
      urlCount: 1,
      successCount: 1,
      errorCount: 0,
      newPropertyCount: 0,
      executionTime: 1000,
    };
  },
};

describe('TelegramNotifier spec commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(registeredCommands).forEach(k => delete registeredCommands[k]);

    process.env.ADMIN_PUBLIC_URL = 'https://example.com';
    // 上書き: createAdminLinkでリンクに使われる
    (config as any).admin = { enabled: true, port: 3002, publicUrl: 'https://example.com' };

    mockGetMe.mockResolvedValue({ id: 1, is_bot: true, first_name: 'Bot', username: 'bot_test' });
    mockSendMessage.mockResolvedValue({ ok: true });
    mockSetMyCommands.mockResolvedValue({ ok: true });

    stubUser = { id: 'user-1', telegramChatId: 'test', isActive: true };
    stubUrls = [];
    stubRegisterResult = {
      success: true,
      userUrl: { id: 'abcd1234-xxxx', url: 'https://u', name: '監視A' },
    };
    stubToggleResult = { success: true, message: 'ok' };
    stubDeleteResult = { success: true, message: 'ok' };
  });

  it('/help shows add/resume/delete', async () => {
    const notifier = new TelegramNotifier('token', 'chat');
    notifier.setupCommandHandlers(fakeScheduler as unknown as IMonitoringScheduler);
    const reply = jest.fn();
    await registeredCommands['help']?.({ reply });
    const text = (reply.mock.calls[0]?.[0] ?? '') as string;
    expect(text).toContain('/add &lt;URL&gt; &lt;名前&gt;');
    expect(text).toContain('/resume &lt;ID&gt;');
    expect(text).toContain('/delete &lt;ID&gt;');
  });

  it('/status lists each url with link and short ID', async () => {
    const notifier = new TelegramNotifier('token', 'chat');
    notifier.setupCommandHandlers(fakeScheduler as unknown as IMonitoringScheduler);
    expect(registeredCommands['status']).toBeDefined();
    stubUrls = [
      {
        id: 'abcd1234-xxxx-xxxx',
        url: 'https://x',
        name: '東京都全域監視',
        isMonitoring: true,
        lastCheckedAt: new Date('2025-08-30T18:05:37+09:00'),
      },
    ];
    const reply = jest.fn();
    await registeredCommands['status']?.({ reply, chat: { id: 'chat' }, from: { id: 1 } });
    const text = (reply.mock.calls[0]?.[0] ?? '') as string;
    expect(text).toContain('ID: abcd');
    expect(text).toContain('<a href="https://x">東京都全域監視</a>');
    expect(text).toContain('最終チェック');
  });

  it('/stats lists per-url statistics with link', async () => {
    const notifier = new TelegramNotifier('token', 'chat');
    notifier.setupCommandHandlers(fakeScheduler as unknown as IMonitoringScheduler);
    expect(registeredCommands['stats']).toBeDefined();
    stubUrls = [
      {
        id: 'abcd1234-xxxx',
        url: 'https://x',
        name: '東京都全域監視',
        totalChecks: 17,
        errorCount: 0,
        newListingsCount: 1,
        lastCheckedAt: new Date('2025-08-30T18:05:37+09:00'),
      },
    ];
    const reply = jest.fn();
    await registeredCommands['stats']?.({ reply, chat: { id: 'chat' }, from: { id: 1 } });
    const text = (reply.mock.calls[0]?.[0] ?? '') as string;
    expect(text).toContain('<a href="https://x">東京都全域監視</a>');
    expect(text).toContain('総チェック数: 17回');
    expect(text).toContain('エラー数: 0回');
    expect(text).toContain('新着検知: 1回');
    expect(text).toContain('監視間隔:');
    expect(text).toContain('最終チェック:');
  });

  it('/add requires name and succeeds with short ID', async () => {
    const notifier = new TelegramNotifier('token', 'chat');
    notifier.setupCommandHandlers(fakeScheduler as unknown as IMonitoringScheduler);
    expect(registeredCommands['add']).toBeDefined();
    const reply = jest.fn();
    // Missing name -> error
    await registeredCommands['add']?.({
      reply,
      message: { text: '/add https://example.com' },
      chat: { id: 'chat' },
      from: { id: 1 },
    });
    const errText = (reply.mock.calls[0]?.[0] ?? '') as string;
    expect(errText).toContain('形式: /add <URL> <名前>');
    reply.mockClear();
    // Success
    await registeredCommands['add']?.({
      reply,
      message: { text: '/add https://example.com 監視A' },
      chat: { id: 'chat' },
      from: { id: 1 },
    });
    const ok = (reply.mock.calls[0]?.[0] ?? '') as string;
    expect(ok).toContain('ID: abcd');
    expect(ok).toContain('📍 名前: 監視A');
  });

  it('/resume and /delete accept 4-char ID', async () => {
    const notifier = new TelegramNotifier('token', 'chat');
    notifier.setupCommandHandlers(fakeScheduler as unknown as IMonitoringScheduler);
    stubUrls = [{ id: 'abcd1234-xxxx', name: '監視A', isMonitoring: false }];
    const reply = jest.fn();
    await registeredCommands['resume']?.({
      reply,
      message: { text: '/resume abcd' },
      chat: { id: 'chat' },
      from: { id: 1 },
    });
    expect(reply.mock.calls[0]?.[0]).toContain('監視を再開しました');
    reply.mockClear();
    await registeredCommands['delete']?.({
      reply,
      message: { text: '/delete abcd' },
      chat: { id: 'chat' },
      from: { id: 1 },
    });
    expect(reply.mock.calls[0]?.[0]).toContain('URLを削除しました');
  });
});
