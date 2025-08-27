import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleScraper } from '../scraper.js';
import axios, { AxiosResponse } from 'axios';
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

jest.mock('../scraper-puppeteer.js', () => ({
  PuppeteerScraper: jest.fn().mockImplementation(() => ({
    scrapeAthome: jest.fn<() => Promise<ScrapingResult>>().mockResolvedValue(mockScrapingResult),
  })),
}));

// config をモック化 (puppeteer_firstフォールバックを無効化)
jest.mock('../config.js', () => ({
  config: {
    scraping: {
      strategy: 'http_first', // puppeteer_firstフォールバックを無効化
    },
    monitoring: {
      httpTimeoutMs: 5000,
    },
  },
}));

describe('SimpleScraper', () => {
  let scraper: SimpleScraper;

  beforeEach(() => {
    scraper = new SimpleScraper();
    jest.clearAllMocks();
  });

  describe('scrapeAthome', () => {
    it('正常なHTMLを処理できること', async () => {
      // テスト用HTML
      const testHtml = `
        <html>
          <body>
            <div class="property">物件1</div>
            <div class="property">物件2</div>
            <div class="property">物件3</div>
          </body>
        </html>
      `;

      const mockResponse: AxiosResponse = {
        data: testHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      (mockedAxios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue(mockResponse);

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(result.hash).toBeDefined();
      expect(result.executionTime).toBeDefined();
      expect(result.memoryUsage).toBeDefined();
    }, 30000);

    it('物件が見つからない場合はエラーを返すこと', async () => {
      const testHtml = '<html><body><p>物件なし</p></body></html>';

      const mockResponse: AxiosResponse = {
        data: testHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      (mockedAxios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue(mockResponse);

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('物件要素が見つかりませんでした');
    }, 30000);

    it('ネットワークエラーを適切に処理すること', async () => {
      (mockedAxios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValue(
        new Error('HTTP 500 Server Error')
      );

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500 Server Error');
    }, 30000); // タイムアウトを30秒に増加

    it('リトライ機能が動作すること', async () => {
      const mockSuccessResponse: AxiosResponse = {
        data: '<html><body><div class="property">物件1</div></body></html>',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      (mockedAxios.get as jest.MockedFunction<typeof axios.get>)
        .mockRejectedValueOnce(new Error('HTTP 503 Service Unavailable'))
        .mockRejectedValueOnce(new Error('HTTP 503 Service Unavailable'))
        .mockResolvedValue(mockSuccessResponse);

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
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
