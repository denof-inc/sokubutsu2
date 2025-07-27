import { config as loadEnv } from 'dotenv';

// .envファイルを読み込む
loadEnv();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  monitoring: {
    urls: process.env.MONITORING_URLS 
      ? process.env.MONITORING_URLS.split(',').map(url => url.trim()).filter(url => url.length > 0)
      : [],
    interval: process.env.MONITORING_INTERVAL || '*/5 * * * *', // デフォルト5分
  },
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  storage: {
    dataDir: process.env.DATA_DIR || './data',
  }
};

export function validateConfig(): boolean {
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

  if (errors.length > 0) {
    console.error('設定エラー:');
    errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  return true;
}