import { config, validateConfig, displayConfig } from './config.js';
import { MonitoringScheduler } from './scheduler.js';
import { logger, vibeLogger } from './logger.js';
import { performanceMonitor } from './performance.js';

/**
 * メイン関数
 */
async function main(): Promise<void> {
  console.log('===========================================');
  console.log('   ソクブツ MVP - 新着物件通知サービス   ');
  console.log('     完全リセット戦略準拠実装版         ');
  console.log('===========================================');
  console.log(`起動時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
  console.log();

  // パフォーマンス監視開始
  vibeLogger.info('main.startup', 'パフォーマンス監視開始', {
    context: {
      startupTime: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
    },
    humanNote: 'アプリケーションの起動プロセスを開始',
  });

  // 設定検証
  if (!validateConfig()) {
    console.error('\n🚨 環境変数を .env ファイルに設定してください。');
    console.error('\n📝 設定例:');
    console.error('TELEGRAM_BOT_TOKEN=your_bot_token_here');
    console.error('TELEGRAM_CHAT_ID=your_chat_id_here');
    console.error('MONITORING_URLS=https://www.athome.co.jp/chintai/tokyo/shinjuku-city/list/');
    console.error('\n💡 詳細は README.md をご確認ください。');
    process.exit(1);
  }

  // 設定情報表示
  displayConfig();
  console.log();

  // パフォーマンス指標表示
  performanceMonitor.displayMetrics();
  console.log();

  // スケジューラー起動
  const scheduler = new MonitoringScheduler(config.telegram.botToken, config.telegram.chatId);

  try {
    await scheduler.start(config.monitoring.urls);

    console.log('✅ 監視を開始しました。5分間隔で実行されます。');
    console.log('📊 統計レポートは1時間ごとに送信されます。');
    console.log('🛑 停止するには Ctrl+C を押してください。');
    console.log();

    vibeLogger.info('main.startup_complete', 'ソクブツMVP起動完了', {
      context: {
        urlCount: config.monitoring.urls.length,
        interval: config.monitoring.interval,
        performance: performanceMonitor.getMetrics(),
      },
      humanNote: 'システムが正常に起動し、監視を開始しました',
    });

    // グレースフルシャットダウン設定
    setupGracefulShutdown(scheduler);

    // プロセスを維持
    process.stdin.resume();
  } catch (error) {
    vibeLogger.error('main.startup_error', '起動エラー', {
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
      aiTodo: '起動エラーの原因を分析し、解決策を提案',
    });
    console.error('🚨 起動エラー:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * グレースフルシャットダウン設定
 */
function setupGracefulShutdown(scheduler: MonitoringScheduler): void {
  const shutdown = (signal: string) => {
    vibeLogger.info(
      'main.shutdown_signal',
      `${signal} 信号を受信しました。シャットダウンを開始します。`,
      {
        context: { signal },
        humanNote: 'グレースフルシャットダウンを実行中',
      }
    );
    console.log(`\n\n🛑 ${signal} 信号を受信しました。`);
    console.log('📊 最終統計情報を表示中...');

    // 最終パフォーマンス指標表示
    performanceMonitor.displayMetrics();

    // スケジューラー停止
    scheduler.stop();

    console.log('✅ ソクブツMVPを正常に終了しました。');
    vibeLogger.info('main.shutdown_complete', 'ソクブツMVP正常終了', {
      humanNote: 'アプリケーションが正常に終了しました',
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
