/**
 * 設定バリデーション
 *
 * @設計ドキュメント
 * - docs/開発環境構築手順書.md: 環境変数設定
 * - README.md: 必須設定項目
 *
 * @関連クラス
 * - config: バリデーション対象の設定オブジェクト
 * - main.ts: 起動時のバリデーション実行
 */

import { Config } from '../types';

/**
 * 設定の妥当性を検証
 */
export function validateConfig(config: Config): boolean {
  const errors: string[] = [];

  if (!config.telegram.botToken) {
    errors.push('TELEGRAM_BOT_TOKEN が設定されていません');
  }

  if (!config.telegram.chatId) {
    errors.push('TELEGRAM_CHAT_ID が設定されていません');
  }

  if (config.monitoring.urls.length === 0) {
    errors.push('MONITORING_URLS が設定されていません');
  }

  // URL形式の検証
  config.monitoring.urls.forEach((url, index) => {
    try {
      new URL(url);
    } catch {
      errors.push(`MONITORING_URLS[${index}] が不正なURL形式です: ${url}`);
    }
  });

  // ポート番号の検証
  if (config.app.port < 1 || config.app.port > 65535) {
    errors.push(`PORT が不正な値です: ${config.app.port}`);
  }

  if (errors.length > 0) {
    console.error('❌ 設定エラー:');
    errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  return true;
}

/**
 * 設定情報を表示
 */
export function displayConfig(config: Config): void {
  console.log('⚙️  設定情報:');
  console.log(`  - Telegram Bot Token: ${config.telegram.botToken.substring(0, 10)}...`);
  console.log(`  - Telegram Chat ID: ${config.telegram.chatId}`);
  console.log(`  - 監視URL数: ${config.monitoring.urls.length}件`);
  config.monitoring.urls.forEach((url, index) => {
    console.log(`    ${index + 1}. ${url}`);
  });
  console.log(`  - 監視間隔: ${config.monitoring.interval}`);
  console.log(`  - ポート: ${config.app.port}`);
  console.log(`  - 環境: ${config.app.env}`);
  console.log(`  - データディレクトリ: ${config.storage.dataDir}`);
}
