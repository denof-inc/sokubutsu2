import { ProvenGoogleAccessStrategy } from './src/scraping/strategies/proven-google-access.strategy';
import { AdvancedStealthService } from './src/scraping/stealth/advanced-stealth.service';
import { UltraFastScrapingOrchestrator } from './src/scraping/orchestrator/ultra-fast-orchestrator';

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
const provenStrategy = new ProvenGoogleAccessStrategy();
const advancedStealth = new AdvancedStealthService();
const ultraFastOrchestrator = new UltraFastScrapingOrchestrator(provenStrategy, advancedStealth);

// Loggerの注入
(provenStrategy as any).logger = new MockLogger();
(advancedStealth as any).logger = new MockLogger();
(ultraFastOrchestrator as any).logger = new MockLogger();

/**
 * 究極のスクレイピングテスト
 */
async function runUltimateTest() {
  console.log('=== 究極のスクレイピングテスト開始 ===\n');
  console.log('実装内容:');
  console.log('- ProvenGoogleAccessStrategy: 成功例の厳密な再現');
  console.log('- AdvancedStealthService: 高度なフィンガープリント偽装');
  console.log('- UltraFastScrapingOrchestrator: 超高速実行アーキテクチャ');
  console.log('\n');

  const testResults = {
    provenGoogleAccess: { success: false, time: 0, error: '' },
    ultraFastExecution: { success: false, time: 0, error: '' },
    athomeDirectTest: { success: false, time: 0, error: '' }
  };

  try {
    // Test 1: 実証済みGoogle経由アクセステスト
    console.log('📝 Test 1: 実証済みGoogle経由アクセス（bot.sannysoft.com → Google → target）');
    const test1Start = Date.now();
    
    try {
      const result = await provenStrategy.execute('https://www.athome.co.jp/');
      testResults.provenGoogleAccess = {
        success: result.success,
        time: Date.now() - test1Start,
        error: result.error || ''
      };
      
      console.log(`✅ 実証済みGoogle経由アクセス: ${result.success ? '成功' : '失敗'}`);
      console.log(`   実行時間: ${testResults.provenGoogleAccess.time}ms`);
      if (result.metadata) {
        console.log(`   パターン: ${result.metadata.pattern}`);
        console.log(`   最終URL: ${result.metadata.finalUrl}`);
      }
      if (!result.success) {
        console.log(`   エラー: ${result.error}`);
      }
    } catch (error) {
      testResults.provenGoogleAccess = {
        success: false,
        time: Date.now() - test1Start,
        error: error.message
      };
      console.log(`❌ 実証済みGoogle経由アクセス失敗: ${error.message}`);
    }
    
    console.log('\n---\n');

    // Test 2: 超高速実行テスト
    console.log('📝 Test 2: 超高速実行アーキテクチャテスト（目標: 20-30秒）');
    const test2Start = Date.now();
    
    try {
      const result = await ultraFastOrchestrator.executeUltraFast('https://www.athome.co.jp/chintai/');
      
      testResults.ultraFastExecution = {
        success: result.success,
        time: result.executionTime,
        error: result.error || ''
      };
      
      console.log(`✅ 超高速実行: ${result.success ? '成功' : '失敗'}`);
      console.log(`   使用戦略: ${result.method}`);
      console.log(`   実行時間: ${result.executionTime}ms`);
      console.log(`   目標達成: ${result.executionTime <= 30000 ? '✅ 30秒以内' : `❌ ${(result.executionTime/1000).toFixed(1)}秒`}`);
      
      if (result.metadata) {
        console.log(`   詳細: ${JSON.stringify(result.metadata)}`);
      }
      
    } catch (error) {
      testResults.ultraFastExecution = {
        success: false,
        time: Date.now() - test2Start,
        error: error.message
      };
      console.log(`❌ 超高速実行失敗: ${error.message}`);
    }
    
    console.log('\n---\n');

    // Test 3: athome.co.jp実サイト統合テスト
    console.log('📝 Test 3: athome.co.jp実サイト統合テスト');
    const test3Start = Date.now();
    
    try {
      // 複数URLでテスト
      const testUrls = [
        'https://www.athome.co.jp/',
        'https://www.athome.co.jp/mansion/',
        'https://www.athome.co.jp/kodate/'
      ];
      
      const results: Array<{url: string; success: boolean; method: string; time: number}> = [];
      
      for (const url of testUrls) {
        console.log(`\n   テスト中: ${url}`);
        const urlStart = Date.now();
        
        try {
          const result = await ultraFastOrchestrator.executeUltraFast(url);
          const urlTime = Date.now() - urlStart;
          
          results.push({
            url,
            success: result.success,
            method: result.method,
            time: urlTime
          });
          
          console.log(`   結果: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
          console.log(`   戦略: ${result.method}`);
          console.log(`   時間: ${urlTime}ms`);
          
        } catch (error) {
          results.push({
            url,
            success: false,
            method: 'error',
            time: Date.now() - urlStart
          });
          console.log(`   結果: ❌ エラー - ${error.message}`);
        }
      }
      
      // 統計
      const successCount = results.filter(r => r.success).length;
      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      
      testResults.athomeDirectTest = {
        success: successCount === results.length,
        time: Date.now() - test3Start,
        error: successCount < results.length ? `${results.length - successCount}/${results.length} failed` : ''
      };
      
      console.log(`\n   総合結果:`);
      console.log(`   成功率: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(1)}%)`);
      console.log(`   平均時間: ${avgTime.toFixed(0)}ms`);
      
    } catch (error) {
      testResults.athomeDirectTest = {
        success: false,
        time: Date.now() - test3Start,
        error: error.message
      };
      console.log(`❌ 実サイトテスト失敗: ${error.message}`);
    }

  } finally {
    // 総合結果
    console.log('\n=== テスト結果サマリー ===\n');
    
    const allTests = Object.entries(testResults);
    const successCount = allTests.filter(([_, result]) => result.success).length;
    const totalTime = allTests.reduce((sum, [_, result]) => sum + result.time, 0);
    
    console.log(`総テスト数: ${allTests.length}`);
    console.log(`成功: ${successCount}/${allTests.length}`);
    console.log(`成功率: ${(successCount / allTests.length * 100).toFixed(2)}%`);
    
    console.log('\n詳細結果:');
    for (const [testName, result] of allTests) {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${testName}: ${result.time}ms ${result.error ? `(${result.error})` : ''}`);
    }
    
    // PR #36 究極の目標達成状況
    console.log('\n=== PR #36 究極の目標達成状況 ===');
    console.log(`Google CAPTCHA回避: ${testResults.provenGoogleAccess.success ? '✅ 達成' : '❌ 未達成'}`);
    console.log(`実行時間短縮（20-30秒）: ${testResults.ultraFastExecution.time <= 30000 ? '✅ 達成' : '❌ 未達成'}`);
    console.log(`athome.co.jp成功率: ${testResults.athomeDirectTest.success ? '✅ 100%' : '❌ ' + testResults.athomeDirectTest.error}`);
    
    // 推奨事項
    console.log('\n=== 次のステップ ===');
    if (!testResults.provenGoogleAccess.success) {
      console.log('- Google CAPTCHA回避: headless: falseの確認、実行環境の調整');
    }
    if (testResults.ultraFastExecution.time > 30000) {
      console.log('- パフォーマンス: 並列実行の調整、タイムアウト値の最適化');
    }
    if (!testResults.athomeDirectTest.success) {
      console.log('- 成功率向上: エラーパターンの分析、リトライ戦略の調整');
    }
  }
}

// テスト実行
runUltimateTest().catch(console.error);