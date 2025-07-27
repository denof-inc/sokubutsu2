/**
 * スクレイピング結果の型定義
 */
export interface ScrapingResult {
  /** スクレイピング成功フラグ */
  success: boolean;
  /** コンテンツのハッシュ値 */
  hash: string;
  /** 検出された物件数 */
  count: number;
  /** エラーメッセージ（失敗時） */
  error?: string;
  /** 実行時間（ミリ秒） */
  executionTime?: number;
  /** 使用メモリ（MB） */
  memoryUsage?: number;
}

/**
 * 通知データの型定義
 */
export interface NotificationData {
  /** 現在の物件数 */
  currentCount: number;
  /** 前回の物件数 */
  previousCount: number;
  /** 検知時刻 */
  detectedAt: Date;
  /** サイトURL */
  url: string;
  /** 実行時間（秒） */
  executionTime: number;
}

/**
 * 統計情報の型定義
 */
export interface Statistics {
  /** 総チェック数 */
  totalChecks: number;
  /** エラー数 */
  errors: number;
  /** 新着検知数 */
  newListings: number;
  /** 最終チェック時刻 */
  lastCheck: Date;
  /** 平均実行時間（秒） */
  averageExecutionTime: number;
  /** 成功率（%） */
  successRate: number;
}

/**
 * 設定の型定義
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
 * パフォーマンス測定結果の型定義
 */
export interface PerformanceMetrics {
  /** 起動時間（ミリ秒） */
  startupTime: number;
  /** メモリ使用量（MB） */
  memoryUsage: number;
  /** 実行時間（ミリ秒） */
  executionTime: number;
  /** CPU使用率（%） */
  cpuUsage: number;
}
