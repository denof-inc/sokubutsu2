/**
 * アプリケーション設定
 *
 * @設計ドキュメント
 * - README.md: 環境変数設定
 * - docs/開発環境構築手順書.md: 設定項目の詳細
 * - .env.example: 設定例
 *
 * @関連クラス
 * - validation.ts: 設定の妥当性検証と表示
 * - main.ts: 起動時の設定読み込み
 * - MonitoringScheduler: 監視間隔の利用
 * - SimpleStorage: データディレクトリの利用
 * - TelegramNotifier: Telegram設定の利用
 */

import { config as loadEnv } from 'dotenv';
import { Config } from '../types';

// .envファイルを読み込む
loadEnv();

/**
 * アプリケーション設定
 */
export const config: Config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  monitoring: {
    urls: process.env.MONITORING_URLS
      ? (() => {
          // URLにカンマが含まれる場合を考慮
          const urlString = process.env.MONITORING_URLS;
          // ダブルクォートで囲まれている場合は除去
          const cleanedUrl = urlString.replace(/^"|"$/g, '');
          // 複数URLの場合は改行またはセミコロンで分割
          if (cleanedUrl.includes('\n')) {
            return cleanedUrl
              .split('\n')
              .map(url => url.trim())
              .filter(url => url.length > 0);
          } else if (cleanedUrl.includes(';')) {
            return cleanedUrl
              .split(';')
              .map(url => url.trim())
              .filter(url => url.length > 0);
          } else {
            // 単一URLの場合
            return [cleanedUrl.trim()].filter(url => url.length > 0);
          }
        })()
      : [],
    interval: process.env.MONITORING_INTERVAL || '*/5 * * * *', // デフォルト5分
  },
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  storage: {
    dataDir: process.env.DATA_DIR || './data',
  },
};
