/**
 * スクレイピング関連の型定義
 */

// スクレイピング結果の基本インターフェース
export interface ScrapingResult {
  success: boolean;
  url: string;
  method: 'http-only' | 'jsdom' | 'playwright' | 'ultra-fast';
  executionTime: number;
  timestamp: Date;
  content?: string;
  error?: string;
  metadata?: ScrapingMetadata;
}

// スクレイピングメタデータ
export interface ScrapingMetadata {
  statusCode?: number;
  headers?: Record<string, string>;
  redirects?: string[];
  userAgent?: string;
  retryCount?: number;
}

// 物件情報インターフェース
export interface PropertyInfo {
  id: string;
  title: string;
  url: string;
  price?: number;
  location?: string;
  area?: number;
  publishedAt?: Date;
  description?: string;
  images?: string[];
}

// 新着判定結果
export interface NewArrivalCheckResult {
  hasNewArrivals: boolean;
  newProperties: PropertyInfo[];
  totalCount: number;
  checkedAt: Date;
  contentHash: string;
}

// スクレイピング設定
export interface ScrapingConfig {
  timeout?: number;
  retryCount?: number;
  userAgent?: string;
  headers?: Record<string, string>;
  enableJavaScript?: boolean;
  enableBotProtection?: boolean;
}

// 型ガード関数
export function isScrapingResult(value: unknown): value is ScrapingResult {
  const obj = value as ScrapingResult;
  return (
    obj &&
    typeof obj.success === 'boolean' &&
    typeof obj.url === 'string' &&
    typeof obj.method === 'string' &&
    typeof obj.executionTime === 'number'
  );
}

export function isPropertyInfo(value: unknown): value is PropertyInfo {
  const obj = value as PropertyInfo;
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.url === 'string'
  );
}
