import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Parser } from 'xml2js';

interface RssItem {
  title?: string[];
  link?: string[];
  description?: string[];
  pubDate?: string[];
  guid?: Array<string | { _: string }>;
}

interface RssChannel {
  title?: string[];
  item?: RssItem[];
}

interface RssFeed {
  channel: RssChannel[];
}

interface AtomEntry {
  title?: Array<string | { _: string }>;
  link?: Array<{ $: { href: string } }>;
  summary?: Array<string | { _: string }>;
  content?: Array<string | { _: string }>;
  updated?: string[];
  published?: string[];
  id?: Array<string | { _: string }>;
}

interface AtomFeed {
  title?: Array<string | { _: string }>;
  entry?: AtomEntry[];
}

interface ParsedXml {
  rss?: RssFeed;
  feed?: AtomFeed;
}

interface FeedData {
  type: 'RSS' | 'Atom';
  title: string;
  items: Array<{
    title: string;
    link: string;
    description: string;
    pubDate: Date;
    guid: string;
  }>;
}

@Injectable()
export class FeedParserService {
  private readonly logger = new Logger(FeedParserService.name);
  private readonly parser = new Parser();

  async discoverFeeds(domain: string): Promise<string[]> {
    const feedUrls: string[] = [];

    // 一般的なフィードパスを確認
    const commonFeedPaths = [
      '/rss',
      '/rss.xml',
      '/feed',
      '/feed.xml',
      '/atom.xml',
      '/feeds/properties',
      '/rss/properties',
      '/feed/listings',
    ];

    for (const path of commonFeedPaths) {
      const url = `https://${domain}${path}`;

      if (await this.checkFeedExists(url)) {
        feedUrls.push(url);
      }
    }

    // HTMLページからフィードリンクを検索
    try {
      const htmlFeeds = await this.extractFeedLinksFromHtml(domain);
      feedUrls.push(...htmlFeeds);
    } catch (error) {
      this.logger.debug(
        `HTML解析失敗: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return [...new Set(feedUrls)]; // 重複を除去
  }

  private async checkFeedExists(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        validateStatus: (status) => status === 200,
      });

      const contentType = response.headers['content-type'] as
        | string
        | undefined;

      return (
        response.status === 200 &&
        !!(
          contentType?.includes('application/rss+xml') ||
          contentType?.includes('application/atom+xml') ||
          contentType?.includes('application/xml') ||
          contentType?.includes('text/xml')
        )
      );
    } catch {
      return false;
    }
  }

  private async extractFeedLinksFromHtml(domain: string): Promise<string[]> {
    try {
      const response = await axios.get<string>(`https://${domain}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PropertyBot/1.0)',
        },
      });

      const html: string = response.data;
      const feedLinkRegex =
        /<link[^>]*(?:type=["']application\/(?:rss|atom)\+xml["']|rel=["']alternate["'])[^>]*href=["']([^"']+)["'][^>]*>/gi;
      const feedUrls: string[] = [];
      let match;

      while ((match = feedLinkRegex.exec(html)) !== null) {
        let feedUrl = String(match[1]);

        // 相対URLを絶対URLに変換
        if (feedUrl.startsWith('/')) {
          feedUrl = `https://${domain}${feedUrl}`;
        } else if (!feedUrl.startsWith('http')) {
          feedUrl = `https://${domain}/${feedUrl}`;
        }

        feedUrls.push(feedUrl);
      }

      return feedUrls;
    } catch (error) {
      throw new Error(
        `HTMLフィード抽出失敗: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async parseFeed(feedUrl: string): Promise<FeedData> {
    try {
      const response = await axios.get<string>(feedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PropertyBot/1.0)',
        },
      });

      const feedContent: string = response.data;
      const result = (await this.parser.parseStringPromise(
        feedContent,
      )) as ParsedXml;

      // RSS/Atomフィードの解析
      if (result.rss) {
        return this.parseRssFeed(result.rss);
      } else if (result.feed) {
        return this.parseAtomFeed(result.feed);
      } else {
        throw new Error('未対応のフィード形式');
      }
    } catch (error) {
      throw new Error(
        `フィード解析失敗: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private parseRssFeed(rss: RssFeed): FeedData {
    const channel = rss.channel[0];
    const items = channel.item || [];

    return {
      type: 'RSS',
      title: channel.title?.[0] || '',
      items: items.map((item) => ({
        title: item.title?.[0] || '',
        link: item.link?.[0] || '',
        description: item.description?.[0] || '',
        pubDate: new Date(item.pubDate?.[0] || Date.now()),
        guid:
          typeof item.guid?.[0] === 'object' && item.guid[0]._
            ? String(item.guid[0]._)
            : String(
                typeof item.guid?.[0] === 'string'
                  ? item.guid[0]
                  : typeof item.link?.[0] === 'string'
                    ? item.link[0]
                    : '',
              ),
      })),
    };
  }

  private parseAtomFeed(feed: AtomFeed): FeedData {
    const entries = feed.entry || [];

    return {
      type: 'Atom',
      title:
        typeof feed.title?.[0] === 'object' && feed.title[0]._
          ? String(feed.title[0]._)
          : String(typeof feed.title?.[0] === 'string' ? feed.title[0] : ''),
      items: entries.map((entry) => ({
        title:
          typeof entry.title?.[0] === 'object' && entry.title[0]._
            ? String(entry.title[0]._)
            : String(
                typeof entry.title?.[0] === 'string' ? entry.title[0] : '',
              ),
        link: entry.link?.[0]?.$.href || '',
        description:
          typeof entry.summary?.[0] === 'object' && entry.summary[0]._
            ? String(entry.summary[0]._)
            : String(
                (typeof entry.summary?.[0] === 'string'
                  ? entry.summary[0]
                  : '') ||
                  (typeof entry.content?.[0] === 'object' && entry.content[0]?._
                    ? entry.content[0]._
                    : typeof entry.content?.[0] === 'string'
                      ? entry.content[0]
                      : ''),
              ),
        pubDate: new Date(
          entry.published?.[0] || entry.updated?.[0] || Date.now(),
        ),
        guid:
          typeof entry.id?.[0] === 'object' && entry.id[0]._
            ? String(entry.id[0]._)
            : String(typeof entry.id?.[0] === 'string' ? entry.id[0] : ''),
      })),
    };
  }
}
