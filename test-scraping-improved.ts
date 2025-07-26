import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ScrapingService } from './src/scraping/scraping.service';

async function testImprovedScraping() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  
  const scrapingService = app.get(ScrapingService);

  console.log('=== 改善されたスクレイピングテスト開始 ===\n');

  try {
    // 1. 通常のスクレイピングテスト（httpbin.org）
    console.log('1. 通常のスクレイピングテスト（httpbin.org）');
    const testUrl = 'https://httpbin.org/html';
    const testSelector = 'h1';
    
    const hash1 = await scrapingService.scrapeAndGetHash(testUrl, testSelector);
    console.log(`結果: ${hash1 ? '成功' : '失敗'}`);
    console.log(`ハッシュ: ${hash1}\n`);

    // 2. Google経由アクセステスト（アットホーム）
    console.log('2. Google経由アクセステスト（アットホーム）');
    const athomeUrl = 'https://www.athome.co.jp/';
    const athomeSelector = 'body'; // より汎用的なセレクタに変更
    
    const hash2 = await scrapingService.scrapeAndGetHash(athomeUrl, athomeSelector, {
      useGoogleSearch: true,
      searchQuery: 'アットホーム 賃貸 物件検索'
    });
    
    console.log(`結果: ${hash2 ? '成功' : '失敗'}`);
    console.log(`ハッシュ: ${hash2}\n`);

    // 3. リトライ機能のテスト
    console.log('3. リトライ機能のテスト（エラーが発生しやすいサイト）');
    const difficultUrl = 'https://www.athome.co.jp/buy_other/hiroshima/list/';
    const difficultSelector = 'body';
    
    const hash3 = await scrapingService.scrapeAndGetHash(difficultUrl, difficultSelector);
    console.log(`結果: ${hash3 ? '成功' : '失敗'}`);
    console.log(`ハッシュ: ${hash3}\n`);

  } catch (error) {
    console.error('エラー発生:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

testImprovedScraping().catch(console.error);