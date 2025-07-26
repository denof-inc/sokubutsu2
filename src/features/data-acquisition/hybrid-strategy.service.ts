import { Injectable, Logger } from '@nestjs/common';
import { ApiClientService } from './api-client.service';
import { FeedParserService } from './feed-parser.service';
import { ScrapingService } from '../scraping/scraping.service';

interface DataAcquisitionResult {
  success: boolean;
  hasNewListings: boolean;
  data?: any;
  strategy: string;
  priority: number;
  error?: string;
}

@Injectable()
export class HybridStrategyService {
  private readonly logger = new Logger(HybridStrategyService.name);

  constructor(
    private readonly apiClientService: ApiClientService,
    private readonly feedParserService: FeedParserService,
    private readonly scrapingService: ScrapingService,
  ) {}

  async acquireData(
    url: string,
    selector: string,
  ): Promise<DataAcquisitionResult> {
    const strategies = [
      { name: 'API', method: () => this.tryApiAccess(url), priority: 1 },
      { name: 'RSS/Atom', method: () => this.tryFeedAccess(url), priority: 2 },
      {
        name: 'Light Scraping',
        method: () => this.tryLightScraping(url, selector),
        priority: 3,
      },
      {
        name: 'Full Scraping',
        method: () => this.tryFullScraping(url, selector),
        priority: 4,
      },
    ];

    for (const strategy of strategies) {
      try {
        this.logger.log(`${strategy.name}戦略を試行: ${url}`);
        const result = await strategy.method();

        if (result.success) {
          this.logger.log(`${strategy.name}戦略で成功: ${url}`);
          return {
            ...result,
            strategy: strategy.name,
            priority: strategy.priority,
          };
        }
      } catch (error) {
        this.logger.warn(`${strategy.name}戦略失敗: ${error.message}`);
      }
    }

    return {
      success: false,
      error: '全ての取得戦略が失敗',
      hasNewListings: false,
      strategy: 'NONE',
      priority: 0,
    };
  }

  private async tryApiAccess(url: string): Promise<DataAcquisitionResult> {
    const domain = new URL(url).hostname;

    // 既知のAPIエンドポイントを試行
    const apiEndpoints =
      await this.apiClientService.discoverApiEndpoints(domain);

    for (const endpoint of apiEndpoints) {
      try {
        const data = await this.apiClientService.fetchData(endpoint);

        if (data && data.listings) {
          return {
            success: true,
            hasNewListings: this.detectNewListings(data.listings),
            data: data.listings,
            strategy: 'API',
            priority: 1,
          };
        }
      } catch (error) {
        this.logger.debug(
          `APIエンドポイント失敗: ${endpoint} - ${error.message}`,
        );
      }
    }

    throw new Error('利用可能なAPIが見つかりません');
  }

  private async tryFeedAccess(url: string): Promise<DataAcquisitionResult> {
    const domain = new URL(url).hostname;

    // RSS/Atomフィードの検索
    const feedUrls = await this.feedParserService.discoverFeeds(domain);

    for (const feedUrl of feedUrls) {
      try {
        const feedData = await this.feedParserService.parseFeed(feedUrl);

        if (feedData && feedData.items.length > 0) {
          return {
            success: true,
            hasNewListings: this.detectNewListingsFromFeed(feedData.items),
            data: feedData.items,
            strategy: 'RSS/Atom',
            priority: 2,
          };
        }
      } catch (error) {
        this.logger.debug(`フィード解析失敗: ${feedUrl} - ${error.message}`);
      }
    }

    throw new Error('利用可能なフィードが見つかりません');
  }

  private async tryLightScraping(
    url: string,
    selector: string,
  ): Promise<DataAcquisitionResult> {
    // HTTP + JSDOM による軽量スクレイピング
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const hasNewListings = this.analyzeHtmlForNewListings(html);

      return {
        success: true,
        hasNewListings,
        data: { html, analyzedAt: new Date() },
        strategy: 'Light Scraping',
        priority: 3,
      };
    } catch (error) {
      throw new Error(`軽量スクレイピング失敗: ${error.message}`);
    }
  }

  private async tryFullScraping(
    url: string,
    selector: string,
  ): Promise<DataAcquisitionResult> {
    // 既存のPlaywrightベースのスクレイピング
    const hash = await this.scrapingService.scrapeAndGetHash(url, selector, {
      useGoogleSearch: true,
      searchQuery: this.generateSearchQuery(url),
    });

    if (hash) {
      return {
        success: true,
        hasNewListings: true, // ハッシュが取得できた場合は新着とみなす
        data: { hash, scrapedAt: new Date() },
        strategy: 'Full Scraping',
        priority: 4,
      };
    }

    throw new Error('フルスクレイピング失敗');
  }

  private detectNewListings(listings: any[]): boolean {
    // 新着物件の検知ロジック
    return listings.some((listing) => {
      const publishedDate = new Date(listing.publishedAt || listing.createdAt);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return publishedDate > oneDayAgo;
    });
  }

  private detectNewListingsFromFeed(items: any[]): boolean {
    // フィードアイテムからの新着検知
    return items.some((item) => {
      const publishedDate = new Date(item.pubDate || item.published);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return publishedDate > oneDayAgo;
    });
  }

  private analyzeHtmlForNewListings(html: string): boolean {
    // HTMLコンテンツの分析による新着検知
    const newListingIndicators = [
      '新着',
      '本日公開',
      '今日の新着',
      'NEW',
      'new',
      '最新',
      '更新',
    ];

    return newListingIndicators.some((indicator) => html.includes(indicator));
  }

  private generateSearchQuery(url: string): string {
    const domain = new URL(url).hostname;

    const siteQueries: { [key: string]: string } = {
      'athome.co.jp': 'アットホーム 賃貸 物件検索',
      'suumo.jp': 'SUUMO スーモ 不動産',
      'homes.co.jp': 'ホームズ 賃貸 マンション',
      'chintai.mynavi.jp': 'マイナビ賃貸 物件情報',
    };

    return siteQueries[domain] || `${domain} 不動産 物件`;
  }
}
