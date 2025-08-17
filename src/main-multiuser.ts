import { config, validateConfig, displayConfig } from './config.js';
import { MultiUserMonitoringScheduler } from './scheduler.js';
import { UserService } from './services/UserService.js';
import { TelegramNotifier } from './telegram.js';
import { logger, vibeLogger } from './logger.js';
import { performanceMonitor } from './performance.js';
import { AppDataSource } from './database/connection.js';

/**
 * マルチユーザーモードメイン関数
 */
export async function startMultiUserMode(): Promise<void> {
  console.log('===========================================');
  console.log('   ソクブツ MVP - マルチユーザーモード    ');
  console.log('    Puppeteer-first戦略＋複数URL対応     ');
  console.log('===========================================');
  console.log(`起動時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
  console.log();

  // パフォーマンス監視開始
  vibeLogger.info('multiuser.main.startup', 'マルチユーザーモード起動開始', {
    context: {
      startupTime: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      mode: 'multiuser',
    },
    humanNote: 'マルチユーザーモードでアプリケーションを起動',
  });

  // 設定検証
  if (!validateMultiUserConfig()) {
    console.error('\n🚨 マルチユーザーモード用の環境変数を設定してください。');
    console.error('\n📝 設定例:');
    console.error('MULTI_USER_MODE=true');
    console.error('TELEGRAM_BOT_TOKEN=your_bot_token_here');
    console.error('DATABASE_URL=./data/sokubutsu.db');
    console.error('\n💡 詳細は README.md をご確認ください。');
    process.exit(1);
  }

  // 設定情報表示
  displayMultiUserConfig();
  console.log();

  // パフォーマンス指標表示
  performanceMonitor.displayMetrics();
  console.log();

  // データベース初期化
  try {
    await initializeDatabase();
    console.log('✅ データベース接続確認完了');
  } catch (error) {
    console.error('🚨 データベース初期化失敗:', error);
    process.exit(1);
  }

  // 管理画面サーバー起動（マルチユーザーモードでは必須）
  const { AdminServer } = await import('./admin/AdminServer.js');
  const adminServer = new AdminServer();
  adminServer.start(config.admin?.port || 3001);
  console.log(`\n📊 管理画面が起動しました: http://localhost:${config.admin?.port || 3001}`);

  // マルチユーザー監視スケジューラー起動
  const scheduler = new MultiUserMonitoringScheduler(config.telegram.botToken);
  const userService = scheduler.getUserService();

  try {
    await scheduler.start();
    
    // Telegram Botコマンドハンドラーを設定（マルチユーザーモード）
    const telegram = new TelegramNotifier(config.telegram.botToken, '');
    telegram.setupCommandHandlers(scheduler, userService);
    await telegram.launchBot();

    console.log('✅ マルチユーザー監視を開始しました。5分間隔で実行されます。');
    console.log('🤖 Telegram Botマルチユーザーコマンドが利用可能です。');
    console.log('📊 ユーザー別統計レポートは1時間ごとに送信されます。');
    console.log('🛑 停止するには Ctrl+C を押してください。');
    console.log();

    vibeLogger.info('multiuser.main.startup_complete', 'マルチユーザーモード起動完了', {
      context: {
        mode: 'multiuser',
        interval: config.monitoring.interval,
        performance: performanceMonitor.getMetrics(),
      },
      humanNote: 'マルチユーザーシステムが正常に起動し、監視を開始しました',
    });

    // グレースフルシャットダウン設定
    setupMultiUserGracefulShutdown(scheduler, telegram);

    // プロセスを維持
    process.stdin.resume();
  } catch (error) {
    vibeLogger.error('multiuser.main.startup_error', 'マルチユーザーモード起動エラー', {
      context: {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : { message: String(error) },
      },
      aiTodo: 'マルチユーザーモード起動エラーの原因を分析し、解決策を提案',
    });
    console.error('🚨 マルチユーザーモード起動エラー:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * マルチユーザーモード設定検証
 */
function validateMultiUserConfig(): boolean {
  const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.error(`❌ 環境変数 ${varName} が設定されていません`);
      return false;
    }
  }

  // マルチユーザーモードが有効かチェック
  if (!config.multiUser?.enabled) {
    console.error('❌ MULTI_USER_MODE=true が設定されていません');
    return false;
  }

  return true;
}

/**
 * マルチユーザーモード設定表示
 */
function displayMultiUserConfig(): void {
  console.log('📋 マルチユーザーモード設定:');
  console.log(`  • Telegram Bot Token: ${config.telegram.botToken ? '✅ 設定済み' : '❌ 未設定'}`);
  console.log(`  • データベース: ${config.database?.database || './data/sokubutsu.db'}`);
  console.log(`  • 管理画面: ${config.admin?.enabled ? '✅ 有効' : '❌ 無効'}`);
  console.log(`  • 監視間隔: ${config.monitoring.interval || '*/5 * * * *'}`);
  console.log(`  • サーキットブレーカー: ${config.circuitBreaker.autoRecoveryEnabled ? '✅ 自動復旧' : '⚠️ 手動復旧'}`);
}

/**
 * データベース初期化
 */
async function initializeDatabase(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      vibeLogger.info('multiuser.db.initialized', 'データベース初期化完了', {
        context: { 
          databasePath: config.database?.database || './data/sokubutsu.db',
          entities: AppDataSource.entityMetadatas.length,
        },
        humanNote: 'データベースが正常に初期化されました',
      });
    }

    // マイグレーション実行
    await AppDataSource.runMigrations();
    vibeLogger.info('multiuser.db.migrations_complete', 'データベースマイグレーション完了', {
      humanNote: 'データベーススキーマが最新版に更新されました',
    });

  } catch (error) {
    vibeLogger.error('multiuser.db.initialization_failed', 'データベース初期化失敗', {
      context: {
        error: error instanceof Error ? error.message : String(error),
        databasePath: config.database?.database || './data/sokubutsu.db',
      },
      aiTodo: 'データベース設定を確認し、初期化問題を解決',
    });
    throw error;
  }
}

