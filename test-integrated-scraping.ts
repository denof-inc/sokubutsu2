import { chromium } from 'playwright';
import { GoogleAccessStrategy } from './src/features/scraping/strategies/google-access.strategy';
import { ParallelScrapingOrchestrator } from './src/features/scraping/orchestration/parallel-scraping-orchestrator';
import { BrowserPoolManager } from './src/features/scraping/browser-pool/browser-pool-manager';
import { IntelligentCacheService } from './src/features/scraping/cache/intelligent-cache.service';
import { AutoRecoveryService } from './src/features/scraping/recovery/auto-recovery.service';
import { BrowserStealthService } from './src/features/scraping/browser-stealth.service';
import { ErrorClassifier } from './src/features/scraping/errors/scraping-error';

// Logger mock
class MockLogger {
  log(message: string, ...args: any[]) {
    console.log(`[LOG] ${message}`, ...args);
  }
  
  debug(message: string, ...args: any[]) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
  
  warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args);
  }
  
  error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

// サービスのインスタンス化
const browserPoolManager = new BrowserPoolManager();
const cacheService = new IntelligentCacheService();
const orchestrator = new ParallelScrapingOrchestrator(browserPoolManager, cacheService);
const googleStrategy = new GoogleAccessStrategy();
const recoveryService = new AutoRecoveryService();
const stealthService = new BrowserStealthService();

// Loggerの注入
(browserPoolManager as any).logger = new MockLogger();
(cacheService as any).logger = new MockLogger();
(orchestrator as any).logger = new MockLogger();
(googleStrategy as any).logger = new MockLogger();
(recoveryService as any).logger = new MockLogger();
(stealthService as any).logger = new MockLogger();

/**
 * 統合テストの実行
 */
