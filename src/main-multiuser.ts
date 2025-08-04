import { config, validateConfig, displayConfig } from './config.js';
import { initializeDatabase, closeDatabase } from './database/connection.js';
import { TelegramBot } from './telegram/TelegramBot.js';
import { MultiUserMonitoringScheduler } from './scheduler/MultiUserScheduler.js';
import { AdminServer } from './admin/AdminServer.js';
import { vibeLogger } from './logger.js';

export async function startMultiUserMode(): Promise<void> {
  console.log('🚀 ソクブツ マルチユーザーモード 起動中...');

  try {
    // 設定検証
    if (!validateConfig()) {
      console.error('❌ 設定が不正です。.env ファイルを確認してください。');
      process.exit(1);
    }

    displayConfig();

    // データベース初期化
    await initializeDatabase();

    // Telegramボット起動
    const telegramBot = new TelegramBot(config.telegram.botToken);
    await telegramBot.start();

    // マルチユーザー監視スケジューラー起動
    const scheduler = new MultiUserMonitoringScheduler();
    await scheduler.start();

    // 管理者サーバー起動
    if (config.admin?.enabled !== false) {
      const adminServer = new AdminServer();
      adminServer.start(config.admin?.port || 3001);
    }

    console.log('✅ マルチユーザーモード起動完了');
    vibeLogger.info('app.multiuser_started', 'マルチユーザーモード起動完了', {
      context: {
        telegramEnabled: config.telegram.enabled,
        adminEnabled: config.admin?.enabled !== false,
        adminPort: config.admin?.port || 3001,
      },
      humanNote: 'ソクブツがマルチユーザーモードで起動しました',
    });

    // グレースフルシャットダウン
    process.on('SIGINT', () => {
      console.log('\n⏹️  シャットダウン中...');
      scheduler.stop();
      telegramBot.stop();
      void closeDatabase().then(() => {
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      console.log('\n⏹️  シャットダウン中...');
      scheduler.stop();
      telegramBot.stop();
      void closeDatabase().then(() => {
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ 起動エラー:', error);
    vibeLogger.error('app.startup_failed', '起動失敗', {
      context: { error },
      humanNote: 'マルチユーザーモードの起動に失敗しました',
    });
    process.exit(1);
  }
}
