import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { Alert, AlertLevel } from './monitoring.types';

@Injectable()
export class AlertManagerService {
  private readonly logger = new Logger(AlertManagerService.name);
  private alertHistory: Map<string, Date> = new Map();
  private readonly alertCooldown = 300000; // 5分間のクールダウン
  
  constructor(
    private readonly notificationService: NotificationService
  ) {}
  
  async sendAlert(alert: Alert): Promise<void> {
    const alertKey = `${alert.type}_${alert.level}`;
    const lastAlert = this.alertHistory.get(alertKey);
    
    // クールダウン期間中は同じアラートを送信しない
    if (lastAlert && Date.now() - lastAlert.getTime() < this.alertCooldown) {
      return;
    }
    
    try {
      // ログ出力
      this.logAlert(alert);
      
      // Telegram通知（実装済みのNotificationServiceを使用）
      await this.sendTelegramAlert(alert);
      
      // メール通知（オプション）
      if (alert.level === 'CRITICAL') {
        await this.sendEmailAlert(alert);
      }
      
      // アラート履歴の更新
      this.alertHistory.set(alertKey, new Date());
      
    } catch (error) {
      this.logger.error(`アラート送信失敗: ${error.message}`);
    }
  }
  
  private logAlert(alert: Alert): void {
    const logMessage = `[${alert.level}] ${alert.type}: ${alert.message}`;
    
    switch (alert.level) {
      case 'CRITICAL':
        this.logger.error(logMessage);
        break;
      case 'WARNING':
        this.logger.warn(logMessage);
        break;
      case 'INFO':
        this.logger.log(logMessage);
        break;
    }
    
    if (alert.recommendedAction) {
      this.logger.log(`推奨アクション: ${alert.recommendedAction}`);
    }
  }
  
  private async sendTelegramAlert(alert: Alert): Promise<void> {
    const message = this.formatTelegramMessage(alert);
    
    try {
      await this.notificationService.sendNotification(message);
    } catch (error) {
      this.logger.error(`Telegram通知送信失敗: ${error.message}`);
    }
  }
  
  private formatTelegramMessage(alert: Alert): string {
    const emoji = this.getAlertEmoji(alert.level);
    const timestamp = new Date().toLocaleString('ja-JP');
    
    let message = `${emoji} *ソクブツ監視アラート*\n\n`;
    message += `**レベル:** ${alert.level}\n`;
    message += `**タイプ:** ${alert.type}\n`;
    message += `**メッセージ:** ${alert.message}\n`;
    message += `**時刻:** ${timestamp}\n`;
    
    if (alert.recommendedAction) {
      message += `\n**推奨アクション:**\n${alert.recommendedAction}`;
    }
    
    if (alert.metrics) {
      message += `\n**詳細メトリクス:**\n\`\`\`\n${JSON.stringify(alert.metrics, null, 2)}\n\`\`\``;
    }
    
    return message;
  }
  
  private getAlertEmoji(level: AlertLevel): string {
    switch (level) {
      case 'CRITICAL': return '🚨';
      case 'WARNING': return '⚠️';
      case 'INFO': return 'ℹ️';
      default: return '📊';
    }
  }
  
  private async sendEmailAlert(alert: Alert): Promise<void> {
    // 重要なアラートの場合のメール通知
    // 実装は要件に応じて追加
    this.logger.log('メール通知は未実装です');
  }
}