async function runIntegratedTest() {
  console.log('=== 統合スクレイピングテスト開始 ===\n');
  
  const testResults = {
    googleAccess: { success: false, time: 0, error: '' },
    parallelExecution: { success: false, time: 0, error: '' },
    errorRecovery: { success: false, time: 0, error: '' },
    cachePerformance: { success: false, time: 0, error: '' },
    realSiteTest: { success: false, time: 0, error: '' }
  };

  try {
    // Test 1: Google経由アクセステスト
    console.log('📝 Test 1: Google経由アクセス（Bot回避）テスト');
    const test1Start = Date.now();
    
    try {
      const result = await googleStrategy.execute('https://www.athome.co.jp/');
      testResults.googleAccess = {
        success: result.success,
        time: Date.now() - test1Start,
        error: result.error || ''
      };
      
      console.log(`✅ Google経由アクセス: ${result.success ? '成功' : '失敗'}`);
      console.log(`   実行時間: ${testResults.googleAccess.time}ms`);
      if (result.metadata) {
        console.log(`   使用パターン: ${result.metadata.searchPattern}`);
      }
    } catch (error) {
      testResults.googleAccess = {
        success: false,
        time: Date.now() - test1Start,
        error: error.message
      };
      console.log(`❌ Google経由アクセス失敗: ${error.message}`);
    }
    
    console.log('\n---\n');

    // Test 2: 並列実行テスト
    console.log('📝 Test 2: 並列スクレイピング実行テスト');
    const test2Start = Date.now();
    
    try {
      const tasks = [
        { id: '1', url: 'https://www.athome.co.jp/', selector: 'body', priority: 1 },
        { id: '2', url: 'https://www.athome.co.jp/chintai/', selector: 'body', priority: 2 },
        { id: '3', url: 'https://www.athome.co.jp/mansion/', selector: 'body', priority: 1 }
      ];
      
      const batchResult = await orchestrator.executeBatch(tasks);
      
      testResults.parallelExecution = {
        success: batchResult.successful.length > 0,
        time: batchResult.totalTime,
        error: batchResult.failed.length > 0 ? 
          `${batchResult.failed.length}件失敗` : ''
      };
      
      console.log(`✅ 並列実行完了:`);
      console.log(`   成功: ${batchResult.successful.length}件`);
      console.log(`   失敗: ${batchResult.failed.length}件`);
      console.log(`   合計時間: ${batchResult.totalTime}ms`);
      console.log(`   平均時間: ${batchResult.averageTime.toFixed(2)}ms/タスク`);
      
      // プール状態
      const poolStatus = orchestrator.getExecutionStats();
      console.log(`   プール状態: ${JSON.stringify(poolStatus)}`);
      
    } catch (error) {
      testResults.parallelExecution = {
        success: false,
        time: Date.now() - test2Start,
        error: error.message
      };
      console.log(`❌ 並列実行失敗: ${error.message}`);
    }
    
    console.log('\n---\n');

    // Test 3: エラーリカバリーテスト
    console.log('📝 Test 3: 自動エラーリカバリーテスト');
    const test3Start = Date.now();
    
    try {
      // 意図的にエラーを発生させる
      const errorTest = new Error('Connection timeout');
      const recoveryResult = await recoveryService.attemptRecovery(errorTest, {
        url: 'https://www.athome.co.jp/',
        attemptNumber: 1
      });
      
      testResults.errorRecovery = {
        success: recoveryResult.success,
        time: Date.now() - test3Start,
        error: recoveryResult.message || ''
      };
      
      console.log(`✅ エラーリカバリー: ${recoveryResult.success ? '成功' : '失敗'}`);
      console.log(`   リトライ推奨: ${recoveryResult.shouldRetry}`);
      console.log(`   推奨遅延: ${recoveryResult.delay}ms`);
      console.log(`   メッセージ: ${recoveryResult.message}`);
      
      // リカバリー統計
      const recoveryStats = recoveryService.getStats();
      console.log(`   統計: 試行${recoveryStats.totalAttempts}回, 成功${recoveryStats.successfulRecoveries}回`);
      
    } catch (error) {
      testResults.errorRecovery = {
        success: false,
        time: Date.now() - test3Start,
        error: error.message
      };
      console.log(`❌ エラーリカバリー失敗: ${error.message}`);
    }
    
    console.log('\n---\n');

    // Test 4: キャッシュパフォーマンステスト
    console.log('📝 Test 4: インテリジェントキャッシュテスト');
    const test4Start = Date.now();
    
    try {
      // キャッシュに保存
      await cacheService.set('https://www.athome.co.jp/', {
        success: true,
        content: '<html>Test content</html>',
        method: 'test',
        executionTime: 100
      });
      
      // キャッシュから取得
      const cached = await cacheService.get('https://www.athome.co.jp/');
      
      testResults.cachePerformance = {
        success: cached !== null,
        time: Date.now() - test4Start,
        error: ''
      };
      
      console.log(`✅ キャッシュ動作: ${cached ? '正常' : '異常'}`);
      
      // キャッシュ統計
      const cacheStats = cacheService.getStats();
      console.log(`   ヒット率: ${(cacheStats.hitRate * 100).toFixed(2)}%`);
      console.log(`   エントリ数: ${cacheStats.entryCount}`);
      console.log(`   使用容量: ${(cacheStats.currentSize / 1024).toFixed(2)}KB`);
      console.log(`   平均サイズ: ${(cacheStats.averageEntrySize / 1024).toFixed(2)}KB`);
      
    } catch (error) {
      testResults.cachePerformance = {
        success: false,
        time: Date.now() - test4Start,
        error: error.message
      };
      console.log(`❌ キャッシュテスト失敗: ${error.message}`);
    }
    
    console.log('\n---\n');

    // Test 5: 実サイト統合テスト
    console.log('📝 Test 5: athome.co.jp実サイト統合テスト');
    const test5Start = Date.now();
    
    try {
      const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // ステルス対策を適用
      await stealthService.applyStealthMeasures(page);
      
      // 直接アクセス
      await page.goto('https://www.athome.co.jp/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      // ページタイトル取得
      const title = await page.title();
      const url = page.url();
      
      // 物件情報の存在確認
      const hasPropertyInfo = await page.$$eval('.property-item, .bukken-item, [class*="property"]', 
        elements => elements.length > 0
      );
      
      testResults.realSiteTest = {
        success: !url.includes('/sorry/') && !url.includes('captcha'),
        time: Date.now() - test5Start,
        error: url.includes('/sorry/') ? 'CAPTCHA検出' : ''
      };
      
      console.log(`✅ 実サイトアクセス: ${testResults.realSiteTest.success ? '成功' : '失敗'}`);
      console.log(`   タイトル: ${title}`);
      console.log(`   URL: ${url}`);
      console.log(`   物件情報: ${hasPropertyInfo ? '検出' : '未検出'}`);
      console.log(`   実行時間: ${testResults.realSiteTest.time}ms`);
      
      await browser.close();
      
    } catch (error) {
      testResults.realSiteTest = {
        success: false,
        time: Date.now() - test5Start,
        error: error.message
      };
      console.log(`❌ 実サイトテスト失敗: ${error.message}`);
    }

  } finally {
    // クリーンアップ
    await browserPoolManager.onModuleDestroy();
    
    // 総合結果
    console.log('\n=== テスト結果サマリー ===\n');
    
    const allTests = Object.entries(testResults);
    const successCount = allTests.filter(([_, result]) => result.success).length;
    const totalTime = allTests.reduce((sum, [_, result]) => sum + result.time, 0);
    
    console.log(`総テスト数: ${allTests.length}`);
    console.log(`成功: ${successCount}/${allTests.length}`);
    console.log(`合計実行時間: ${totalTime}ms`);
    console.log(`成功率: ${(successCount / allTests.length * 100).toFixed(2)}%`);
    
    console.log('\n詳細結果:');
    for (const [testName, result] of allTests) {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${testName}: ${result.time}ms ${result.error ? `(${result.error})` : ''}`);
    }
    
    // PR #36の目標達成状況
    console.log('\n=== PR #36 目標達成状況 ===');
    console.log(`Bot検知回避: ${testResults.googleAccess.success && testResults.realSiteTest.success ? '✅ 達成' : '❌ 未達成'}`);
    console.log(`実行時間短縮: ${totalTime < 30000 ? '✅ 30秒以内' : `❌ ${(totalTime/1000).toFixed(1)}秒`}`);
    console.log(`エラーハンドリング: ${testResults.errorRecovery.success ? '✅ 実装完了' : '❌ 未完了'}`);
  }
}

// テスト実行
runIntegratedTest().catch(console.error);