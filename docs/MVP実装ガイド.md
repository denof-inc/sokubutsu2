# ソクブツMVP実装ガイド

## 🎯 このドキュメントについて

このガイドは、ソクブツの**最小実行可能プロダクト（MVP）**を今日中に稼働させるための実装手順書です。新規参入者が迷わず実装できるよう、具体的なコード例と手順を提供します。

## 📋 MVP要件

### 必須機能
- ✅ athome.co.jpの新着物件監視（HTTP-only）
- ✅ Telegram通知機能
- ✅ 5分間隔の自動監視
- ✅ Docker環境での稼働

### 技術制約
- **自宅サーバー（WSL2）**: Bot検知回避のため
- **軽量実装**: メモリ30-50MB、実行時間2-5秒
- **最小限依存関係**: 12パッケージのみ

## 🏗️ MVP アーキテクチャ

### シンプル構成
```
src/
├── main.ts          # エントリーポイント・統合制御
├── scraper.ts       # HTTP-onlyスクレイピング
├── telegram.ts      # Telegram通知
├── scheduler.ts     # cron監視スケジューラー
├── storage.ts       # JSON簡易ストレージ
└── config.ts        # 環境設定管理
```

### なぜNestJSを使わないのか？
- **MVPには過剰**: 依存注入・デコレータは不要
- **軽量性重視**: NestJS 100-150MB → Node.js 30-50MB
- **起動速度**: NestJS 5-10秒 → Node.js 1-2秒
- **学習コスト**: シンプルなNode.jsの方が理解しやすい

## 📦 最小限package.json

```json
{
  "name": "sokubutsu-mvp",
  "version": "1.0.0",
  "description": "新着物件通知サービス - MVP",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "start:dev": "ts-node-dev --respawn --transpile-only src/main.ts",
    "test": "jest",
    "lint": "eslint src/**/*.ts --fix",
    "monitor:manual": "ts-node src/manual-test.ts"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "cheerio": "^1.0.0-rc.12",
    "node-cron": "^3.0.3",
    "telegraf": "^4.15.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/node-cron": "^3.0.11",
    "typescript": "^5.0.0",
    "ts-node-dev": "^2.0.0",
    "ts-node": "^10.9.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

## 🚀 実装手順（4時間）

### Phase 1: 環境準備（30分）

#### 1.1 完全リセット
```bash
# 既存の重厚な環境をクリア
rm -rf node_modules package-lock.json

# MVP用package.json作成
# (上記のpackage.jsonをコピー)

# 軽量依存関係インストール
npm install
```

#### 1.2 TypeScript設定
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Phase 2: スクレイピング実装（60分）

#### 2.1 HTTPスクレイパー作成
```typescript
// src/scraper.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';

export interface ScrapingResult {
  success: boolean;
  hash: string;
  count: number;
  executionTime: number;
  error?: string;
}

export class SimpleScraper {
  private readonly timeout = 10000; // 10秒タイムアウト

  /**
   * athome.co.jp専用のHTTP-onlyスクレイピング
   */
  async scrapeAthome(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Scraper] 開始: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: this.timeout
      });

      const $ = cheerio.load(response.data);
      
      // athome.co.jp物件リスト要素の検出
      // 複数のセレクターパターンを試行
      const selectors = [
        '[class*="property"]',
        '[class*="bukken"]', 
        '[class*="item"]',
        '.cassetteitem',
        '.property-unit'
      ];
      
      let propertyElements = $();
      for (const selector of selectors) {
        propertyElements = $(selector);
        if (propertyElements.length > 0) {
          console.log(`[Scraper] セレクター成功: ${selector}`);
          break;
        }
      }
      
      const count = propertyElements.length;
      
      // 物件リスト内容のハッシュ化
      const listingContent = propertyElements.map((i, el) => $(el).text().trim()).get().join('|');
      const hash = crypto.createHash('sha256').update(listingContent).digest('hex');
      
      const executionTime = Date.now() - startTime;
      
      console.log(`[Scraper] 成功: ${count}件, ${executionTime}ms`);
      
      return {
        success: true,
        hash,
        count,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`[Scraper] エラー: ${errorMessage}`);
      
      return {
        success: false,
        hash: '',
        count: 0,
        executionTime,
        error: errorMessage
      };
    }
  }

  /**
   * 新着有無の判定
   */
  async detectNewListings(url: string, previousHash?: string): Promise<{
    hasNewListings: boolean;
    currentHash: string;
    count: number;
    executionTime: number;
  }> {
    const result = await this.scrapeAthome(url);
    
    if (!result.success) {
      throw new Error(`スクレイピング失敗: ${result.error}`);
    }
    
    const hasNewListings = previousHash ? result.hash !== previousHash : true;
    
    return {
      hasNewListings,
      currentHash: result.hash,
      count: result.count,
      executionTime: result.executionTime
    };
  }
}
```

#### 2.2 簡易ストレージ実装
```typescript
// src/storage.ts
import * as fs from 'fs';
import * as path from 'path';

