import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleScraper } from '../scraper';
import axios from 'axios';

// axios をモック化
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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

      mockedAxios.get.mockResolvedValue({
        data: testHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(result.hash).toBeDefined();
      expect(result.executionTime).toBeDefined();
      expect(result.memoryUsage).toBeDefined();
    });

    it('物件が見つからない場合はエラーを返すこと', async () => {
      const testHtml = '<html><body><p>物件なし</p></body></html>';

      mockedAxios.get.mockResolvedValue({
        data: testHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('物件要素が見つかりませんでした');
    });

    it('ネットワークエラーを適切に処理すること', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network Error');
    });

    it('リトライ機能が動作すること', async () => {
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Temporary Error'))
        .mockRejectedValueOnce(new Error('Temporary Error'))
        .mockResolvedValue({
          data: '<html><body><div class="property">物件1</div></body></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        });

      const result = await scraper.scrapeAthome('https://example.com');

      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
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
