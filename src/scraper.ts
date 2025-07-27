import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';

export interface ScrapingResult {
  success: boolean;
  hash: string;
  count: number;
  error?: string;
}

export class SimpleScraper {
  private readonly timeout = 10000;
  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };

  async scrapeAthome(url: string): Promise<ScrapingResult> {
    try {
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: this.timeout,
        maxRedirects: 5
      });

      const $ = cheerio.load(response.data);
      
      // athome.co.jpの物件要素を特定
      const selectors = [
        '.item-cassette',
        '.bukken-item',
        '.property-list-item',
        '[class*="property"]',
        '[class*="bukken"]',
        '[class*="item"]'
      ];

      let properties: string[] = [];
      
      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each((i, el) => {
            const text = $(el).text().replace(/\s+/g, ' ').trim();
            if (text.length > 20) { // 有効な物件情報と判断
              properties.push(text);
            }
          });
          if (properties.length > 0) break;
        }
      }

      if (properties.length === 0) {
        // より広範囲な検索
        const listSelectors = ['ul li', 'div.list > div', 'table tr'];
        for (const selector of listSelectors) {
          const elements = $(selector);
          elements.each((i, el) => {
            const text = $(el).text().replace(/\s+/g, ' ').trim();
            if (text.includes('万円') || text.includes('LDK') || text.includes('駅')) {
              properties.push(text);
            }
          });
          if (properties.length > 5) break;
        }
      }

      const content = properties.join('|');
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      return {
        success: true,
        hash,
        count: properties.length
      };
    } catch (error: any) {
      console.error('スクレイピングエラー:', error.message);
      return {
        success: false,
        hash: '',
        count: 0,
        error: error.message
      };
    }
  }

  async scrapeGeneric(url: string): Promise<ScrapingResult> {
    try {
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: this.timeout
      });

      const $ = cheerio.load(response.data);
      
      // 汎用的な物件リスト検出
      const body = $('body').text().replace(/\s+/g, ' ');
      const hash = crypto.createHash('sha256').update(body).digest('hex');

      return {
        success: true,
        hash,
        count: 1 // 汎用的な変更検知のため
      };
    } catch (error: any) {
      return {
        success: false,
        hash: '',
        count: 0,
        error: error.message
      };
    }
  }
}