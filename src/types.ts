/**
 * 物件情報の型定義
 */
export interface PropertyInfo {
  /** 物件タイトル */
  title: string;
  /** 価格 */
  price: string;
  /** 所在地 */
  location?: string;
}

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
  /** 物件データ（成功時） */
  properties?: PropertyInfo[];
  /** エラーメッセージ（失敗時） */
  error?: string;
  /** 失敗理由（失敗時） */
  failureReason?: 'auth' | 'network' | 'parse' | 'other';
  /** 実行時間（ミリ秒） */
  executionTime?: number;
  /** 使用メモリ（MB） */
  memoryUsage?: number;
  /** Cookie情報（Puppeteerの場合） */
  cookies?: Array<{ name: string; value: string; domain: string; path: string; expires?: number }>;
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
 * データベース設定の型定義
 */
export interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  database: string;
  synchronize: boolean;
  logging: boolean;
}

/**
 * サーキットブレーカー設定の型定義
 */
export interface CircuitBreakerConfigType {
  /** 連続エラー許容回数 */
  maxConsecutiveErrors: number;
  /** エラー率閾値（0-1） */
  errorRateThreshold: number;
  /** 監視時間窓（分） */
  windowSizeMinutes: number;
  /** 自動復旧を有効にするか */
  autoRecoveryEnabled: boolean;
  /** 自動復旧までの待機時間（分） */
  recoveryTimeMinutes: number;
}

/**
 * 設定の型定義
 */
export interface Config {
  telegram: {
    botToken: string;
    chatId: string;
    enabled: boolean;
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
  database?: DatabaseConfig;
  admin?: {
    port: number;
    enabled: boolean;
  };
  multiUser?: {
    enabled: boolean;
  };
  circuitBreaker: CircuitBreakerConfigType;
  auth?: {
    resolveEnabled: boolean;
    cookiePersistEnabled: boolean;
    resolveTimeoutMs: number;
    refererStrategy: 'direct' | 'google';
    cooldownMinutes?: number;
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

/**
 * 物件監視データの型定義
 */
export interface PropertyMonitoringData {
  /** 物件の一意署名 */
  signature: string;
  /** 物件タイトル */
  title: string;
  /** 価格 */
  price: string;
  /** 所在地 */
  location?: string;
  /** 検知時刻 */
  detectedAt: Date;
}

/**
 * 新着検知結果の型定義
 */
export interface NewPropertyDetectionResult {
  /** 新着物件があるか */
  hasNewProperty: boolean;
  /** 新着物件数 */
  newPropertyCount: number;
  /** 新着物件の詳細 */
  newProperties: PropertyMonitoringData[];
  /** 監視対象総数 */
  totalMonitored: number;
  /** 検知時刻 */
  detectedAt: Date;
  /** 信頼度 */
  confidence: 'very_high' | 'high' | 'medium';
}

/**
 * 監視統計データの型定義
 */
export interface MonitoringStatistics {
  /** 総監視回数 */
  totalChecks: number;
  /** 新着検知回数 */
  newPropertyDetections: number;
  /** 最終監視時刻 */
  lastCheckAt: Date;
  /** 最終新着検知時刻 */
  lastNewPropertyAt?: Date;
}

/**
 * URL別統計情報の型定義
 */
export interface UrlStatistics {
  /** 監視対象URL */
  url: string;
  /** 総チェック数 */
  totalChecks: number;
  /** 成功回数 */
  successCount: number;
  /** エラー回数 */
  errorCount: number;
  /** 成功率（%） */
  successRate: number;
  /** 平均実行時間（秒） */
  averageExecutionTime: number;
  /** 新着物件があるか */
  hasNewProperty: boolean;
  /** 新着物件数 */
  newPropertyCount: number;
  /** 最終新着検知時刻 */
  lastNewProperty: Date | null;
  /** 1時間の履歴（オプション） */
  hourlyHistory?: {
    time: string;
    status: 'なし' | 'あり' | 'エラー';
  }[];
}
