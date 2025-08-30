import { config } from './config.js';
import { MultiUserMonitoringScheduler } from './scheduler.js';
import { TelegramNotifier } from './telegram.js';
import { logger, vibeLogger } from './logger.js';
import { performanceMonitor } from './performance.js';
import { AppDataSource } from './database/connection.js';

/**
 * メイン関数
 */
async function main(): Promise<void> {
  console.log('===========================================');
  console.log('   ソクブツ MVP - マルチユーザーモード    ');
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
    await AppDataSource.initialize();
    vibeLogger.info('multiuser.db.initialized', 'データベース初期化完了', {
      context: {
        databasePath: config.database?.database || './data/sokubutsu.db',
        entities: AppDataSource.entityMetadatas.length,
      },
      humanNote: 'データベースが正常に初期化されました',
    });
  } catch (error) {
    vibeLogger.error('multiuser.db.initialization_error', 'データベース初期化エラー', {
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    console.error('🚨 データベース初期化エラー:', error);
    process.exit(1);
  }

  // マイグレーション実行
  await AppDataSource.runMigrations();
  vibeLogger.info('multiuser.db.migrations_complete', 'データベースマイグレーション完了', {
    humanNote: 'データベーススキーマが最新版に更新されました',
  });

  console.log('✅ データベース接続確認完了');
  console.log();

  // 管理画面サーバー起動（マルチユーザーモードでは必須）
  const { AdminServer } = await import('./admin/AdminServer.js');
  const adminServer = new AdminServer();
  adminServer.start(config.admin?.port || 3002);
  console.log(`\n📊 管理画面が起動しました: http://localhost:${config.admin?.port || 3002}`);

  // デバッグログ: スケジューラー作成前
  console.log('🔧 MultiUserMonitoringScheduler作成開始...');
  vibeLogger.info('multiuser.main.scheduler_creating', 'スケジューラー作成開始', {
    context: { botToken: config.telegram.botToken ? '設定済み' : '未設定' },
  });

  try {
    // マルチユーザー監視スケジューラー起動
    const scheduler = new MultiUserMonitoringScheduler();
    console.log('✅ MultiUserMonitoringScheduler作成完了');

    console.log('✅ UserService取得完了');

    try {
      console.log('🤖 TelegramNotifier作成開始...');
      const telegram = new TelegramNotifier(config.telegram.botToken, config.telegram.chatId);
      console.log('✅ TelegramNotifier作成完了');

      console.log('🤖 Telegramコマンドハンドラー設定開始...');
      telegram.setupCommandHandlers(scheduler);
      console.log('✅ Telegramコマンドハンドラー設定完了');

      // Webhookモード
      const webhookPath = '/telegram/webhook';
      const publicUrl = config.admin?.publicUrl;
      if (!publicUrl) {
        throw new Error(
          'ADMIN_PUBLIC_URL (config.admin.publicUrl) が未設定のため、Webhook URL を生成できません'
        );
      }
      const webhookUrl = `${publicUrl.replace(/\/$/, '')}${webhookPath}`;
      adminServer.registerPost(webhookPath, telegram.getWebhookHandler());
      try {
        await telegram.setWebhook(webhookUrl, true);
        console.log(`🔗 Telegram Webhook を設定しました: ${webhookUrl}`);
      } catch (e) {
        vibeLogger.warn(
          'multiuser.webhook_set.initial_failed',
          '起動時のWebhook設定に失敗しました。自己修復ガードで再設定を試みます。',
          {
            context: {
              error: e instanceof Error ? e.message : String(e),
              webhookUrl,
            },
          }
        );
        console.warn(
          '⚠️ 起動時にWebhook設定できませんでした。しばらくすると自動再設定を試みます。'
        );
      }

      // Webhook自己修復ガード: 定期的に正しいURLであることを検証し、不一致なら再設定
      if (config.webhookGuardian?.enabled) {
        const intervalMs = Math.max(1, config.webhookGuardian.intervalMinutes || 10) * 60 * 1000;
        setInterval(() => {
          void telegram.ensureWebhook(webhookUrl).then(result => {
            if (!result.ok) {
              vibeLogger.warn('multiuser.webhook_guard.check_failed', 'Webhook検証に失敗', {
                context: { webhookUrl },
              });
            }
          });
        }, intervalMs);
        console.log(
          `🛡️ Webhook自己修復ガードを有効化しました（${config.webhookGuardian.intervalMinutes}分間隔）`
        );
      }

      // スケジューラーは非同期で起動（コマンドとの疎結合を確保）
      console.log('🔄 監視スケジューラー起動開始...（非同期）');
      void scheduler.start();
      console.log(
        '✅ 監視スケジューラー起動要求を送信しました（初回チェックはバックグラウンドで実行）'
      );

      // 再起動・起動時のウェルカム（運用開始）通知
      try {
        await telegram.sendStartupNotice();
      } catch (e) {
        vibeLogger.warn('multiuser.main.startup_notice_failed', '起動通知送信に失敗', {
          context: { error: e instanceof Error ? e.message : String(e) },
        });
      }

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
      console.error(
        '🚨 マルチユーザーモード起動エラー:',
        error instanceof Error ? error.message : error
      );
      console.error('🚨 エラー詳細:', error);
      process.exit(1);
    }
  } catch (schedulerError) {
    console.error('🚨 MultiUserMonitoringScheduler作成エラー:', schedulerError);
    vibeLogger.error('multiuser.main.scheduler_error', 'スケジューラー作成エラー', {
      context: {
        error: schedulerError instanceof Error ? schedulerError.message : String(schedulerError),
      },
    });
    process.exit(1);
  }
}

/**
 * マルチユーザーモード設定検証
 */
function validateMultiUserConfig(): boolean {
  const requiredVars = ['TELEGRAM_BOT_TOKEN'];

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
  console.log(
    `  • サーキットブレーカー: ${config.circuitBreaker.autoRecoveryEnabled ? '✅ 自動復旧' : '⚠️ 手動復旧'}`
  );
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

    // Webhookを解除（明示的にvoid指定）
    void telegram.deleteWebhook();

    // マルチユーザースケジューラー停止
    void scheduler.stop();

    // データベース接続を閉じる
    if (AppDataSource.isInitialized) {
      AppDataSource.destroy()
        .then(() => {
          vibeLogger.info('multiuser.db.closed', 'データベース接続を閉じました');
        })
        .catch(error => {
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
 * 未処理エラーハンドリング
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未処理のPromiseエラー', { reason, promise });
  console.error('🚨 未処理のPromiseエラー:', reason);
});

process.on('uncaughtException', error => {
  logger.error('未処理の例外', error);
  console.error('🚨 未処理の例外:', error);
  process.exit(1);
});

// メイン関数実行
main().catch(error => {
  logger.error('致命的エラー', error);
  console.error('💀 致命的エラー:', error);
  process.exit(1);
});
