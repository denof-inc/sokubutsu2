# スクレイピング戦略変更の解析

## ユーザー報告の問題
- help/statusコマンドは動作するようになった
- しかし**puppeteer-firstでなくなって監視エラー**が発生している

## 実際の修正内容（src/scraper.ts）

### 戦略切替ロジックの変更
```typescript
// 新しい実装（問題の原因）
if (config.scraping?.strategy === 'puppeteer_first') {
  // Puppeteer-firstを実行
  const pResult = await this.puppeteerScraper.scrapeAthome(url);
  if (pResult.success) return pResult;
  // 失敗時はHTTP-onlyにフォールバック
}

// HTTP-firstロジックが続く...
```

### 問題の特定
1. **config.scraping.strategy設定**がデフォルト値に依存
2. **環境変数SCRAPE_STRATEGY**が未設定の場合の動作
3. **puppeteer_first**が期待通りに動作していない可能性

## config.ts での戦略設定
```typescript
scraping: {
  strategy: process.env.SCRAPE_STRATEGY === 'http_first' ? 'http_first' : 'puppeteer_first',
}
```
- 環境変数が未設定でも**puppeteer_first**がデフォルト
- 設定自体は正しい

## 推測される問題
1. **Puppeteeerの依存関係**や**import**に問題
2. **PuppeteerScraperクラス**の初期化や実行時エラー
3. **認証回避**の失敗によるスクレイピングエラー

## 必要な調査
1. 実際のエラーログの確認
2. PuppeteerScraperクラスの実装状況
3. 環境変数の設定状況確認