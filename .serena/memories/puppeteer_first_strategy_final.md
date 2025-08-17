# Puppeteer-First戦略（確定版）

## 最終決定事項
2025-08-17: アットホーム認証システムの分析により、HTTP-only戦略では限界があることが判明。
Puppeteer-first戦略を正式採用し、以下の実装で安定稼働を実現。

## 実装済み戦略

### 1. 3段階アクセスパターン（レインズ実証済み）
```typescript
// ステップ1: ボット検出テスト
await page.goto("https://bot.sannysoft.com", {
  waitUntil: 'domcontentloaded',
  timeout: 15000
});
await new Promise(r => setTimeout(r, 2000));

// ステップ2: Google経由でリファラー自然化  
await page.goto("https://www.google.com", {
  waitUntil: 'domcontentloaded', 
  timeout: 15000
});
await new Promise(r => setTimeout(r, 2000));

// ステップ3: アットホームへアクセス
await page.goto(url, {
  waitUntil: 'domcontentloaded',
  timeout: 20000
});
```

### 2. Stealth Plugin設定
```typescript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const stealth = StealthPlugin();
puppeteer.use(stealth);
```

### 3. 認証回避オプション
```typescript
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox', 
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080'
  ]
});
```

### 4. Web Components対応セレクタ
```typescript
const selectors = [
  'athome-csite-pc-part-rent-business-other-bukken-card',
  'athome-search-result-list-item',
  'athome-buy-other-object-list-item',
  'athome-object-item',
  // 従来のセレクタ...
];
```

## 性能指標（実測値）

### 成功率
- **目標**: 25%以上
- **実績**: 25.05% (2116回中530回成功)
- **改善**: 3段階アクセスパターンで15%→25%に向上

### 実行時間
- **平均**: 5.38秒
- **目標**: 15-25秒（Puppeteer戦略）
- **評価**: 目標を大幅に上回る高速性を実現

### メモリ使用量
- **実測**: 200-300MB（Puppeteerとしては標準）
- **効率性**: domcontentloaded使用で最適化済み

## HTTP-only戦略の限界（検証済み）

### 試行結果
1. **Cookie保存**: ✅ 正常動作（27件保存）
2. **Cookie送信**: ✅ 実装済み
3. **認証突破**: ❌ Cookieのみでは不十分

### 技術的制約
1. **JavaScriptチャレンジ**: ブラウザ固有のJS実行が必要
2. **TLS フィンガープリンティング**: HTTPクライアントでは模倣困難  
3. **動的トークン**: セッション毎の変動トークンが存在
4. **reese84 Cookie**: 高度な暗号化された認証Cookie

### 検証ログ
```
[INFO] scraping.http_fast: Cookie有効 - HTTP-only高速アクセス
[WARN] scraping.auth_detected_http: HTTP-only認証失敗
```

## 今後の改善方針

### 短期施策（成功率25% → 30%）
1. User-Agent ローテーション実装
2. プロキシ経由アクセスの検討
3. 待機時間の微調整（2秒 → 1.5-3秒のランダム化）

### 中期施策（成功率30% → 35%）
1. playwright-core の軽量実装検討
2. 認証パターンの季節変動分析
3. アクセス頻度の最適化

### 運用指針
- **多URL対応**: Puppeteer-first戦略のスケーラビリティを活用
- **監視強化**: 成功率の継続監視と異常値検出
- **ログ分析**: 失敗パターンの詳細分析で改善点特定

## 結論
Puppeteer-first戦略により、アットホーム監視システムの実用的な運用を実現。
HTTP-only戦略の理想は技術的制約により断念し、現実的で安定した方式を確立。