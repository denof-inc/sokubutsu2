# ソクブツ API仕様書

**バージョン**: 1.0  
**作成日**: 2025年7月25日  
**作成者**: テックリード（Manus AI）  
**対象プロジェクト**: ソクブツ（sokubutsu2）

## 概要

ソクブツは物件新着通知システムのAPIです。REST APIとTelegram Bot APIの両方を提供し、URL監視機能と通知機能を実現します。

### 技術スタック
- **フレームワーク**: NestJS 10.x
- **言語**: TypeScript 5.x
- **データベース**: SQLite（better-sqlite3推奨）
- **通知**: Telegram Bot API
- **スクレイピング**: Playwright

## 認証

### Telegram Bot認証
Telegram Bot APIを使用したユーザー認証を実装します。

```typescript
// 環境変数
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

## REST API エンドポイント

### 1. ヘルスチェック

#### GET /health
システムの稼働状況を確認します。

**リクエスト**
```http
GET /health
```

**レスポンス**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "telegram": { "status": "up" }
  },
  "details": {
    "database": { "status": "up" },
    "telegram": { "status": "up" }
  }
}
```

**ステータスコード**
- `200`: 正常
- `503`: サービス利用不可

### 2. URL管理

#### GET /urls
登録済みURL一覧を取得します。

**リクエスト**
```http
GET /urls
```

**レスポンス**
```json
{
  "data": [
    {
      "id": 1,
      "name": "渋谷エリア物件",
      "url": "https://example.com/properties",
      "selector": ".property-list",
      "contentHash": "abc123...",
      "isActive": true,
      "createdAt": "2025-07-25T10:00:00Z",
      "updatedAt": "2025-07-25T10:00:00Z"
    }
  ],
  "total": 1
}
```

#### POST /urls
新しい監視URLを登録します。

**リクエスト**
```http
POST /urls
Content-Type: application/json

{
  "name": "新宿エリア物件",
  "url": "https://example.com/shinjuku",
  "selector": ".property-item"
}
```

**レスポンス**
```json
{
  "data": {
    "id": 2,
    "name": "新宿エリア物件",
    "url": "https://example.com/shinjuku",
    "selector": ".property-item",
    "contentHash": null,
    "isActive": true,
    "createdAt": "2025-07-25T11:00:00Z",
    "updatedAt": "2025-07-25T11:00:00Z"
  }
}
```

**ステータスコード**
- `201`: 作成成功
- `400`: リクエストエラー
- `409`: URL重複エラー

#### PUT /urls/:id
既存URLの設定を更新します。

**リクエスト**
```http
PUT /urls/1
Content-Type: application/json

{
  "name": "渋谷エリア物件（更新）",
  "selector": ".new-property-list",
  "isActive": false
}
```

**レスポンス**
```json
{
  "data": {
    "id": 1,
    "name": "渋谷エリア物件（更新）",
    "url": "https://example.com/properties",
    "selector": ".new-property-list",
    "contentHash": "abc123...",
    "isActive": false,
    "createdAt": "2025-07-25T10:00:00Z",
    "updatedAt": "2025-07-25T12:00:00Z"
  }
}
```

#### DELETE /urls/:id
URLを削除します。

**リクエスト**
```http
DELETE /urls/1
```

**レスポンス**
```json
{
  "message": "URL deleted successfully"
}
```

**ステータスコード**
- `200`: 削除成功
- `404`: URL未発見

### 3. 監視ログ

#### GET /monitoring-logs
監視実行ログを取得します。

**リクエスト**
```http
GET /monitoring-logs?urlId=1&limit=10&offset=0
```

**レスポンス**
```json
{
  "data": [
    {
      "id": 1,
      "urlId": 1,
      "status": "success",
      "hasNewContent": false,
      "contentHash": "abc123...",
      "executedAt": "2025-07-25T13:00:00Z",
      "errorMessage": null
    }
  ],
  "total": 1
}
```

## Telegram Bot API

### コマンド一覧

#### /start
ユーザー登録と利用開始

**使用例**
```
/start
```

**レスポンス**
```
ソクブツへようこそ！
物件の新着通知を開始します。

利用可能なコマンド:
/add - URL登録
/list - URL一覧
/pause - 監視停止
/resume - 監視再開
/delete - URL削除
/help - ヘルプ
```

#### /add
新規監視URL登録

**使用例**
```
/add https://example.com/properties 渋谷エリア物件
```

**レスポンス**
```
✅ URL登録完了
名前: 渋谷エリア物件
URL: https://example.com/properties
ID: 1

監視を開始しました。
```

#### /list
登録済みURL一覧表示

**使用例**
```
/list
```