interface StorageData {
  [url: string]: {
    hash: string;
    lastCheck: string;
    count: number;
  };
}

export class SimpleStorage {
  private readonly filePath: string;
  private data: StorageData = {};

  constructor(filePath = './data/storage.json') {
    this.filePath = filePath;
    this.ensureDirectoryExists();
    this.loadData();
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadData(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const rawData = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(rawData);
        console.log(`[Storage] データ読み込み完了: ${Object.keys(this.data).length}件`);
      }
    } catch (error) {
      console.error('[Storage] データ読み込みエラー:', error);
      this.data = {};
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
      console.log('[Storage] データ保存完了');
    } catch (error) {
      console.error('[Storage] データ保存エラー:', error);
    }
  }

  getHash(url: string): string | undefined {
    return this.data[url]?.hash;
  }

  setHash(url: string, hash: string, count: number): void {
    this.data[url] = {
      hash,
      lastCheck: new Date().toISOString(),
      count
    };
    this.saveData();
  }

  getAllData(): StorageData {
    return { ...this.data };
  }

  getStats(): { totalUrls: number; lastUpdate: string } {
    const urls = Object.keys(this.data);
    const lastUpdate = urls.length > 0 
      ? Math.max(...urls.map(url => new Date(this.data[url].lastCheck).getTime()))
      : 0;
    
    return {
      totalUrls: urls.length,
      lastUpdate: lastUpdate > 0 ? new Date(lastUpdate).toISOString() : 'なし'
    };
  }
}
```

### Phase 3: Telegram通知実装（45分）

#### 3.1 Telegram通知サービス
```typescript
// src/telegram.ts
import { Telegraf } from 'telegraf';

export class TelegramNotifier {
  private readonly bot: Telegraf;
  private readonly chatId: string;

  constructor(token: string, chatId: string) {
    if (!token || !chatId) {
      throw new Error('Telegram設定が不完全です');
    }
    
    this.bot = new Telegraf(token);
    this.chatId = chatId;
    console.log('[Telegram] Bot初期化完了');
  }

  /**
   * 新着物件通知の送信
   */
  async sendNewListingNotification(url: string, count: number): Promise<void> {
    try {
      const message = this.formatNewListingMessage(url, count);
      
      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });
      
