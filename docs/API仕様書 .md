# API仕様書 - ソクブツ

## 概要

ソクブツのAPI仕様書です。NestJS + TypeScript技術スタックでの物件新着「有無」監視システムのREST API仕様とTelegram Bot API仕様を定義します。

## 技術スタック

- **フレームワーク**: NestJS (TypeScript)
- **データベース**: TypeORM + better-sqlite3 (PostgreSQL移行準備)
- **スクレイピング**: HTTP-first + 段階的フォールバック戦略 (axios + cheerio → jsdom → Playwright)
- **通知**: Telegram Bot API
- **認証**: JWT + Telegram認証

## リソース使用量

### HTTP-first + 段階的フォールバック戦略

| 段階    | 方法                        | 実行時間 | メモリ使用量 | 成功率 |
| ------- | --------------------------- | -------- | ------------ | ------ |
| 第1段階 | HTTP-only (axios + cheerio) | 2-5秒    | 30-50MB      | 70%    |
| 第2段階 | jsdom                       | 5-10秒   | 80-120MB     | 20%    |
| 第3段階 | Playwright                  | 15-25秒  | 200-300MB    | 10%    |

### システム全体

- **平均メモリ使用量**: 50-100MB（HTTP-first戦略により大幅軽量化）
- **平均CPU使用率**: 5-10%
- **平均処理時間**: 3-8秒（athome.co.jpはHTTP-onlyで2-5秒）
- **起動時間**: 8-12秒

## REST API仕様

### ヘルスチェック

#### GET /health

基本的なヘルスチェック

**レスポンス**:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-26T10:30:00.000Z",
  "uptime": 3600,
  "version": "2.0.0"
}
```

#### GET /health/detailed

詳細なヘルスチェック

**レスポンス**:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-26T10:30:00.000Z",
  "uptime": 3600,
  "version": "2.0.0",
  "database": {
    "status": "connected",
    "responseTime": 15
  },
  "memory": {
    "used": 180,
    "total": 250,
    "percentage": 72
  },
  "monitoring": {
    "activeUrls": 5,
    "lastCheck": "2024-01-26T10:25:00.000Z"
  }
}
```

#### GET /health/ready

Kubernetes readiness probe用

**レスポンス**:

```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "telegram": "ok",
    "scraping": "ok"
  }
}
```

#### GET /health/live

Kubernetes liveness probe用

**レスポンス**:

```json
{
  "status": "alive",
  "timestamp": "2024-01-26T10:30:00.000Z"
}
```

### URL管理

#### POST /urls

新しい監視URLを追加

**リクエスト**:

```json
{
  "url": "https://suumo.jp/jj/chintai/ichiran/FR301FC001/?ar=030&bs=040",
  "name": "渋谷エリア 1K",
  "telegramUserId": "123456789",
  "checkInterval": 300
}
```

**レスポンス**:

```json
{
  "id": "uuid-string",
  "url": "https://suumo.jp/jj/chintai/ichiran/FR301FC001/?ar=030&bs=040",
  "name": "渋谷エリア 1K",
  "status": "active",
  "createdAt": "2024-01-26T10:30:00.000Z",
  "lastChecked": null,
  "checkInterval": 300
}
```

#### GET /urls

ユーザーの監視URL一覧取得

**クエリパラメータ**:

- `telegramUserId`: string (必須)
- `status`: "active" | "paused" | "error" (オプション)

**レスポンス**:

```json
{
  "urls": [
    {
      "id": "uuid-string",
      "url": "https://suumo.jp/...",
      "name": "渋谷エリア 1K",
      "status": "active",
      "createdAt": "2024-01-26T10:30:00.000Z",
      "lastChecked": "2024-01-26T10:25:00.000Z",
      "checkInterval": 300,
      "newItemsFound": false
    }
  ],
  "total": 1,
  "limits": {
    "current": 1,
    "max": 3
  }
}
```

#### PUT /urls/:id

監視URL設定の更新

**リクエスト**:

```json
{
  "name": "渋谷エリア 1K (更新)",
  "status": "paused",
  "checkInterval": 600
}
```

#### DELETE /urls/:id

監視URLの削除

**レスポンス**:

```json
{
  "message": "URL deleted successfully",
  "deletedId": "uuid-string"
}
```

### 監視ログ

#### GET /monitoring/logs

監視ログの取得

**クエリパラメータ**:

- `urlId`: string (オプション)
- `telegramUserId`: string (必須)
- `limit`: number (デフォルト: 50)
- `offset`: number (デフォルト: 0)

**レスポンス**:

```json
{
  "logs": [
    {
      "id": "uuid-string",
      "urlId": "uuid-string",
      "urlName": "渋谷エリア 1K",
      "timestamp": "2024-01-26T10:25:00.000Z",
      "status": "success",
      "newItemsFound": false,
      "responseTime": 2500,
      "method": "http-only",
      "message": "監視完了: 新着物件なし"
    }
  ],
  "total": 100,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasNext": true
  }
}
```

### Bot対策システム

#### POST /scraping/test

Bot対策付きスクレイピングのテスト実行

**リクエスト**:

```json
{
  "url": "https://suumo.jp/jj/chintai/ichiran/FR301FC001/?ar=030&bs=040",
  "method": "auto"
}
```

**レスポンス**:

```json
{
  "success": true,
  "method": "http-only",
  "responseTime": 1500,
  "botProtectionApplied": false,
  "newItemsDetected": false,
  "memoryUsage": 45,
  "message": "スクレイピング成功"
}
```

## Telegram Bot API仕様

### コマンド一覧

#### /start

ボットの初期化とユーザー登録

