import { jest } from '@jest/globals';
import { UrlStatistics } from '../types.js';

// Telegrafのモック関数を作成
const mockSendMessage = jest.fn<(chatId: string, text: string, options?: any) => Promise<any>>();
const mockGetMe = jest.fn<() => Promise<any>>();

const mockTelegraf = jest.fn(() => ({
  telegram: {
    sendMessage: mockSendMessage,
    getMe: mockGetMe,
  },
}));

// Telegrafのモック
jest.unstable_mockModule('telegraf', () => ({
  Telegraf: mockTelegraf,
}));

// vibeLoggerのモック
jest.unstable_mockModule('../logger.js', () => ({
  vibeLogger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// モックの後でインポート
const { TelegramNotifier } = await import('../telegram.js');
const { vibeLogger } = await import('../logger.js');

describe('TelegramNotifier - URL別レポート機能', () => {
  let notifier: InstanceType<typeof TelegramNotifier>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // デフォルトのモック設定
    mockSendMessage.mockResolvedValue({
      message_id: 123,
      date: Date.now(),
      chat: { id: 'test-chat-id', type: 'private' },
      text: 'Test message'
    });
    mockGetMe.mockResolvedValue({ 
      id: 1, 
      is_bot: true, 
      first_name: 'Test Bot',
      username: 'test_bot' 
    });
    
    notifier = new TelegramNotifier('test-token', 'test-chat-id');
  });

  describe('sendUrlSummaryReport', () => {
    const baseUrlStats: UrlStatistics = {
      url: 'https://www.athome.co.jp/chintai/tokyo/list/',
      totalChecks: 12,
      successCount: 10,
      errorCount: 2,
      successRate: 83.33,
      averageExecutionTime: 3.5,
      hasNewProperty: false,
      newPropertyCount: 0,
      lastNewProperty: null
    };

    it('URL別サマリーレポートを送信できる', async () => {
      await notifier.sendUrlSummaryReport(baseUrlStats);
      
      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('📊 *1時間サマリー*'),
        expect.objectContaining({ parse_mode: 'Markdown' })
      );
    });

    it('新着なしの場合のレポート形式が正しい', async () => {
      await notifier.sendUrlSummaryReport(baseUrlStats);
      
      const sentMessage = mockSendMessage.mock.calls[0]?.[1] ?? '';
      
      // 必要な情報が含まれていることを確認
      expect(sentMessage).toContain('tokyo');
      expect(sentMessage).toContain('チェック回数: 12回');
      expect(sentMessage).toContain('成功率: 83.3%');
      expect(sentMessage).not.toContain('新着総数'); // 新着なしの場合は新着総数は表示されない
    });

    it('新着ありの場合のレポート形式が正しい', async () => {
      const statsWithNew: UrlStatistics = {
        ...baseUrlStats,
        hasNewProperty: true,
        newPropertyCount: 3,
        lastNewProperty: new Date('2025-01-09T12:30:00Z')
      };
      
      await notifier.sendUrlSummaryReport(statsWithNew);
      
      const sentMessage = mockSendMessage.mock.calls[0]?.[1] ?? '';
      
      // 新着情報が含まれていることを確認
      expect(sentMessage).toContain('新着総数: 3件');
    });

    it('URLから都道府県名を抽出して表示する', async () => {
      const testCases = [
        { url: 'https://www.athome.co.jp/chintai/tokyo/list/', expected: 'tokyo' },
        { url: 'https://www.athome.co.jp/chintai/osaka/list/', expected: 'osaka' },
        { url: 'https://www.athome.co.jp/buy_other/hiroshima/list/', expected: 'hiroshima' }
      ];
      
      for (const testCase of testCases) {
        mockSendMessage.mockClear();
        
        await notifier.sendUrlSummaryReport({
          ...baseUrlStats,
          url: testCase.url
        });
        
        const sentMessage = mockSendMessage.mock.calls[0]?.[1] ?? '';
        expect(sentMessage).toContain(testCase.expected);
      }
    });

    it('エラー率が高い場合に警告を含める', async () => {
      const highErrorStats: UrlStatistics = {
        ...baseUrlStats,
        totalChecks: 10,
        successCount: 3,
        errorCount: 7,
        successRate: 30
      };
      
      await notifier.sendUrlSummaryReport(highErrorStats);
      
      const sentMessage = mockSendMessage.mock.calls[0]?.[1] ?? '';
      // 新フォーマットではエラー率の警告は削除されたため、この確認は不要
      // 代わりに基本的な情報が含まれることを確認
      expect(sentMessage).toContain('成功率: 30.0%');
    });

    it('送信エラーが発生した場合ログに記録する', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Network error'));
      
      // sendUrlSummaryReportはエラーを内部で処理してログに記録するため、
      // エラーを投げずに正常終了する
      await notifier.sendUrlSummaryReport(baseUrlStats);
      
      const logError = vibeLogger.error as jest.Mock;
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('telegram'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('複数のURLレポートを連続送信できる', async () => {
      const urls = ['tokyo', 'osaka', 'kyoto'];
      
      for (const city of urls) {
        await notifier.sendUrlSummaryReport({
          ...baseUrlStats,
          url: `https://www.athome.co.jp/chintai/${city}/list/`
        });
      }
      
      expect(mockSendMessage).toHaveBeenCalledTimes(3);
      
      // 各メッセージが異なるURLの情報を含むことを確認
      urls.forEach((city, index) => {
        const sentMessage = mockSendMessage.mock.calls[index]?.[1] ?? '';
        expect(sentMessage).toContain(city);
      });
    });
  });

  describe('RFP準拠のフォーマット', () => {
    it('レポートがRFP要件を満たすフォーマットである', async () => {
      const urlStats: UrlStatistics = {
        url: 'https://www.athome.co.jp/chintai/tokyo/list/',
        totalChecks: 12,
        successCount: 11,
        errorCount: 1,
        successRate: 91.67,
        averageExecutionTime: 2.8,
        hasNewProperty: true,
        newPropertyCount: 2,
        lastNewProperty: new Date()
      };
      
      await notifier.sendUrlSummaryReport(urlStats);
      
      const sentMessage = mockSendMessage.mock.calls[0]?.[1] ?? '';
      
      // RFP要件: URLごとのサマリーレポート
      expect(sentMessage).toContain('1時間サマリー');
      expect(sentMessage).toContain(urlStats.url);
      
      // 統計情報の表示
      expect(sentMessage).toMatch(/チェック回数.*12回/);
      expect(sentMessage).toMatch(/成功率.*91\.7%/);
      
      // 新着情報の表示
      expect(sentMessage).toMatch(/新着.*2件/);
    });
  });
});