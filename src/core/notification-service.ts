/**
 * 通知サービス
 *
 * @設計ドキュメント
 * - docs/通知設計.md: 通知フォーマットとタイミング
 *
 * @関連クラス
 * - TelegramNotifier: 実際の通知送信を実行
 * - vibeLogger: 通知の送信状況をログ出力
 */

import { NotificationData, Statistics } from '../types';
import { TelegramNotifier } from '../infrastructure/telegram';
import { INotificationService } from './interfaces';
import { vibeLogger } from '../utils/logger';
import { formatError } from '../utils/error-handler';

export class NotificationService implements INotificationService {
  private readonly telegram: TelegramNotifier;

  constructor(telegramToken: string, chatId: string) {
    this.telegram = new TelegramNotifier(telegramToken, chatId);
  }

  /**
   * 起動通知を送信
   */
  async sendStartupNotice(): Promise<void> {
    try {
      await this.telegram.sendStartupNotice();
      vibeLogger.info('notification.startup_sent', '起動通知送信完了');
    } catch (error) {
      vibeLogger.error('notification.startup_error', '起動通知送信エラー', {
        context: { error: formatError(error) },
      });
      throw error;
    }
  }

  /**
   * 新着物件通知を送信
   */
  async sendNewListingNotification(data: NotificationData): Promise<void> {
    try {
      await this.telegram.sendNewListingNotification(data);
      vibeLogger.info('notification.new_listing_sent', '新着物件通知送信完了', {
        context: { data },
      });
    } catch (error) {
      vibeLogger.error('notification.new_listing_error', '新着物件通知送信エラー', {
        context: { data, error: formatError(error) },
      });
      throw error;
    }
  }

  /**
   * エラーアラートを送信
   */
  async sendErrorAlert(url: string, error: string): Promise<void> {
    try {
      await this.telegram.sendErrorAlert(url, error);
      vibeLogger.info('notification.error_alert_sent', 'エラーアラート送信完了', {
        context: { url, error },
      });
    } catch (alertError) {
      vibeLogger.error('notification.error_alert_error', 'エラーアラート送信エラー', {
        context: {
          url,
          originalError: error,
          alertError: formatError(alertError),
        },
      });
      // エラーアラートの送信失敗は例外を投げない（元のエラー処理を優先）
    }
  }

  /**
   * 統計レポートを送信
   */
  async sendStatisticsReport(stats: Statistics): Promise<void> {
    try {
      await this.telegram.sendStatisticsReport(stats);
      vibeLogger.info('notification.stats_report_sent', '統計レポート送信完了', {
        context: { stats },
      });
    } catch (error) {
      vibeLogger.error('notification.stats_report_error', '統計レポート送信エラー', {
        context: { stats, error: formatError(error) },
      });
      throw error;
    }
  }

  /**
   * シャットダウン通知を送信
   */
  async sendShutdownNotice(): Promise<void> {
    try {
      await this.telegram.sendShutdownNotice();
      vibeLogger.info('notification.shutdown_sent', 'シャットダウン通知送信完了');
    } catch (error) {
      vibeLogger.error('notification.shutdown_error', 'シャットダウン通知送信エラー', {
        context: { error: formatError(error) },
      });
      // シャットダウン通知の送信失敗は例外を投げない（終了処理を優先）
    }
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.telegram.testConnection();
      vibeLogger.info('notification.connection_test', '接続テスト完了', {
        context: { success: result },
      });
      return result;
    } catch (error) {
      vibeLogger.error('notification.connection_test_error', '接続テストエラー', {
        context: { error: formatError(error) },
      });
      return false;
    }
  }
}
