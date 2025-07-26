import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ScrapingService } from './src/features/scraping/scraping.service';
import { NotificationService } from './src/features/notification/notification.service';

// 通知サービスのモック
class MockNotificationService {
  async sendNotification(message: string): Promise<void> {
    console.log('[Mock Notification]:', message);
  }
}

async function testScraping() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  
  // 通知サービスをモックで置き換え
  const mockNotificationService = new MockNotificationService();
  app.get(NotificationService).sendNotification = mockNotificationService.sendNotification;
  
  const scrapingService = app.get(ScrapingService);

  console.log('=== スクレイピングテスト開始 ===\n');

  // テスト用のURL（httpbin.orgは安全なテストサイト）
  const testUrl = 'https://httpbin.org/html';
  const testSelector = 'h1';

  try {
    // 1. 通常のスクレイピングテスト
    console.log('1. 通常のスクレイピングテスト');
    const hash1 = await scrapingService.scrapeAndGetHash(testUrl, testSelector);
    console.log(`結果: ${hash1 ? '成功' : '失敗'}`);
    console.log(`ハッシュ: ${hash1}\n`);

    // 2. Bot検知テスト
    console.log('2. Bot検知テスト');
    const hash2 = await scrapingService.scrapeAndGetHash(testUrl, testSelector, {
      testBotDetection: true,
    });
    console.log(`結果: ${hash2 ? '成功' : '失敗'}\n`);

    // 3. 実際のサイトでのテスト（アットホームの例）
    console.log('3. 実際のサイトテスト');
    const realUrl = 'https://www.athome.co.jp/';
    const realSelector = '.top-main';
    
    const hash3 = await scrapingService.scrapeAndGetHash(realUrl, realSelector);
    console.log(`結果: ${hash3 ? '成功' : '失敗'}`);
    console.log(`ハッシュ: ${hash3}\n`);

  } catch (error) {
    console.error('エラー発生:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

testScraping().catch(console.error);