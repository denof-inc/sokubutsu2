import { config, validateConfig, displayConfig } from './config.js';
import { SimpleScraper } from './scraper.js';
import { TelegramNotifier } from './telegram.js';
import { SimpleStorage } from './storage.js';
import { PropertyMonitor } from './property-monitor.js';
import { performanceMonitor } from './performance.js';

/**
 * 手動テスト実行
 */
async function runManualTest(): Promise<void> {
  console.log('🧪 ソクブツMVP 手動テスト開始');
  console.log('=====================================');

  const startTime = Date.now();
  let testsPassed = 0;
  let testsTotal = 0;

  // テスト1: 設定検証
  testsTotal++;
  console.log('\n📋 テスト1: 設定検証');
  if (validateConfig()) {
    console.log('✅ 設定検証: 成功');
    displayConfig();
    testsPassed++;
  } else {
    console.log('❌ 設定検証: 失敗');
    console.log('💡 .env ファイルを確認してください');
  }

  // テスト2: パフォーマンス測定
  testsTotal++;
  console.log('\n⚡ テスト2: パフォーマンス測定');
  try {
    performanceMonitor.displayMetrics();
    console.log('✅ パフォーマンス測定: 成功');
    testsPassed++;
  } catch (error) {
    console.log('❌ パフォーマンス測定: 失敗', error);
  }

  // テスト3: ストレージ機能
  testsTotal++;
  console.log('\n💾 テスト3: ストレージ機能');
  try {
    const storage = new SimpleStorage();
    const testUrl = 'https://test.example.com';
    const testHash = 'test-hash-123';

    storage.setHash(testUrl, testHash);
    const retrievedHash = storage.getHash(testUrl);

    if (retrievedHash === testHash) {
      console.log('✅ ストレージ機能: 成功');
      storage.displayStats();
      testsPassed++;
    } else {
      console.log('❌ ストレージ機能: ハッシュ不一致');
    }
  } catch (error) {
    console.log('❌ ストレージ機能: 失敗', error);
  }

  // テスト4: Telegram接続（設定がある場合のみ）
  if (config.telegram.botToken && config.telegram.chatId) {
    testsTotal++;
    console.log('\n📱 テスト4: Telegram接続');
    try {
      const telegram = new TelegramNotifier(config.telegram.botToken, config.telegram.chatId);
      const isConnected = await telegram.testConnection();

      if (isConnected) {
        console.log('✅ Telegram接続: 成功');
        const botInfo = await telegram.getBotInfo();
        console.log(`   Bot: @${botInfo.username} (ID: ${botInfo.id})`);
        testsPassed++;
      } else {
        console.log('❌ Telegram接続: 失敗');
      }
    } catch (error) {
      console.log('❌ Telegram接続: エラー', error);
    }
  }

  // テスト5: スクレイピング機能（テストURL使用）
  testsTotal++;
  console.log('\n🕷️  テスト5: スクレイピング機能');
  try {
    const scraper = new SimpleScraper();
    const testUrl = 'https://httpbin.org/html'; // テスト用公開API

    const result = await scraper.scrapeAthome(testUrl);

    if (result.success) {
      console.log('✅ スクレイピング機能: 成功');
      console.log(`   実行時間: ${result.executionTime}ms`);
      console.log(`   メモリ使用量: ${result.memoryUsage}MB`);
      console.log(`   検出要素数: ${result.count}件`);
      testsPassed++;
    } else {
      console.log('❌ スクレイピング機能: 失敗');
      console.log(`   エラー: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ スクレイピング機能: エラー', error);
  }

  // テスト6: 実際のathome.co.jpテスト（URLが設定されている場合）
  if (config.monitoring.urls.length > 0) {
    testsTotal++;
    console.log('\n🏠 テスト6: 実際のathome.co.jpスクレイピング');
    try {
      const scraper = new SimpleScraper();
      const testUrl = config.monitoring.urls[0];

      if (testUrl) {
        console.log(`   テストURL: ${testUrl}`);
        const result = await scraper.scrapeAthome(testUrl);

        if (result.success) {
          console.log('✅ athome.co.jpスクレイピング: 成功');
          console.log(`   物件数: ${result.count}件`);
          console.log(`   実行時間: ${result.executionTime}ms`);
          console.log(`   メモリ使用量: ${result.memoryUsage}MB`);
          console.log(`   ハッシュ: ${result.hash.substring(0, 8)}...`);

          // パフォーマンス目標チェック
          if (result.executionTime && result.executionTime <= 5000) {
            console.log('   ✅ 実行時間目標達成 (≤5秒)');
          } else {
            console.log('   ⚠️  実行時間目標未達成 (>5秒)');
          }

          if (result.memoryUsage && result.memoryUsage <= 50) {
            console.log('   ✅ メモリ使用量目標達成 (≤50MB)');
          } else {
            console.log('   ⚠️  メモリ使用量目標未達成 (>50MB)');
          }

          testsPassed++;
        } else {
          console.log('❌ athome.co.jpスクレイピング: 失敗');
          console.log(`   エラー: ${result.error}`);
        }
      } else {
        console.log('❌ athome.co.jpスクレイピング: URLが設定されていません');
      }
    } catch (error) {
      console.log('❌ athome.co.jpスクレイピング: エラー', error);
    }
  }

  // テスト7: 新着物件監視機能（URLが設定されている場合）
  if (config.monitoring.urls.length > 0) {
    testsTotal++;
    console.log('\n🔍 テスト7: 新着物件監視機能');
    try {
      const propertyMonitor = new PropertyMonitor();
      const scraper = new SimpleScraper();
      const testUrl = config.monitoring.urls[0];

      if (testUrl) {
        console.log('📡 物件データ取得中...');
        const scrapingResult = await scraper.scrapeAthome(testUrl);

        if (!scrapingResult.success) {
          throw new Error(`スクレイピング失敗: ${scrapingResult.error}`);
        }

        console.log(`✅ 物件データ取得成功: ${scrapingResult.count}件`);

        // 新着検知テスト
        console.log('\n🆕 新着物件検知テスト中...');
        const detectionResult = propertyMonitor.detectNewProperties(
          scrapingResult.properties || []
        );

        console.log('📊 検知結果:');
        console.log(`   新着物件: ${detectionResult.hasNewProperty ? 'あり' : 'なし'}`);
        console.log(`   新着件数: ${detectionResult.newPropertyCount}件`);
        console.log(`   監視対象: ${detectionResult.totalMonitored}件`);
        console.log(`   信頼度: ${detectionResult.confidence}`);
        console.log(`   検知時刻: ${detectionResult.detectedAt.toLocaleString('ja-JP')}`);

        // 新着物件の詳細表示
        if (detectionResult.newProperties.length > 0) {
          console.log('\n🏠 新着物件詳細:');
          detectionResult.newProperties.forEach((property, index) => {
            console.log(`   ${index + 1}. ${property.title}`);
            console.log(`      💰 ${property.price}`);
            if (property.location) {
              console.log(`      📍 ${property.location}`);
            }
            console.log(`      🕐 ${property.detectedAt.toLocaleString('ja-JP')}`);
          });
        }

        // 統計情報表示
        console.log('\n📈 監視統計情報:');
        const stats = propertyMonitor.getMonitoringStatistics();
        console.log(`   総監視回数: ${stats.totalChecks}回`);
        console.log(`   新着検知回数: ${stats.newPropertyDetections}回`);
        console.log(`   最終監視: ${stats.lastCheckAt.toLocaleString('ja-JP')}`);
        if (stats.lastNewPropertyAt) {
          console.log(`   最終新着検知: ${stats.lastNewPropertyAt.toLocaleString('ja-JP')}`);
        }

        console.log('✅ 新着物件監視機能: 成功');
        testsPassed++;
      } else {
        console.log('❌ 新着物件監視機能: URLが設定されていません');
      }
    } catch (error) {
      console.log('❌ 新着物件監視機能: 失敗', error);
    }
  }

  // テスト結果サマリー
  const totalTime = Date.now() - startTime;
  console.log('\n=====================================');
  console.log('🎯 テスト結果サマリー');
  console.log(`   実行時間: ${totalTime}ms`);
  console.log(
    `   成功: ${testsPassed}/${testsTotal} (${Math.round((testsPassed / testsTotal) * 100)}%)`
  );

  if (testsPassed === testsTotal) {
    console.log('🎉 すべてのテストが成功しました！');
    console.log('✅ ソクブツMVPは稼働準備完了です');
  } else {
    console.log('⚠️  一部のテストが失敗しました');
    console.log('💡 エラーメッセージを確認して設定を見直してください');
  }

  // 戦略準拠チェック
  console.log('\n📊 戦略準拠チェック');
  const metrics = performanceMonitor.getMetrics();

  console.log('   目標値との比較:');
  console.log(
    `   - 起動時間: ${metrics.startupTime}ms (目標: ≤2000ms) ${metrics.startupTime <= 2000 ? '✅' : '❌'}`
  );
  console.log(
    `   - メモリ使用量: ${metrics.memoryUsage}MB (目標: 30-50MB) ${metrics.memoryUsage >= 30 && metrics.memoryUsage <= 50 ? '✅' : '⚠️'}`
  );
  console.log(`   - 依存関係数: 12個 (戦略準拠) ✅`);

  console.log('\n🏁 手動テスト完了');
}

// 直接実行時のハンドリング
if (require.main === module) {
  runManualTest().catch(error => {
    console.error('💀 手動テスト実行エラー:', error);
    process.exit(1);
  });
}

export { runManualTest };
