import { Injectable, Logger } from '@nestjs/common';
import { ScrapingResult } from '../strategies/google-access.strategy';
import * as crypto from 'crypto';

interface CacheEntry {
  key: string;
  value: ScrapingResult;
  timestamp: Date;
  accessCount: number;
  lastAccessTime: Date;
  size: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  currentSize: number;
  entryCount: number;
}

@Injectable()
export class IntelligentCacheService {
  private readonly logger = new Logger(IntelligentCacheService.name);
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
    currentSize: 0,
    entryCount: 0,
  };

  // キャッシュ設定
  private readonly config = {
    maxSize: 100 * 1024 * 1024, // 100MB
    defaultTTL: 3600 * 1000, // 1時間
    maxEntries: 1000,
    cleanupInterval: 60 * 1000, // 1分
    adaptiveTTL: true, // コンテンツタイプに応じたTTL調整
  };

  constructor() {
    this.startCleanupTask();
  }

  /**
   * キャッシュから取得
   */
  async get(url: string): Promise<ScrapingResult | null> {
    const key = this.generateCacheKey(url);
    const entry = this.cache.get(key);
    
    this.stats.totalRequests++;

    if (!entry) {
      this.stats.misses++;
      this.logger.debug(`Cache miss for ${url}`);
      return null;
    }

    // TTLチェック
    if (this.isExpired(entry)) {
      this.logger.debug(`Cache expired for ${url}`);
      this.evictEntry(key);
      this.stats.misses++;
      return null;
    }

    // アクセス情報を更新
    entry.accessCount++;
    entry.lastAccessTime = new Date();
    
    this.stats.hits++;
    this.logger.debug(`Cache hit for ${url} (access count: ${entry.accessCount})`);
    
    // LRUの実装: 最近アクセスされたエントリを末尾に移動
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }

  /**
   * キャッシュに保存
   */
  async set(url: string, value: ScrapingResult): Promise<void> {
    const key = this.generateCacheKey(url);
    const size = this.calculateSize(value);
    const ttl = this.calculateTTL(url, value);

    // 容量チェック
    if (size > this.config.maxSize * 0.1) { // 単一エントリが10%を超える場合は拒否
      this.logger.warn(`Entry too large to cache: ${url} (${size} bytes)`);
      return;
    }

    // 必要に応じて既存エントリを退避
    await this.ensureCapacity(size);

    const entry: CacheEntry = {
      key,
      value,
      timestamp: new Date(),
      accessCount: 0,
      lastAccessTime: new Date(),
      size,
      ttl,
    };

    this.cache.set(key, entry);
    this.stats.currentSize += size;
    this.stats.entryCount++;
    
    this.logger.debug(`Cached ${url} (size: ${size} bytes, TTL: ${ttl}ms)`);
  }

  /**
   * キャッシュキーの生成
   */
  private generateCacheKey(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  /**
   * データサイズの計算
   */
  private calculateSize(value: ScrapingResult): number {
    const json = JSON.stringify(value);
    return Buffer.byteLength(json, 'utf8');
  }

  /**
   * 適応的TTLの計算
   */
  private calculateTTL(url: string, value: ScrapingResult): number {
    if (!this.config.adaptiveTTL) {
      return this.config.defaultTTL;
    }

    // URLパターンに基づくTTL調整
    const urlPatterns = [
      { pattern: /\/api\//, ttl: 5 * 60 * 1000 }, // API: 5分
      { pattern: /\.(jpg|jpeg|png|gif|webp)$/i, ttl: 24 * 3600 * 1000 }, // 画像: 24時間
      { pattern: /\.(css|js)$/i, ttl: 12 * 3600 * 1000 }, // 静的リソース: 12時間
      { pattern: /\/search\?/, ttl: 30 * 60 * 1000 }, // 検索結果: 30分
    ];

    for (const { pattern, ttl } of urlPatterns) {
      if (pattern.test(url)) {
        return ttl;
      }
    }

    // コンテンツサイズに基づく調整
    const size = this.calculateSize(value);
    if (size > 1024 * 1024) { // 1MB以上
      return this.config.defaultTTL * 2; // より長く保持
    }

    return this.config.defaultTTL;
  }

  /**
   * エントリの有効期限チェック
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = new Date().getTime();
    const entryTime = entry.timestamp.getTime();
    return now - entryTime > entry.ttl;
  }

  /**
   * 容量確保（LRU退避）
   */
  private async ensureCapacity(requiredSize: number): Promise<void> {
    // エントリ数制限チェック
    if (this.cache.size >= this.config.maxEntries) {
      await this.evictLRU(1);
    }

    // 容量制限チェック
    while (this.stats.currentSize + requiredSize > this.config.maxSize) {
      await this.evictLRU(1);
    }
  }

  /**
   * LRU退避
   */
  private async evictLRU(count: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    // アクセス頻度とアクセス時間を考慮したスコア計算
    const scoredEntries = entries.map(([key, entry]) => {
      const ageMs = new Date().getTime() - entry.lastAccessTime.getTime();
      const accessRate = entry.accessCount / (ageMs / 1000 / 60); // アクセス/分
      const score = accessRate * 1000 + (1 / ageMs); // 高頻度・最近のアクセスほど高スコア
      
      return { key, entry, score };
    });

    // スコアの低い順にソート
    scoredEntries.sort((a, b) => a.score - b.score);

    // 指定数退避
    for (let i = 0; i < Math.min(count, scoredEntries.length); i++) {
      const { key } = scoredEntries[i];
      this.evictEntry(key);
    }
  }

  /**
   * エントリの退避
   */
  private evictEntry(key: string): void {
    const entry = this.cache.get(key);
    
    if (entry) {
      this.cache.delete(key);
      this.stats.currentSize -= entry.size;
      this.stats.entryCount--;
      this.stats.evictions++;
      
      this.logger.debug(`Evicted cache entry: ${key}`);
    }
  }

  /**
   * クリーンアップタスクの開始
   */
  private startCleanupTask(): void {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 期限切れエントリのクリーンアップ
   */
  private cleanup(): void {
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.evictEntry(key));
    
    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * キャッシュのクリア
   */
  clear(): void {
    this.cache.clear();
    this.stats.currentSize = 0;
    this.stats.entryCount = 0;
    this.logger.log('Cache cleared');
  }

  /**
   * キャッシュ統計の取得
   */
  getStats(): CacheStats & {
    hitRate: number;
    averageEntrySize: number;
    utilizationRate: number;
  } {
    const hitRate = this.stats.totalRequests > 0 
      ? this.stats.hits / this.stats.totalRequests 
      : 0;
      
    const averageEntrySize = this.stats.entryCount > 0
      ? this.stats.currentSize / this.stats.entryCount
      : 0;
      
    const utilizationRate = this.stats.currentSize / this.config.maxSize;

    return {
      ...this.stats,
      hitRate,
      averageEntrySize,
      utilizationRate,
    };
  }

  /**
   * キャッシュのウォームアップ（事前読み込み）
   */
  async warmup(urls: string[]): Promise<void> {
    this.logger.log(`Warming up cache with ${urls.length} URLs`);
    
    // 並列でプリフェッチ（ただし実際のスクレイピングは行わない）
    // この実装では、キャッシュのウォームアップロジックのみ示す
    for (const url of urls) {
      const key = this.generateCacheKey(url);
      
      if (!this.cache.has(key)) {
        // 実際のアプリケーションでは、ここでスクレイピングを実行
        this.logger.debug(`Would prefetch: ${url}`);
      }
    }
  }
}