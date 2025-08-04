import { TelegramNotifier } from '../telegram.js';
import { UserService } from './UserService.js';
import { UserUrl } from '../entities/UserUrl.js';
import { NewPropertyDetectionResult } from '../types.js';
import { vibeLogger } from '../logger.js';

export class NotificationService {
  private readonly userService: UserService;
  private readonly telegramNotifier: TelegramNotifier;

  constructor(botToken: string) {
    this.userService = new UserService();
    // 古いTelegramNotifierを使用（互換性のため）
    this.telegramNotifier = new TelegramNotifier(botToken, ''); // Chat IDは動的設定
  }

  /**
   * 新着物件通知（ユーザー別）
   */
  async sendNewPropertyNotification(
    userUrl: UserUrl,
    detectionResult: NewPropertyDetectionResult
  ): Promise<void> {
    const user = userUrl.user;

    const message = `
🆕 *新着物件発見！*

📋 *監視対象*: ${this.escapeMarkdown(userUrl.name)}
📍 *エリア*: ${this.escapeMarkdown(userUrl.prefecture)}

📊 *検知情報*
• 新着件数: *${detectionResult.newPropertyCount}件*
• 監視範囲: 最新${detectionResult.totalMonitored}件
• 信頼度: ${this.getConfidenceText(detectionResult.confidence)}
• 検知時刻: ${detectionResult.detectedAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

🏠 *新着物件詳細*
${detectionResult.newProperties
  .map(
    (property, index) =>
      `${index + 1}\\. *${this.escapeMarkdown(property.title)}*\\n` +
      `   💰 ${this.escapeMarkdown(property.price)}\\n` +
      (property.location ? `   📍 ${this.escapeMarkdown(property.location)}\\n` : '')
  )
  .join('\\n')}

🔗 [物件一覧を確認](${userUrl.url})

🎯 *理想の物件をお見逃しなく！*
    `;

    await this.sendMessageToUser(user.telegramChatId, message);
  }

  /**
   * ユーザー別統計レポート
   */
  async sendUserStatisticsReport(userId: string): Promise<void> {
    const urls = await this.userService.getUserUrls(userId);
    const user = await this.userService.getUserById(userId);

    if (!user || urls.length === 0) return;

    const totalChecks = urls.reduce((sum, url) => sum + url.totalChecks, 0);
    const totalNewListings = urls.reduce((sum, url) => sum + url.newListingsCount, 0);
    const totalErrors = urls.reduce((sum, url) => sum + url.errorCount, 0);
    const successRate = totalChecks > 0 ? ((totalChecks - totalErrors) / totalChecks) * 100 : 100;

    let message = `
📊 *あなたの監視統計レポート*

📈 *全体パフォーマンス*
  • 総チェック数: *${totalChecks}回*
  • 成功率: *${successRate.toFixed(1)}%*
  • 新着検知数: *${totalNewListings}回*
  • エラー数: *${totalErrors}回*

🏠 *監視対象別詳細*
`;

    urls.forEach((url, index) => {
      const urlSuccessRate =
        url.totalChecks > 0 ? ((url.totalChecks - url.errorCount) / url.totalChecks) * 100 : 100;
      message += `
${index + 1}\\. *${this.escapeMarkdown(url.name)}*
  • チェック数: ${url.totalChecks}回
  • 新着検知: ${url.newListingsCount}回
  • 成功率: ${urlSuccessRate.toFixed(1)}%
  • 状態: ${url.isMonitoring ? '🟢 監視中' : '🔴 停止中'}
`;
    });

    message += `
⏰ *稼働状況*
  • 監視間隔: 5分ごと
  • 登録URL数: ${urls.length}/3件

${
  successRate >= 95
    ? '✅ *システムは正常に動作しています*'
    : '⚠️ *エラー率が高めです\\. /status で詳細をご確認ください*'
}

🎯 *理想の物件との出会いを継続監視中！*
    `;

    await this.sendMessageToUser(user.telegramChatId, message);
  }

  /**
   * ユーザーへメッセージ送信（内部用）
   */
  private async sendMessageToUser(chatId: string, message: string): Promise<void> {
    try {
      // 既存のTelegramNotifierのメソッドをオーバーライドして使用
      (this.telegramNotifier as any).chatId = chatId;
      await this.telegramNotifier.sendMessage(message);

      vibeLogger.info('notification.sent', 'ユーザーへ通知送信', {
        context: { chatId, messageLength: message.length },
        humanNote: 'Telegramで個別ユーザーへ通知を送信しました',
      });
    } catch (error) {
      vibeLogger.error('notification.send_failed', '通知送信エラー', {
        context: { chatId, error },
        humanNote: 'ユーザーへの通知送信に失敗しました',
      });
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  private getConfidenceText(confidence: string): string {
    switch (confidence) {
      case 'very_high':
        return '*非常に高い* ⭐⭐⭐';
      case 'high':
        return '*高い* ⭐⭐';
      case 'medium':
        return '*中程度* ⭐';
      default:
        return '*不明*';
    }
  }
}
