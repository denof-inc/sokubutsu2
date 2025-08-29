import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import axios from 'axios';
import type { ScrapingResult } from '../types.js';

// axios をモック化
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
(mockedAxios.get as any) = jest.fn();

// PuppeteerScraper をモック化
const mockScrapingResult: ScrapingResult = {
  success: false,
  error: 'Puppeteer mock error',
  count: 0,
  properties: [],
  hash: '',
  executionTime: 1000,
  memoryUsage: 100,
};

jest.unstable_mockModule('../scraper-puppeteer.js', () => ({
  PuppeteerScraper: jest.fn().mockImplementation(() => ({
    scrapeAthome: jest
      .fn<() => Promise<ScrapingResult>>()
      .mockImplementation(() => Promise.resolve(mockScrapingResult)),
  })),
}));

// config をモック化 (puppeteer_firstフォールバックを無効化)
jest.unstable_mockModule('../config.js', () => ({
  config: {
    scraping: {
      strategy: 'http_first', // 現仕様では未使用だが互換のため
    },
    monitoring: {
      httpTimeoutMs: 5000,
    },
    storage: {
      dataDir: './data',
    },
    database: {
      database: './data/test.db',
      synchronize: true,
      logging: false,
    },
    app: {
      env: 'test',
      port: 0,
    },
  },
}));

// モック後に対象をインポート
const { SimpleScraper } = await import('../scraper.js');

describe('SimpleScraper', () => {
  let scraper: any;

  beforeEach(() => {
    scraper = new SimpleScraper();
    jest.clearAllMocks();
  });

  describe('scrapeAthome', () => {
    it('正常なHTMLを処理できること', async () => {
      // Puppeteer-only戦略: PuppeteerScraperの結果に追随
      (mockScrapingResult as any).success = true;
      (mockScrapingResult as any).count = 3;
      (mockScrapingResult as any).hash = 'hash-ok';
      (mockScrapingResult as any).properties = [{}, {}, {}];

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(result.hash).toBeDefined();
      expect(result.executionTime).toBeDefined();
      expect(result.memoryUsage).toBeDefined();
    }, 30000);

    it('物件が見つからない場合はエラーを返すこと', async () => {
      (mockScrapingResult as any).success = false;
      (mockScrapingResult as any).error = '物件要素が見つかりませんでした';

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('物件要素が見つかりませんでした');
    }, 30000);

    it('ネットワークエラーを適切に処理すること', async () => {
      (mockScrapingResult as any).success = false;
      (mockScrapingResult as any).error = 'HTTP 500 Server Error';

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500 Server Error');
    }, 30000); // タイムアウトを30秒に増加

    it('Puppeteerの成功結果に追随すること', async () => {
      (mockScrapingResult as any).success = true;
      (mockScrapingResult as any).count = 1;
      (mockScrapingResult as any).hash = 'hash-retry-ok';
      (mockScrapingResult as any).properties = [{}];

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    }, 30000); // タイムアウトを30秒に設定
  });

  describe('validateResult', () => {
    it('正常な結果を検証できること', () => {
      const result = {
        success: true,
        hash: 'abc123',
        count: 5,
        executionTime: 3000,
        memoryUsage: 40,
      };

      expect(scraper.validateResult(result)).toBe(true);
    });

    it('失敗結果を適切に検証すること', () => {
      const result = {
        success: false,
        hash: '',
        count: 0,
        error: 'Test error',
      };

      expect(scraper.validateResult(result)).toBe(false);
    });
  });
});
