import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as xml2js from 'xml2js';

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
  private readonly parser = new xml2js.Parser();
  
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
      '/feed/listings'
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
      this.logger.debug(`HTML解析失敗: ${error.message}`);
    }
    
    return [...new Set(feedUrls)]; // 重複を除去
  }
  
  private async checkFeedExists(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        validateStatus: (status) => status === 200
      });
      
      const contentType = response.headers['content-type'];
      
      return response.status === 200 && (
        contentType?.includes('application/rss+xml') ||
        contentType?.includes('application/atom+xml') ||
        contentType?.includes('application/xml') ||
        contentType?.includes('text/xml')
      );
      
    } catch (error) {
      return false;
    }
  }
  
  private async extractFeedLinksFromHtml(domain: string): Promise<string[]> {
    try {
      const response = await axios.get(`https://${domain}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PropertyBot/1.0)'
        }
      });
      
      const html = response.data;
      const feedLinkRegex = /<link[^>]*(?:type=["']application\/(?:rss|atom)\+xml["']|rel=["']alternate["'])[^>]*href=["']([^"']+)["'][^>]*>/gi;
      const feedUrls: string[] = [];
      let match;
      
      while ((match = feedLinkRegex.exec(html)) !== null) {
        let feedUrl = match[1];
        
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
      throw new Error(`HTMLフィード抽出失敗: ${error.message}`);
    }
  }
  
  async parseFeed(feedUrl: string): Promise<FeedData> {
    try {
      const response = await axios.get(feedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PropertyBot/1.0)'
        }
      });
      
      const feedContent = response.data;
      const result = await this.parser.parseStringPromise(feedContent);
      
      // RSS/Atomフィードの解析
      if (result.rss) {
        return this.parseRssFeed(result.rss);
      } else if (result.feed) {
        return this.parseAtomFeed(result.feed);
      } else {
        throw new Error('未対応のフィード形式');
      }
      
    } catch (error) {
      throw new Error(`フィード解析失敗: ${error.message}`);
    }
  }
  
  private parseRssFeed(rss: any): FeedData {
    const channel = rss.channel[0];
    const items = channel.item || [];
    
    return {
      type: 'RSS',
      title: channel.title?.[0] || '',
      items: items.map((item: any) => ({
        title: item.title?.[0] || '',
        link: item.link?.[0] || '',
        description: item.description?.[0] || '',
        pubDate: new Date(item.pubDate?.[0] || Date.now()),
        guid: item.guid?.[0]?._ || item.guid?.[0] || item.link?.[0] || ''
      }))
    };
  }
  
  private parseAtomFeed(feed: any): FeedData {
    const entries = feed.entry || [];
    
    return {
      type: 'Atom',
      title: feed.title?.[0]?._ || feed.title?.[0] || '',
      items: entries.map((entry: any) => ({
        title: entry.title?.[0]?._ || entry.title?.[0] || '',
        link: entry.link?.[0]?.$.href || '',
        description: entry.summary?.[0]?._ || entry.summary?.[0] || entry.content?.[0]?._ || entry.content?.[0] || '',
        pubDate: new Date(entry.published?.[0] || entry.updated?.[0] || Date.now()),
        guid: entry.id?.[0] || ''
      }))
    };
  }
}