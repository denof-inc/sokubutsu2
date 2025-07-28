/**
 * コアインターフェース定義
 *
 * @設計ドキュメント
 * - docs/システム設計書.md: インターフェース設計方針
 *
 * @関連クラス
 * - JobManager: IJobManagerインターフェースの実装
 * - MonitoringService: IMonitoringServiceインターフェースの実装
 * - NotificationService: INotificationServiceインターフェースの実装
 */

import { NotificationData, Statistics, ScrapingResult } from '../types';

/**
 * ジョブ管理インターフェース
 */
export interface IJobManager {
  /**
   * ジョブをスケジュール
   */
  schedule(cronExpression: string, name: string, handler: () => void | Promise<void>): void;

  /**
   * すべてのジョブを開始
   */
  startAll(): void;

  /**
   * すべてのジョブを停止
   */
  stopAll(): void;

  /**
   * ジョブの状態を取得
   */
  getStatus(): { [jobName: string]: boolean };
}

/**
 * 監視サービスインターフェース
 */
export interface IMonitoringService {
  /**
   * URLの監視を実行
   */
  monitorUrl(url: string): Promise<void>;

  /**
   * 監視サイクルを実行
   */
  runCycle(urls: string[]): Promise<void>;

  /**
   * 監視ステータスを取得
   */
  getStatus(): {
    isRunning: boolean;
    consecutiveErrors: number;
  };
}

/**
 * 通知サービスインターフェース
 */
export interface INotificationService {
  /**
   * 起動通知を送信
   */
  sendStartupNotice(): Promise<void>;

  /**
   * 新着物件通知を送信
   */
  sendNewListingNotification(data: NotificationData): Promise<void>;

  /**
   * エラーアラートを送信
   */
  sendErrorAlert(url: string, error: string): Promise<void>;

  /**
   * 統計レポートを送信
   */
  sendStatisticsReport(stats: Statistics): Promise<void>;

  /**
   * シャットダウン通知を送信
   */
  sendShutdownNotice(): Promise<void>;

  /**
   * 接続テスト
   */
  testConnection(): Promise<boolean>;
}

/**
 * スクレイピングサービスインターフェース
 */
export interface IScrapingService {
  /**
   * URLをスクレイピング
   */
  scrapeAthome(url: string): Promise<ScrapingResult>;

  /**
   * 結果の妥当性を検証
   */
  validateResult(result: ScrapingResult): boolean;
}

/**
 * ストレージサービスインターフェース
 */
export interface IStorageService {
  /**
   * ハッシュを取得
   */
  getHash(url: string): string | undefined;

  /**
   * ハッシュを設定
   */
  setHash(url: string, hash: string): void;

  /**
   * 統計を取得
   */
  getStats(): Statistics;

  /**
   * チェック数を増加
   */
  incrementTotalChecks(): void;

  /**
   * エラー数を増加
   */
  incrementErrors(): void;

  /**
   * 新着検知数を増加
   */
  incrementNewListings(): void;

  /**
   * 実行時間を記録
   */
  recordExecutionTime(milliseconds: number): void;

  /**
   * 統計情報をリセット
   */
  resetStats(): void;

  /**
   * バックアップを作成
   */
  createBackup(): string;

  /**
   * 統計情報を表示
   */
  displayStats(): void;
}