      console.log(`[Telegram] 新着物件通知送信完了: ${url}`);
    } catch (error) {
      console.error(`[Telegram] 新着物件通知送信失敗:`, error);
      throw error;
    }
  }

  /**
   * システム状態通知の送信
   */
  async sendSystemNotification(message: string, isError = false): Promise<void> {
    try {
      const emoji = isError ? '🚨' : '🤖';
      const systemMessage = `${emoji} *システム通知*\n\n${message}\n\n⏰ ${new Date().toLocaleString('ja-JP')}`;
      
      await this.bot.telegram.sendMessage(this.chatId, systemMessage, {
        parse_mode: 'Markdown'
      });
      
      console.log('[Telegram] システム通知送信完了');
    } catch (error) {
      console.error(`[Telegram] システム通知送信失敗:`, error);
      throw error;
    }
  }

  /**
   * 監視開始通知
   */
  async sendMonitoringStartNotification(urls: string[]): Promise<void> {
    const urlList = urls.map((url, index) => `${index + 1}. ${this.shortenUrl(url)}`).join('\n');
    
    const message = `🚀 *ソクブツ監視開始*\n\n📍 *監視対象* (${urls.length}件):\n${urlList}\n\n⏱ *監視間隔*: 5分\n📱 *通知方法*: Telegram即座通知\n\n新着物件を検知次第、即座に通知いたします！`;
    
    await this.sendSystemNotification(message);
  }

  /**
   * 監視サマリー通知
   */
  async sendMonitoringSummary(results: Array<{
    url: string;
    success: boolean;
    count: number;
    hasNewListings: boolean;
    executionTime: number;
    error?: string;
  }>): Promise<void> {
    const successCount = results.filter(r => r.success).length;
    const newListingsCount = results.filter(r => r.hasNewListings).length;
    const totalProperties = results.reduce((sum, r) => sum + r.count, 0);
    const avgExecutionTime = Math.round(
      results.reduce((sum, r) => sum + r.executionTime, 0) / results.length
    );

    let message = `📊 *監視サマリー*\n\n`;
    message += `✅ 成功: ${successCount}/${results.length}件\n`;
    message += `🆕 新着検知: ${newListingsCount}件\n`;
    message += `🏠 総物件数: ${totalProperties}件\n`;
    message += `⚡ 平均実行時間: ${avgExecutionTime}ms\n\n`;

    // エラーがある場合は詳細表示
    const errors = results.filter(r => !r.success);
    if (errors.length > 0) {
      message += `🚨 *エラー詳細*:\n`;
      errors.forEach(error => {
        message += `• ${this.shortenUrl(error.url)}: ${error.error}\n`;
      });
    }

    await this.sendSystemNotification(message);
  }

  /**
   * URLを短縮表示用にフォーマット
   */
  private shortenUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.split('/').filter(p => p).slice(0, 3).join('/');
      return `${urlObj.hostname}/${path}...`;
    } catch {
      return url.length > 50 ? url.substring(0, 50) + '...' : url;
    }
  }

  /**
   * 新着物件メッセージのフォーマット
   */
  private formatNewListingMessage(url: string, count: number): string {
    return `🏠 *新着物件を検知しました！*\n\n📍 *URL*: [物件一覧を見る](${url})\n📊 *物件数*: ${count}件\n⏰ *検知時刻*: ${new Date().toLocaleString('ja-JP')}\n\n🔥 *今すぐチェックして理想の物件をゲット！*`;
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.bot.telegram.getMe();
      console.log('[Telegram] 接続テスト成功');
      return true;
    } catch (error) {
      console.error('[Telegram] 接続テスト失敗:', error);
      return false;
    }
  }
}
```

### Phase 4: スケジューラー実装（30分）

#### 4.1 監視スケジューラー
```typescript
// src/scheduler.ts
import * as cron from 'node-cron';
import { SimpleScraper } from './scraper';
import { TelegramNotifier } from './telegram';
import { SimpleStorage } from './storage';

export class MonitoringScheduler {
  private scraper = new SimpleScraper();
  private telegram: TelegramNotifier;
  private storage = new SimpleStorage();
  private isRunning = false;

  constructor(telegramToken: string, chatId: string) {
    this.telegram = new TelegramNotifier(telegramToken, chatId);
  }