/**
 * マルチユーザーモードグレースフルシャットダウン設定
 */
function setupMultiUserGracefulShutdown(
  scheduler: MultiUserMonitoringScheduler,
  telegram: TelegramNotifier
): void {
  const shutdown = (signal: string) => {
    vibeLogger.info(
      'multiuser.main.shutdown_signal',
      `${signal} 信号を受信しました。マルチユーザーモードをシャットダウンします。`,
      {
        context: { signal, mode: 'multiuser' },
        humanNote: 'マルチユーザーモードでグレースフルシャットダウンを実行中',
      }
    );
    console.log(`\n\n🛑 ${signal} 信号を受信しました。`);
    console.log('📊 最終統計情報を表示中...');

    // 最終パフォーマンス指標表示
    performanceMonitor.displayMetrics();

    // Telegram Botを停止
    telegram.stopBot();

    // マルチユーザースケジューラー停止
    scheduler.stop();

    // データベース接続を閉じる
    if (AppDataSource.isInitialized) {
      AppDataSource.destroy()
        .then(() => {
          vibeLogger.info('multiuser.db.closed', 'データベース接続を閉じました');
        })
        .catch((error) => {
          vibeLogger.error('multiuser.db.close_error', 'データベース接続終了エラー', {
            context: { error: error instanceof Error ? error.message : String(error) },
          });
        });
    }

    console.log('✅ マルチユーザーモードを正常に終了しました。');
    vibeLogger.info('multiuser.main.shutdown_complete', 'マルチユーザーモード正常終了', {
      context: { mode: 'multiuser' },
      humanNote: 'マルチユーザーアプリケーションが正常に終了しました',
    });

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * 未処理エラーハンドリング（マルチユーザーモード）
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('マルチユーザーモード未処理のPromiseエラー', { reason, promise });
  console.error('🚨 マルチユーザーモード未処理のPromiseエラー:', reason);
});

process.on('uncaughtException', error => {
  logger.error('マルチユーザーモード未処理の例外', error);
  console.error('🚨 マルチユーザーモード未処理の例外:', error);
  process.exit(1);
});