import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Statistics } from '../types.js';

// モック関数を作成
const mockGetMe = jest.fn<() => Promise<any>>();
const mockLaunch = jest.fn<() => Promise<any>>();
const mockStop = jest.fn<() => void>();
const mockCommand = jest.fn<(command: string, handler?: any) => void>();

// Contextモック
const mockCtx = {
  reply: jest.fn<() => Promise<any>>(),
};

const mockTelegraf = jest.fn(() => ({
  telegram: {
    getMe: mockGetMe,
  },
  command: mockCommand,
  launch: mockLaunch,
  stop: mockStop,
}));

// Telegrafモジュールをモック
jest.unstable_mockModule('telegraf', () => ({
  Telegraf: mockTelegraf,
}));

// vibeLoggerモジュールをモック
jest.unstable_mockModule('../logger.js', () => ({
  vibeLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const { TelegramNotifier } = await import('../telegram.js');

describe('Telegram Commands', () => {
  let notifier: InstanceType<typeof TelegramNotifier>;
  let mockScheduler: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // スケジューラーモックの作成
    mockScheduler = {
      getStatus: jest.fn(),
      getStatistics: jest.fn(),
      runManualCheck: jest.fn(),
    };
    
    notifier = new TelegramNotifier('test-token', 'test-chat-id');
    
    // Bot情報のモック
    mockGetMe.mockResolvedValue({
      id: 123456789,
      is_bot: true,
      first_name: 'Test Bot',
      username: 'test_bot',
    });
  });

  describe('setupCommandHandlers', () => {
    it('コマンドハンドラーが正しく設定されること', () => {
      notifier.setupCommandHandlers(mockScheduler);
      
      // 5つのコマンドが登録されていることを確認
      expect(mockCommand).toHaveBeenCalledTimes(5);
      expect(mockCommand).toHaveBeenCalledWith('status', expect.any(Function));
      expect(mockCommand).toHaveBeenCalledWith('stats', expect.any(Function));
      expect(mockCommand).toHaveBeenCalledWith('check', expect.any(Function));
      expect(mockCommand).toHaveBeenCalledWith('help', expect.any(Function));
      expect(mockCommand).toHaveBeenCalledWith('start', expect.any(Function));
    });
  });

  describe('/status command', () => {
    it('監視状況を正しく表示すること', async () => {
      mockScheduler.getStatus.mockResolvedValue({
        isRunning: true,
        urlCount: 2,
        lastCheck: new Date('2024-01-01T10:00:00'),
        totalChecks: 100,
        successRate: 95.5,
      });
      
      notifier.setupCommandHandlers(mockScheduler);
      
      // statusコマンドのハンドラーを取得して実行
      const statusHandler = mockCommand.mock.calls.find((call: any[]) => call[0] === 'status')?.[1] as ((ctx: any) => Promise<void>) | undefined;
      if (statusHandler) {
        await statusHandler(mockCtx);
      }
      
      expect(mockScheduler.getStatus).toHaveBeenCalled();
      expect((mockCtx.reply as jest.Mock)).toHaveBeenCalledWith(
        expect.stringContaining('✅ 稼働中'),
        expect.objectContaining({ parse_mode: 'Markdown' })
      );
      
      const replyMessage = (mockCtx.reply as jest.Mock).mock.calls[0]?.[0];
      expect(replyMessage).toContain('2件');
      expect(replyMessage).toContain('100回');
      expect(replyMessage).toContain('95.5%');
    });
    
    it('エラー時にエラーメッセージを表示すること', async () => {
      mockScheduler.getStatus.mockRejectedValue(new Error('Database error'));
      
      notifier.setupCommandHandlers(mockScheduler);
      
      const statusHandler = mockCommand.mock.calls.find((call: any[]) => call[0] === 'status')?.[1] as ((ctx: any) => Promise<void>) | undefined;
      if (statusHandler) {
        await statusHandler(mockCtx);
      }
      
      expect((mockCtx.reply as jest.Mock)).toHaveBeenCalledWith('❌ ステータス取得中にエラーが発生しました');
    });
  });

  describe('/stats command', () => {
    it('統計情報を正しく表示すること', async () => {
      const stats: Statistics = {
        totalChecks: 1000,
        errors: 50,
        newListings: 25,
        lastCheck: new Date('2024-01-01T10:00:00'),
        averageExecutionTime: 2.5,
        successRate: 95,
      };
      
      mockScheduler.getStatistics.mockResolvedValue(stats);
      
      notifier.setupCommandHandlers(mockScheduler);
      
      const statsHandler = mockCommand.mock.calls.find((call: any[]) => call[0] === 'stats')?.[1] as ((ctx: any) => Promise<void>) | undefined;
      if (statsHandler) {
        await statsHandler(mockCtx);
      }
      
      expect(mockScheduler.getStatistics).toHaveBeenCalled();
      
      const replyMessage = (mockCtx.reply as jest.Mock).mock.calls[0]?.[0];
      expect(replyMessage).toContain('1000回');
      expect(replyMessage).toContain('95%');
      expect(replyMessage).toContain('2.50秒');
      expect(replyMessage).toContain('25回');
      expect(replyMessage).toContain('50回');
    });
  });

  describe('/check command', () => {
    it('手動チェック結果を正しく表示すること', async () => {
      mockScheduler.runManualCheck.mockResolvedValue({
        urlCount: 3,
        successCount: 2,
        errorCount: 1,
        newPropertyCount: 1,
        executionTime: 5000,
      });
      
      notifier.setupCommandHandlers(mockScheduler);
      
      const checkHandler = mockCommand.mock.calls.find((call: any[]) => call[0] === 'check')?.[1] as ((ctx: any) => Promise<void>) | undefined;
      if (checkHandler) {
        await checkHandler(mockCtx);
      }
      
      // 開始メッセージ
      expect((mockCtx.reply as jest.Mock)).toHaveBeenCalledWith('🔍 手動チェックを開始します...');
      
      // 結果メッセージ
      const resultMessage = (mockCtx.reply as jest.Mock).mock.calls[1]?.[0];
      expect(resultMessage).toContain('3件');
      expect(resultMessage).toContain('成功: 2件');
      expect(resultMessage).toContain('エラー: 1件');
      expect(resultMessage).toContain('🆕 1件');
      expect(resultMessage).toContain('5.0秒');
    });
    
    it('新着がない場合は「なし」と表示すること', async () => {
      mockScheduler.runManualCheck.mockResolvedValue({
        urlCount: 1,
        successCount: 1,
        errorCount: 0,
        newPropertyCount: 0,
        executionTime: 3000,
      });
      
      notifier.setupCommandHandlers(mockScheduler);
      
      const checkHandler = mockCommand.mock.calls.find((call: any[]) => call[0] === 'check')?.[1] as ((ctx: any) => Promise<void>) | undefined;
      if (checkHandler) {
        await checkHandler(mockCtx);
      }
      
      const resultMessage = (mockCtx.reply as jest.Mock).mock.calls[1]?.[0];
      expect(resultMessage).toContain('新着検知: なし');
    });
  });

  describe('/help command', () => {
    it('ヘルプメッセージを表示すること', async () => {
      notifier.setupCommandHandlers(mockScheduler);
      
      const helpHandler = mockCommand.mock.calls.find((call: any[]) => call[0] === 'help')?.[1] as ((ctx: any) => Promise<void>) | undefined;
      if (helpHandler) {
        await helpHandler(mockCtx);
      }
      
      const helpMessage = (mockCtx.reply as jest.Mock).mock.calls[0]?.[0];
      expect(helpMessage).toContain('/status');
      expect(helpMessage).toContain('/stats');
      expect(helpMessage).toContain('/check');
      expect(helpMessage).toContain('/help');
    });
  });

  describe('/start command', () => {
    it('ウェルカムメッセージを表示すること', async () => {
      notifier.setupCommandHandlers(mockScheduler);
      
      const startHandler = mockCommand.mock.calls.find((call: any[]) => call[0] === 'start')?.[1] as ((ctx: any) => Promise<void>) | undefined;
      if (startHandler) {
        await startHandler(mockCtx);
      }
      
      const welcomeMessage = (mockCtx.reply as jest.Mock).mock.calls[0]?.[0];
      expect(welcomeMessage).toContain('ソクブツMVPへようこそ');
      expect(welcomeMessage).toContain('/help');
    });
  });

  describe('Bot lifecycle', () => {
    it('Botを起動できること', async () => {
      mockLaunch.mockResolvedValue(undefined);
      
      await notifier.launchBot();
      
      expect(mockLaunch).toHaveBeenCalled();
    });
    
    it('Botを停止できること', () => {
      notifier.stopBot();
      
      expect(mockStop).toHaveBeenCalled();
    });
    
    it('Bot起動エラーをハンドリングすること', async () => {
      mockLaunch.mockRejectedValue(new Error('Connection failed'));
      
      // エラーが投げられないことを確認
      await expect(notifier.launchBot()).resolves.not.toThrow();
    });
  });
});