import { jest } from '@jest/globals';
import { TelegramNotifier } from '../telegram.js';
import { UrlStatistics } from '../types.js';
import { vibeLogger } from '../logger.js';

// node-telegram-bot-apiのモック
jest.mock('node-telegram-bot-api');
jest.mock('../logger.js');

describe('TelegramNotifier - URL別レポート機能', () => {
  let notifier: TelegramNotifier;
  let mockBot: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Telegram Botのモック
    mockBot = {
      sendMessage: jest.fn<Promise<any>, [string, string, any?]>().mockResolvedValue({ message_id: 123 }),
      getMe: jest.fn<Promise<any>, []>().mockResolvedValue({ id: 1, is_bot: true, username: 'test_bot' })
    };
    
    // node-telegram-bot-apiモジュールのモック
    const TelegramBot = require('node-telegram-bot-api');
    TelegramBot.mockImplementation(() => mockBot);
    
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
      
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('📊 URLサマリーレポート'),
        expect.objectContaining({ parse_mode: 'Markdown' })
      );
    });

    it('新着なしの場合のレポート形式が正しい', async () => {
      await notifier.sendUrlSummaryReport(baseUrlStats);
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      
      // 必要な情報が含まれていることを確認
      expect(sentMessage).toContain('tokyo');
      expect(sentMessage).toContain('総チェック数: 12回');
      expect(sentMessage).toContain('成功率: 83.33%');
      expect(sentMessage).toContain('平均実行時間: 3.50秒');
      expect(sentMessage).toContain('新着物件: なし');
    });

    it('新着ありの場合のレポート形式が正しい', async () => {
      const statsWithNew: UrlStatistics = {
        ...baseUrlStats,
        hasNewProperty: true,
        newPropertyCount: 3,
        lastNewProperty: new Date('2025-01-09T12:30:00Z')
      };
      
      await notifier.sendUrlSummaryReport(statsWithNew);
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      
      // 新着情報が含まれていることを確認
      expect(sentMessage).toContain('🆕 新着物件: 3件');
      expect(sentMessage).toContain('最終検知:');
    });

    it('URLから都道府県名を抽出して表示する', async () => {
      const testCases = [
        { url: 'https://www.athome.co.jp/chintai/tokyo/list/', expected: 'tokyo' },
        { url: 'https://www.athome.co.jp/chintai/osaka/list/', expected: 'osaka' },
        { url: 'https://www.athome.co.jp/buy_other/hiroshima/list/', expected: 'hiroshima' }
      ];
      
      for (const testCase of testCases) {
        mockBot.sendMessage.mockClear();
        
        await notifier.sendUrlSummaryReport({
          ...baseUrlStats,
          url: testCase.url
        });
        
        const sentMessage = mockBot.sendMessage.mock.calls[0][1];
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
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      expect(sentMessage).toContain('⚠️');
    });

    it('送信エラーが発生した場合ログに記録する', async () => {
      mockBot.sendMessage.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(
        notifier.sendUrlSummaryReport(baseUrlStats)
      ).rejects.toThrow('Network error');
      
      expect(vibeLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('url_summary_report'),
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
      
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(3);
      
      // 各メッセージが異なるURLの情報を含むことを確認
      urls.forEach((city, index) => {
        const sentMessage = mockBot.sendMessage.mock.calls[index][1];
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
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      
      // RFP要件: URLごとのサマリーレポート
      expect(sentMessage).toContain('URLサマリーレポート');
      expect(sentMessage).toContain(urlStats.url);
      
      // 統計情報の表示
      expect(sentMessage).toMatch(/総チェック数.*12回/);
      expect(sentMessage).toMatch(/成功率.*91\.67%/);
      
      // 新着情報の表示
      expect(sentMessage).toMatch(/新着物件.*2件/);
    });
  });
});