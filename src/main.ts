import { config, validateConfig } from './config';
import { MonitoringScheduler } from './scheduler';

async function main() {
  console.log('===========================================');
  console.log('    ソクブツ MVP - 新着物件通知サービス    ');
  console.log('===========================================');
  console.log(`起動時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
  console.log();

  // 設定検証
  if (!validateConfig()) {
    console.error('\n環境変数を .env ファイルに設定してください。');
    console.error('\n例:');
    console.error('TELEGRAM_BOT_TOKEN=your_bot_token_here');
    console.error('TELEGRAM_CHAT_ID=your_chat_id_here');
    console.error('MONITORING_URLS=https://www.athome.co.jp/list/,https://example.com/properties');
    process.exit(1);
  }

  console.log('設定情報:');
  console.log(`- Telegram Bot Token: ${config.telegram.botToken.substring(0, 10)}...`);
  console.log(`- Telegram Chat ID: ${config.telegram.chatId}`);
  console.log(`- 監視URL数: ${config.monitoring.urls.length}件`);
  config.monitoring.urls.forEach((url, index) => {
    console.log(`  ${index + 1}. ${url}`);
  });
  console.log();

  // スケジューラー起動
  const scheduler = new MonitoringScheduler(
    config.telegram.botToken,
    config.telegram.chatId
  );

  try {
    await scheduler.start(config.monitoring.urls);
    console.log('\n監視を開始しました。5分間隔で実行されます。');
    console.log('停止するには Ctrl+C を押してください。');
    
    // グレースフルシャットダウン
    process.on('SIGINT', () => {
      console.log('\n\n停止信号を受信しました。');
      scheduler.stop();
      console.log('ソクブツを終了します。');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      scheduler.stop();
      process.exit(0);
    });

    // プロセスを維持
    process.stdin.resume();

  } catch (error: any) {
    console.error('起動エラー:', error.message);
    process.exit(1);
  }
}

// エラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromiseエラー:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('未処理の例外:', error);
  process.exit(1);
});

// メイン関数実行
main().catch(error => {
  console.error('致命的エラー:', error);
  process.exit(1);
});