**レスポンス**
```
📋 登録済みURL一覧

1. 渋谷エリア物件 ✅
   https://example.com/properties
   
2. 新宿エリア物件 ⏸️
   https://example.com/shinjuku

合計: 2件
```

#### /pause
URL監視を一時停止

**使用例**
```
/pause 1
```

**レスポンス**
```
⏸️ 監視を停止しました
ID: 1 - 渋谷エリア物件
```

#### /resume
URL監視を再開

**使用例**
```
/resume 1
```

**レスポンス**
```
▶️ 監視を再開しました
ID: 1 - 渋谷エリア物件
```

#### /delete
URL削除

**使用例**
```
/delete 1
```

**レスポンス**
```
🗑️ URLを削除しました
ID: 1 - 渋谷エリア物件
```

### 自動通知

#### 新着物件発見時
```
🆕 新着物件を発見しました！

📍 渋谷エリア物件
🔗 https://example.com/properties
⏰ 2025-07-25 14:30

詳細を確認してください。
```

#### 監視ステータス通知（1時間毎）
```
📊 監視ステータス報告

✅ 渋谷エリア物件: 正常監視中
⚠️ 新宿エリア物件: エラー発生
⏸️ 池袋エリア物件: 停止中

最終更新: 2025-07-25 15:00
```

#### エラー通知
```
❌ 監視エラーが発生しました

📍 渋谷エリア物件
🔗 https://example.com/properties
❗ エラー: タイムアウト

⏰ 2025-07-25 14:45
```

## データ型定義

### URL Entity
```typescript
interface Url {
  id: number;
  name: string;
  url: string;
  selector: string;
  contentHash: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### MonitoringLog Entity
```typescript
interface MonitoringLog {
  id: number;
  urlId: number;
  status: 'success' | 'error';
  hasNewContent: boolean;
  contentHash: string | null;
  executedAt: Date;
  errorMessage: string | null;
}
```

### User Entity
```typescript
interface User {
  id: number;
  telegramId: string;
  username: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## エラーハンドリング

### エラーレスポンス形式
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid URL format",
    "details": {
      "field": "url",
      "value": "invalid-url"
    }
  },
  "timestamp": "2025-07-25T15:00:00Z",
  "path": "/urls"
}
```

### エラーコード一覧

| コード | 説明 | HTTPステータス |
|--------|------|----------------|
| `VALIDATION_ERROR` | 入力値検証エラー | 400 |
| `URL_DUPLICATE` | URL重複エラー | 409 |
| `URL_NOT_FOUND` | URL未発見 | 404 |
| `SCRAPING_ERROR` | スクレイピングエラー | 500 |
| `TELEGRAM_ERROR` | Telegram API エラー | 500 |
| `DATABASE_ERROR` | データベースエラー | 500 |

## レート制限

### REST API
- **制限**: 100リクエスト/分/IP
- **ヘッダー**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Telegram Bot
- **制限**: Telegram API制限に準拠
- **30メッセージ/秒/Bot**

## セキュリティ

### CORS設定
```typescript
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
});
```

### セキュリティヘッダー
- `helmet` ミドルウェアによる基本的なセキュリティヘッダー
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`

### 入力値検証
- `class-validator` による厳密な入力値検証
- SQLインジェクション対策
- XSS対策

## 監視仕様

### 監視間隔
- **デフォルト**: 5分間隔
- **設定可能範囲**: 1分〜60分

### Bot検知回避
- **User-Agent**: 最新ブラウザを模倣
- **待機時間**: ランダム（1-3秒）
- **リクエスト間隔**: 人間的なパターン

### タイムアウト設定
- **ページ読み込み**: 30秒
- **要素待機**: 10秒
- **全体処理**: 60秒

## 実装状況

### 完了済み
- ✅ URL エンティティ定義
- ✅ 基本的なモジュール構成
- ✅ TypeORM設定

### 実装中
- 🔄 REST API エンドポイント
- 🔄 Telegram Bot コマンド
- 🔄 スクレイピング機能

### 未実装
- ❌ ヘルスチェック機能
- ❌ 監視ログ機能
- ❌ エラーハンドリング
- ❌ レート制限
- ❌ セキュリティ強化

## 今後の拡張予定

### v1.1
- 複数ユーザー対応
- ユーザー別URL制限
- 通知設定カスタマイズ

### v1.2
- Webhook通知対応
- メール通知機能
- 監視統計ダッシュボード

### v2.0
- 複数サイト対応
- AI による物件分析
- 課金システム連携

---

**注意**: この仕様書は現在の実装状況に基づいて作成されており、開発進捗に応じて更新される予定です。

