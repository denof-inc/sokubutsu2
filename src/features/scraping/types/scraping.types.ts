/**
 * スクレイピング関連の型定義
 */

export interface ScrapeResult {
  hash: string | null;
  method: 'http' | 'jsdom' | 'playwright' | 'google-playwright';
  error?: string;
  success?: boolean;
}

export interface ScrapeOptions {
  useGoogleSearch?: boolean;
  searchQuery?: string;
  testBotDetection?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export type ErrorType = 'RECOVERABLE' | 'UNRECOVERABLE' | 'BOT_DETECTED';

export interface ScrapingMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: Date | null;
}

export interface CacheEntry {
  url: string;
  hash: string;
  timestamp: Date;
  method: string;
}

export interface BrowserConfig {
  headless: boolean;
  timeout: number;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
}
