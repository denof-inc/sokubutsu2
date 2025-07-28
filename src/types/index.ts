/**
 * アプリケーション全体の型定義
 *
 * @設計ドキュメント
 * - docs/システム設計書.md: データモデル定義
 * - docs/API仕様書.md: インターフェース定義
 *
 * @関連クラス
 * - すべてのクラスがこれらの型定義を利用
 */

/**
 * 設定オブジェクトの型定義
 */
export interface Config {
  telegram: {
    botToken: string;
    chatId: string;
  };
  monitoring: {
    urls: string[];
    interval: string;
  };
  app: {
    port: number;
    env: string;
  };
  storage: {
    dataDir: string;
  };
}

/**
 * スクレイピング結果
 */
export interface ScrapingResult {
  success: boolean;
  hash: string;
  count: number;
  error?: string;
  executionTime?: number;
  memoryUsage?: number;
}

/**
 * 通知データ
 */
export interface NotificationData {
  currentCount: number;
  previousCount: number;
  detectedAt: Date;
  url: string;
  executionTime?: number;
}

/**
 * 統計情報
 */
export interface Statistics {
  totalChecks: number;
  errors: number;
  newListings: number;
  lastCheck: Date;
  averageExecutionTime: number;
  successRate: number;
}

/**
 * パフォーマンス指標
 */
export interface PerformanceMetrics {
  startupTime: number;
  memoryUsage: number;
  executionTime: number;
  cpuUsage: number;
}

/**
 * Telegramメッセージ送信結果
 */
export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    first_name?: string;
    username?: string;
    type: string;
  };
  date: number;
  text?: string;
}
