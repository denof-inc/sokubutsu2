import { config as loadEnv } from 'dotenv';
import { Config } from './types.js';

// .envファイルを読み込む
loadEnv();

/**
 * アプリケーション設定
 */
export const config: Config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    chatId: process.env.TELEGRAM_CHAT_ID ?? '',
    enabled: process.env.TELEGRAM_ENABLED !== 'false',
  },
  monitoring: {
    urls: process.env.MONITORING_URLS
      ? (() => {
          const urlString = process.env.MONITORING_URLS;
          const cleanedUrl = urlString.replace(/^"|"$/g, '');
          // Handle single URL with commas in query parameters
          return [cleanedUrl.trim()].filter(url => url.length > 0);
        })()
      : [],
    interval: process.env.MONITORING_INTERVAL ?? '*/5 * * * *', // デフォルト5分
  },
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    env: process.env.NODE_ENV ?? 'development',
  },
  storage: {
    dataDir: process.env.DATA_DIR ?? './data',
  },
  database: {
    type: 'sqlite' as const,
    database: process.env.DATABASE_PATH ?? './data/sokubutsu.db',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.DATABASE_LOGGING === 'true',
  },
  admin: {
    port: parseInt(process.env.ADMIN_PORT ?? '3002', 10),
    enabled: process.env.ADMIN_ENABLED !== 'false',
  },
  multiUser: {
    enabled: process.env.MULTI_USER_MODE === 'true',
  },
  circuitBreaker: {
    maxConsecutiveErrors: parseInt(process.env.ERROR_THRESHOLD_COUNT ?? '5', 10),
    errorRateThreshold: parseFloat(process.env.ERROR_THRESHOLD_RATE ?? '0.8'),
    windowSizeMinutes: parseInt(process.env.ERROR_WINDOW_MINUTES ?? '10', 10),
    autoRecoveryEnabled: process.env.AUTO_RECOVERY_ENABLED !== 'false',
    recoveryTimeMinutes: parseInt(process.env.AUTO_RECOVERY_MINUTES ?? '30', 10),
  },
  auth: {
    resolveEnabled: process.env.AUTH_RESOLVE_ENABLED !== 'false',
    cookiePersistEnabled: process.env.COOKIE_PERSIST_ENABLED !== 'false',
    resolveTimeoutMs: parseInt(process.env.AUTH_RESOLVE_TIMEOUT ?? '7000', 10),
    refererStrategy:
      (process.env.REFERER_STRATEGY as 'direct' | 'google') === 'google' ? 'google' : 'direct',
    cooldownMinutes: parseInt(process.env.AUTH_COOLDOWN_MINUTES ?? '15', 10),
  },
  operatingHours: {
    enabled: process.env.OPERATING_HOURS_ENABLED === 'true',
    startHour: parseInt(process.env.OPERATING_HOURS_START ?? '6', 10),
    endHour: parseInt(process.env.OPERATING_HOURS_END ?? '22', 10),
    timezone: process.env.OPERATING_HOURS_TIMEZONE ?? 'Asia/Tokyo',
  },
};;

/**
 * 設定の妥当性を検証
 */
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
export function displayConfig(): void {
  console.log('⚙️  設定情報:');
  console.log(`  - Telegram Bot Token: ${config.telegram.botToken.substring(0, 10)}...`);
  console.log(`  - Telegram Chat ID: ${config.telegram.chatId}`);
  console.log(`  - Telegram通知: ${config.telegram.enabled ? '有効' : '無効'}`);
  console.log(`  - 監視URL数: ${config.monitoring.urls.length}件`);
  config.monitoring.urls.forEach((url, index) => {
    console.log(`    ${index + 1}. ${url}`);
  });
  console.log(`  - 監視間隔: ${config.monitoring.interval}`);
  console.log(`  - ポート: ${config.app.port}`);
  console.log(`  - 環境: ${config.app.env}`);
  console.log(`  - データディレクトリ: ${config.storage.dataDir}`);
}