**応答**:

```
🏠 ソクブツへようこそ！

物件の新着「有無」を監視するボットです。

📋 利用可能なコマンド:
/add - 監視URL追加
/list - 監視URL一覧
/pause - 監視一時停止
/resume - 監視再開
/delete - 監視URL削除
/help - ヘルプ表示

まずは /add コマンドで監視したいURLを追加してください。
```

#### /add

新しい監視URLの追加

**使用例**: `/add https://suumo.jp/... 渋谷エリア1K`

**応答**:

```
✅ 監視URL追加完了

📍 名前: 渋谷エリア1K
🔗 URL: https://suumo.jp/...
⏰ 監視間隔: 5分
📊 現在の登録数: 1/3

監視を開始しました。新着物件が見つかり次第お知らせします。
```

#### /list

監視URL一覧の表示

**応答**:

```
📋 監視URL一覧 (1/3)

1️⃣ 渋谷エリア1K
   🔗 https://suumo.jp/...
   ✅ 監視中 (最終確認: 2分前)
   📊 新着: なし

💡 コマンド:
/pause_1 - 一時停止
/resume_1 - 再開
/delete_1 - 削除
```

#### /pause\_{id}

指定URLの監視一時停止

**応答**:

```
⏸️ 監視を一時停止しました

📍 名前: 渋谷エリア1K
🔗 URL: https://suumo.jp/...

再開するには /resume_1 を実行してください。
```

#### /resume\_{id}

指定URLの監視再開

**応答**:

```
▶️ 監視を再開しました

📍 名前: 渋谷エリア1K
🔗 URL: https://suumo.jp/...
⏰ 監視間隔: 5分

監視を開始しました。
```

#### /delete\_{id}

指定URLの削除

**応答**:

```
🗑️ 監視URLを削除しました

📍 名前: 渋谷エリア1K
🔗 URL: https://suumo.jp/...

現在の登録数: 0/3
```

### 自動通知

#### 新着物件発見時

```
🆕 新着物件発見！

📍 渋谷エリア1K
🔗 https://suumo.jp/...
⏰ 発見時刻: 2024-01-26 10:30

新しい物件が追加されました。
詳細は上記URLでご確認ください。
```

#### 定期サマリー (1時間毎)

```
📊 監視サマリー (10:00-11:00)

📍 渋谷エリア1K: 監視中 ✅
📍 新宿エリア2DK: 監視中 ✅
📍 池袋エリア1R: 一時停止中 ⏸️

🔍 総監視回数: 36回
🆕 新着発見: 0件
⚡ 平均応答時間: 2.3秒

すべて正常に動作しています。
```

#### エラー通知

```
⚠️ 監視エラーが発生しました

📍 名前: 渋谷エリア1K
🔗 URL: https://suumo.jp/...
❌ エラー: サイトにアクセスできません

自動的に再試行します。問題が続く場合は /list で状況をご確認ください。
```

## データ型定義

### URL Entity

```typescript
interface UrlEntity {
  id: string;
  url: string;
  name: string;
  telegramUserId: string;
  status: 'active' | 'paused' | 'error';
  checkInterval: number; // 秒
  lastChecked?: Date;
  lastContent?: string; // ハッシュ値
  createdAt: Date;
  updatedAt: Date;
}
```

### MonitoringLog Entity

```typescript
interface MonitoringLogEntity {
  id: string;
  urlId: string;
  timestamp: Date;
  status: 'success' | 'error' | 'bot_detected';
  newItemsFound: boolean;
  responseTime: number; // ミリ秒
  method: 'http-only' | 'jsdom' | 'playwright';
  memoryUsage: number; // MB
  message?: string;
  errorDetails?: string;
}
```

### User Entity

```typescript
interface UserEntity {
  id: string;
  telegramUserId: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  urlLimit: number; // デフォルト: 3
  createdAt: Date;
  lastActiveAt: Date;
}
```

## エラーハンドリング

### 統一エラー形式

```json
{
  "error": {
    "code": "URL_LIMIT_EXCEEDED",
    "message": "URL登録上限に達しています",
    "details": {
      "current": 3,
      "max": 3
    },
    "timestamp": "2024-01-26T10:30:00.000Z"
  }
}
```

### エラーコード一覧

| コード               | 説明               | HTTPステータス |
| -------------------- | ------------------ | -------------- |
| `URL_LIMIT_EXCEEDED` | URL登録上限超過    | 400            |
| `INVALID_URL`        | 無効なURL形式      | 400            |
| `URL_NOT_FOUND`      | URL未発見          | 404            |
| `UNAUTHORIZED`       | 認証エラー         | 401            |
| `SCRAPING_FAILED`    | スクレイピング失敗 | 500            |
| `BOT_DETECTED`       | Bot検知された      | 429            |
| `DATABASE_ERROR`     | データベースエラー | 500            |

## セキュリティ・監視

### CORS設定

```typescript
{
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
```

### Bot検知回避

- Google経由アクセスパターン実装
- User-Agentローテーション
- セッション管理・継承
- 段階的フォールバック (HTTP-only → jsdom → Playwright)

### レート制限

- 同一IPから1分間に60リクエスト
- 同一ユーザーから1時間に100リクエスト
- スクレイピングは1URL当たり5分間隔

### 監視メトリクス

- API応答時間
- エラー率
- メモリ使用量
- アクティブユーザー数
- スクレイピング成功率

## バージョン情報

- **API Version**: 2.0.0
- **NestJS**: 10.x
- **TypeScript**: 5.x
- **TypeORM**: 0.3.x
- **better-sqlite3**: 9.x