  /**
   * 監視開始
   */
  async start(urls: string[]): Promise<void> {
    if (this.isRunning) {
      console.log('[Scheduler] 既に監視中です');
      return;
    }

    console.log('[Scheduler] 監視開始:', urls);
    
    // Telegram接続テスト
    const connectionOk = await this.telegram.testConnection();
    if (!connectionOk) {
      throw new Error('Telegram接続に失敗しました');
    }

    // 監視開始通知
    await this.telegram.sendMonitoringStartNotification(urls);
    
    // 5分間隔で監視スケジュール
    cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        await this.executeMonitoringCycle(urls);
      }
    });

    // 1時間ごとのサマリー通知
    cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        const stats = this.storage.getStats();
        await this.telegram.sendSystemNotification(
          `📊 監視継続中\n\n監視URL数: ${stats.totalUrls}件\n最終更新: ${stats.lastUpdate}`
        );
      }
    });

    this.isRunning = true;
    console.log('[Scheduler] 監視スケジュール開始: 5分間隔');

    // 初回実行
    await this.executeMonitoringCycle(urls);
  }

  /**
   * 監視停止
   */
  stop(): void {
    this.isRunning = false;
    console.log('[Scheduler] 監視停止');
  }

  /**
   * 監視サイクルの実行
   */
  async executeMonitoringCycle(urls: string[]): Promise<void> {
    console.log('====== 監視サイクル開始 ======');
    const cycleStartTime = Date.now();
    const results: Array<{
      url: string;
      success: boolean;
      count: number;
      hasNewListings: boolean;
      executionTime: number;
      error?: string;
    }> = [];

    for (const url of urls) {
      try {
        const result = await this.monitorUrl(url);
        results.push({
          url,
          success: true,
          count: result.count,
          hasNewListings: result.hasNewListings,
          executionTime: result.executionTime
        });

        if (result.hasNewListings) {
          console.log(`[Scheduler] 🆕 新着検知: ${url}`);
          await this.telegram.sendNewListingNotification(url, result.count);
        } else {
          console.log(`[Scheduler] ✅ 変更なし: ${url} (${result.count}件)`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Scheduler] ❌ 監視エラー: ${url} - ${errorMessage}`);
        
        results.push({
          url,
          success: false,
          count: 0,
          hasNewListings: false,
          executionTime: 0,
          error: errorMessage
        });

        await this.telegram.sendSystemNotification(
          `監視エラー発生\n\nURL: ${url}\nエラー: ${errorMessage}`,
          true
        );
      }
    }

    const cycleTime = Date.now() - cycleStartTime;
    console.log(`====== 監視サイクル完了 (${cycleTime}ms) ======`);

    // エラーが多い場合はサマリー送信
    const errorCount = results.filter(r => !r.success).length;
    if (errorCount > 0) {
      await this.telegram.sendMonitoringSummary(results);
    }
  }

  /**
   * 単一URLの監視
   */
  private async monitorUrl(url: string): Promise<{
    hasNewListings: boolean;
    count: number;
    executionTime: number;
  }> {
    console.log(`[Scheduler] 🔍 URL監視開始: ${url}`);
    
    const previousHash = this.storage.getHash(url);
    const result = await this.scraper.detectNewListings(url, previousHash);
    
    // データ更新
    this.storage.setHash(url, result.currentHash, result.count);
    
    console.log(`[Scheduler] ✅ URL監視完了: ${url}, 新着=${result.hasNewListings}, 件数=${result.count}`);
    
    return {
      hasNewListings: result.hasNewListings,
      count: result.count,
      executionTime: result.executionTime
    };
  }

  /**
   * 手動監視実行（テスト用）
   */
  async executeManualMonitoring(urls: string[]): Promise<void> {
    console.log('[Scheduler] 手動監視実行');
    await this.executeMonitoringCycle(urls);
  }
}
```

### Phase 5: 統合・メイン実装（45分）

#### 5.1 設定管理
```typescript
// src/config.ts
import { config } from 'dotenv';

// 環境変数読み込み
config();

export interface AppConfig {
  telegram: {
    botToken: string;
    chatId: string;
  };
  monitoring: {
    urls: string[];
    intervalMinutes: number;
  };
  app: {
    port: number;
    environment: string;
  };
}

export function loadConfig(): AppConfig {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const monitoringUrls = process.env.MONITORING_URLS || '';
  
  // 必須設定の検証
  if (!telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN が設定されていません');
  }
  
  if (!telegramChatId) {
    throw new Error('TELEGRAM_CHAT_ID が設定されていません');
  }
  
  if (!monitoringUrls) {
    throw new Error('MONITORING_URLS が設定されていません');
  }

  const urls = monitoringUrls.split(',').map(url => url.trim()).filter(url => url);
  
  if (urls.length === 0) {
    throw new Error('有効な監視URLが設定されていません');
  }

  // URL形式の検証
  urls.forEach(url => {
    try {
      new URL(url);
    } catch {
      throw new Error(`無効なURL形式: ${url}`);
    }
  });

  return {
    telegram: {
      botToken: telegramBotToken,
      chatId: telegramChatId
    },
    monitoring: {
      urls,
      intervalMinutes: parseInt(process.env.MONITORING_INTERVAL_MINUTES || '5', 10)
    },
    app: {
      port: parseInt(process.env.PORT || '3000', 10),
      environment: process.env.NODE_ENV || 'development'
    }
  };
}

export function validateConfig(config: AppConfig): void {
  console.log('=== 設定確認 ===');
  console.log(`Telegram Bot Token: ${config.telegram.botToken.substring(0, 10)}...`);
  console.log(`Telegram Chat ID: ${config.telegram.chatId}`);
  console.log(`監視URL数: ${config.monitoring.urls.length}件`);
  config.monitoring.urls.forEach((url, index) => {
    console.log(`  ${index + 1}. ${url}`);
  });
  console.log(`監視間隔: ${config.monitoring.intervalMinutes}分`);
  console.log(`ポート: ${config.app.port}`);
  console.log(`環境: ${config.app.environment}`);
  console.log('================');
}
```

#### 5.2 メインアプリケーション
```typescript
// src/main.ts
import { loadConfig, validateConfig } from './config';
import { MonitoringScheduler } from './scheduler';

async function main() {
  try {
    console.log('🚀 ソクブツMVP開始');
    
    // 設定読み込み・検証
    const config = loadConfig();
    validateConfig(config);
    
    // 監視スケジューラー初期化
    const scheduler = new MonitoringScheduler(
      config.telegram.botToken,
      config.telegram.chatId
    );
    
    // 監視開始
    await scheduler.start(config.monitoring.urls);
    
    console.log('✅ ソクブツMVP稼働開始完了');
    console.log('📱 Telegramで通知を確認してください');
    console.log('🔄 5分間隔で監視を実行します');
    
    // プロセス終了時の処理
    process.on('SIGINT', () => {
      console.log('\n🛑 ソクブツMVP停止中...');
      scheduler.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 ソクブツMVP停止中...');
      scheduler.stop();
      process.exit(0);
    });
    
    // プロセスを生かし続ける
    setInterval(() => {
      // 何もしない（プロセス維持用）
    }, 1000 * 60 * 60); // 1時間間隔
    
  } catch (error) {
    console.error('💥 ソクブツMVP開始エラー:', error);
    process.exit(1);
  }
}

// アプリケーション開始
main().catch(error => {
  console.error('💥 予期しないエラー:', error);
  process.exit(1);
});
```

#### 5.3 手動テスト用スクリプト
```typescript
// src/manual-test.ts
import { loadConfig } from './config';
import { SimpleScraper } from './scraper';
import { TelegramNotifier } from './telegram';

async function manualTest() {
  try {
    console.log('🧪 手動テスト開始');
    
    const config = loadConfig();
    const scraper = new SimpleScraper();
    const telegram = new TelegramNotifier(config.telegram.botToken, config.telegram.chatId);
    
    console.log('1. Telegram接続テスト...');
    const telegramOk = await telegram.testConnection();
    console.log(`   結果: ${telegramOk ? '✅ 成功' : '❌ 失敗'}`);
    
    console.log('2. スクレイピングテスト...');
    for (const url of config.monitoring.urls) {
      console.log(`   テスト中: ${url}`);
      const result = await scraper.scrapeAthome(url);
      console.log(`   結果: ${result.success ? '✅ 成功' : '❌ 失敗'} - ${result.count}件 (${result.executionTime}ms)`);
      
      if (result.success) {
        console.log('3. テスト通知送信...');
        await telegram.sendNewListingNotification(url, result.count);
        console.log('   通知送信完了');
      }
    }
    
    console.log('🎉 手動テスト完了');
  } catch (error) {
    console.error('💥 手動テストエラー:', error);
    process.exit(1);
  }
}

manualTest();
```

## 🐳 Docker設定

### Dockerfile（軽量化版）
```dockerfile
# Dockerfile
FROM node:20-alpine

# 作業ディレクトリ設定
WORKDIR /app

# package.json コピー・依存関係インストール
COPY package*.json ./
RUN npm ci --only=production

# ソースコードコピー・ビルド
COPY . .
RUN npm run build

# データディレクトリ作成
RUN mkdir -p data

# 非rootユーザー作成
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

# ポート公開
EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check OK')" || exit 1

# アプリケーション起動
CMD ["npm", "start"]
```

### docker-compose.yml
```yaml
# docker-compose.yml
version: '3.8'

services:
  sokubutsu:
    build: .
    container_name: sokubutsu_mvp
    restart: always
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    deploy:
      resources:
        limits:
          memory: 100M
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('Health check OK')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## 🔧 環境設定

### .env.example
```env
# Telegram設定
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# 監視設定（カンマ区切りで複数URL指定可能）
MONITORING_URLS=https://www.athome.co.jp/chintai/tokyo/shibuya-city/list/

# 監視間隔（分）
MONITORING_INTERVAL_MINUTES=5

# アプリケーション設定
PORT=3000
NODE_ENV=production
```

## 🚀 起動手順

### 1. 環境準備
```bash
# リポジトリクローン
git clone https://github.com/denof-inc/sokubutsu2.git
cd sokubutsu2

# 環境変数設定
cp .env.example .env
# .envファイルを編集
```

### 2. ローカル開発
```bash
# 依存関係インストール
npm install

# 手動テスト実行
npm run monitor:manual

# 開発サーバー起動
npm run start:dev
```

### 3. Docker起動
```bash
# Docker起動
docker-compose up -d

# ログ確認
docker-compose logs -f

# 状態確認
docker-compose ps
```

## 📊 期待される結果

### パフォーマンス
- **メモリ使用量**: 30-50MB
- **実行時間**: 2-5秒
- **起動時間**: 1-2秒
- **Docker容量**: 200MB以下

### 機能
- ✅ athome.co.jpの新着物件自動検知
- ✅ Telegram即座通知
- ✅ 5分間隔の自動監視
- ✅ Docker環境での安定稼働
- ✅ エラー時の自動通知

## 🔍 トラブルシューティング

### よくある問題と解決策

#### 1. Telegram通知が来ない
```bash
# Bot Token確認
echo $TELEGRAM_BOT_TOKEN

# 手動テスト実行
npm run monitor:manual
```

#### 2. スクレイピングエラー
```bash
# ネットワーク確認
curl -I https://www.athome.co.jp

# User-Agent確認
docker-compose logs | grep "User-Agent"
```

#### 3. Docker起動エラー
```bash
# ログ確認
docker-compose logs

# コンテナ再起動
docker-compose restart
```

## 🎯 成功基準

### 今日中の達成目標
- [ ] 最小限package.jsonでの環境構築完了
- [ ] athome.co.jpのHTTP-only新着検知動作
- [ ] Telegram通知の正常動作確認
- [ ] Docker環境での5分間隔監視稼働
- [ ] 24時間連続稼働可能

### 品質基準
- [ ] ESLintエラー0件
- [ ] 手動テスト全項目パス
- [ ] Docker環境での安定動作
- [ ] メモリ使用量50MB以下
- [ ] 実行時間5秒以下

このガイドに従って実装することで、今日中にソクブツMVPが稼働し、新着物件の自動監視が開始されます！

