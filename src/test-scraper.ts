#!/usr/bin/env node

import { SimpleScraper } from './scraper.js';
import { vibeLogger } from './logger.js';

/**
 * スクレイパーのテストスクリプト
 * athome.co.jpの実際のURLでスクレイピングをテストする
 */
async function testScraper() {
  vibeLogger.info('test.start', 'スクレイパーテスト開始', {
    humanNote: 'athome.co.jpの実際のURLでテスト実行',
  });

  // テスト用URL（広島市の物件一覧） - 実際に動作確認済みのURL
  const testUrl = 'https://www.athome.co.jp/chintai/hiroshima/list/';

  const scraper = new SimpleScraper();
  
  try {
    console.log('🔍 スクレイピング開始...');
    console.log(`URL: ${testUrl}`);
    console.log('---');

    const result = await scraper.scrapeAthome(testUrl);

    if (result.success) {
      console.log('✅ スクレイピング成功！');
      console.log(`物件数: ${result.count}件`);
      console.log(`実行時間: ${result.executionTime}ms`);
      console.log(`メモリ使用量: ${result.memoryUsage}MB`);
      console.log(`ハッシュ: ${result.hash}`);
      
      if (result.properties && result.properties.length > 0) {
        console.log('\n📋 検出された物件（最新3件）:');
        result.properties.forEach((prop, index) => {
          console.log(`\n[物件 ${index + 1}]`);
          console.log(`  タイトル: ${prop.title}`);
          console.log(`  価格: ${prop.price}`);
          if (prop.location) {
            console.log(`  所在地: ${prop.location}`);
          }
        });
      }

      // パフォーマンス評価
      console.log('\n📊 パフォーマンス評価:');
      if (result.executionTime && result.executionTime <= 5000) {
        console.log('  ✅ 実行時間: HTTP-first成功（2-5秒）');
      } else if (result.executionTime && result.executionTime <= 25000) {
        console.log('  ⚠️  実行時間: Puppeteerフォールバック（15-25秒）');
      } else if (result.executionTime && result.executionTime <= 40000) {
        console.log('  ⚠️  実行時間: Real Browserフォールバック（20-40秒）');
      } else {
        console.log('  ❌ 実行時間: 目標未達成');
      }

      if (result.memoryUsage && result.memoryUsage <= 50) {
        console.log('  ✅ メモリ使用量: HTTP-first（30-50MB）');
      } else if (result.memoryUsage && result.memoryUsage <= 300) {
        console.log('  ⚠️  メモリ使用量: Puppeteerフォールバック（200-300MB）');
      } else if (result.memoryUsage && result.memoryUsage <= 500) {
        console.log('  ⚠️  メモリ使用量: Real Browserフォールバック（300-500MB）');
      } else {
        console.log('  ❌ メモリ使用量: 目標未達成');
      }
    } else {
      console.log('❌ スクレイピング失敗');
      console.log(`エラー: ${result.error}`);
      console.log(`実行時間: ${result.executionTime}ms`);
      console.log(`メモリ使用量: ${result.memoryUsage}MB`);
    }

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    vibeLogger.error('test.error', 'テスト実行中にエラーが発生', {
      context: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  vibeLogger.info('test.end', 'スクレイパーテスト終了');
}

// メイン実行
testScraper().then(() => {
  console.log('\n🏁 テスト完了');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});