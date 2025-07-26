import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ScrapingService } from './src/features/scraping/scraping.service';
import { HybridStrategyService } from './src/features/data-acquisition/hybrid-strategy.service';
import { BotProtectionService } from './src/features/bot-protection/bot-protection.service';
import { MetricsCollectorService } from './src/features/monitoring/metrics-collector.service';
import { chromium } from 'playwright';

interface TestResult {
  site: string;
  url: string;
  selector: string;
  methods: {
    standard: boolean;
    googleBypass: boolean;
    advancedProtection: boolean;
    hybrid: boolean;
  };
  executionTime: number;
  error?: string;
}

async function testComprehensiveScraping() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  
  const scrapingService = app.get(ScrapingService);
  const hybridService = app.get(HybridStrategyService);
  const botProtectionService = app.get(BotProtectionService);
  const metricsCollector = app.get(MetricsCollectorService);

  console.log('=== 包括的スクレイピングテスト開始 ===\n');
  console.log('High Priority修正実装後の動作確認\n');

  const testSites = [
    {
      name: 'アットホーム',
      url: 'https://www.athome.co.jp/',
      selector: 'body',
      searchQuery: 'アットホーム 賃貸 物件検索'
    },
    {
      name: 'SUUMO',
      url: 'https://suumo.jp/',
      selector: 'body',
      searchQuery: 'SUUMO スーモ 不動産'
    },
    {
      name: 'HOMES',
      url: 'https://www.homes.co.jp/',
      selector: 'body',
      searchQuery: 'ホームズ 賃貸 マンション'
    }
  ];

  const results: TestResult[] = [];

  for (const site of testSites) {
    console.log(`\n📍 ${site.name}のテスト開始`);
    console.log(`URL: ${site.url}`);
    console.log('━'.repeat(50));
    
    const startTime = Date.now();
    const result: TestResult = {
      site: site.name,
      url: site.url,
      selector: site.selector,
      methods: {
        standard: false,
        googleBypass: false,
        advancedProtection: false,
        hybrid: false
      },
      executionTime: 0
    };

    // 1. 標準スクレイピングテスト
    console.log('\n1️⃣ 標準スクレイピング');
    try {
      const hash = await scrapingService.scrapeAndGetHash(site.url, site.selector);
      result.methods.standard = !!hash;
      console.log(`結果: ${hash ? '✅ 成功' : '❌ 失敗'}`);
      if (hash) console.log(`ハッシュ: ${hash.substring(0, 16)}...`);
      
      // メトリクス記録
      const domain = new URL(site.url).hostname;
      metricsCollector.recordScrapingAttempt(domain, !!hash);
    } catch (error) {
      console.log(`結果: ❌ エラー - ${error.message}`);
      result.error = error.message;
    }

    // 2. Google経由アクセステスト
    console.log('\n2️⃣ Google経由アクセス');
    try {
      const hash = await scrapingService.scrapeAndGetHash(site.url, site.selector, {
        useGoogleSearch: true,
        searchQuery: site.searchQuery
      });
      result.methods.googleBypass = !!hash;
      console.log(`結果: ${hash ? '✅ 成功' : '❌ 失敗'}`);
    } catch (error) {
      console.log(`結果: ❌ エラー - ${error.message}`);
    }

    // 3. 高度なBot対策テスト
    console.log('\n3️⃣ 高度なBot対策（段階的アクセス）');
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();
      
      const success = await botProtectionService.performAdvancedBotProtection(page, site.url);
      result.methods.advancedProtection = success;
      console.log(`結果: ${success ? '✅ 成功' : '❌ 失敗'}`);
      
      await context.close();
    } catch (error) {
      console.log(`結果: ❌ エラー - ${error.message}`);
    } finally {
      if (browser) await browser.close();
    }

    // 4. ハイブリッドアプローチテスト
    console.log('\n4️⃣ ハイブリッドアプローチ');
    try {
      const hybridResult = await hybridService.acquireData(site.url, site.selector);
      result.methods.hybrid = hybridResult.success;
      console.log(`結果: ${hybridResult.success ? '✅ 成功' : '❌ 失敗'}`);
      console.log(`使用戦略: ${hybridResult.strategy}`);
      console.log(`優先度: ${hybridResult.priority}`);
    } catch (error) {
      console.log(`結果: ❌ エラー - ${error.message}`);
    }

    result.executionTime = Date.now() - startTime;
    results.push(result);
    
    console.log(`\n実行時間: ${(result.executionTime / 1000).toFixed(2)}秒`);
  }

  // 結果サマリー
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 テスト結果サマリー');
  console.log('='.repeat(60));

  console.log('\n各サイトの成功率:');
  for (const result of results) {
    const successCount = Object.values(result.methods).filter(v => v).length;
    const successRate = (successCount / 4) * 100;
    
    console.log(`\n${result.site}:`);
    console.log(`  標準: ${result.methods.standard ? '✅' : '❌'}`);
    console.log(`  Google経由: ${result.methods.googleBypass ? '✅' : '❌'}`);
    console.log(`  高度な対策: ${result.methods.advancedProtection ? '✅' : '❌'}`);
    console.log(`  ハイブリッド: ${result.methods.hybrid ? '✅' : '❌'}`);
    console.log(`  成功率: ${successRate}%`);
    console.log(`  実行時間: ${(result.executionTime / 1000).toFixed(2)}秒`);
  }

  // Bot対策メトリクスの取得
  const botMetrics = await metricsCollector.collectBotProtectionMetrics();
  console.log('\n\n📈 Bot対策メトリクス:');
  console.log(`全体成功率: ${botMetrics.overallSuccessRate.toFixed(2)}%`);
  console.log(`総試行回数: ${botMetrics.totalAttempts}`);
  console.log(`成功回数: ${botMetrics.successfulAttempts}`);
  console.log(`失敗回数: ${botMetrics.failedAttempts}`);

  await app.close();
  process.exit(0);
}

testComprehensiveScraping().catch(console.error);