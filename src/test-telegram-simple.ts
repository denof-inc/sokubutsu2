import { TelegramNotifierSimple } from './telegram-simple.js';
import dotenv from 'dotenv';

dotenv.config();

async function testTelegram() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!botToken || !chatId) {
    console.error('❌ TELEGRAM_BOT_TOKEN または TELEGRAM_CHAT_ID が設定されていません');
    process.exit(1);
  }
  
  console.log('🔧 Telegram接続テスト開始（シンプル版）...');
  console.log(`Bot Token: ${botToken.substring(0, 10)}...`);
  console.log(`Chat ID: ${chatId}`);
  
  const telegram = new TelegramNotifierSimple(botToken, chatId);
  
  try {
    // 接続テスト
    console.log('\n📡 接続テスト中...');
    const isConnected = await telegram.testConnection();
    
    if (isConnected) {
      console.log('✅ Telegram接続成功！');
      
      // テストメッセージ送信
      console.log('\n📨 テストメッセージ送信中...');
      await telegram.sendMessage('🎉 Telegram通知テスト成功！\nこのメッセージが届いていれば、通知機能は正常に動作しています。');
      console.log('✅ メッセージ送信成功！');
    } else {
      console.log('❌ Telegram接続失敗');
    }
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testTelegram();