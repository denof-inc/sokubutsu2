# ソクブツAPI・通信仕様書

## 🎯 このドキュメントについて

このドキュメントは、ソクブツシステムのAPI仕様およびTelegram通信プロトコルの技術仕様を定義します。外部サービスとの連携、内部API設計、Telegram Bot APIの活用方法を包括的に説明します。

## 📋 API概要

### システムAPI構成
- **内部API**: Express.js RESTful API
- **外部通信**: Telegram Bot API
- **認証方式**: Token認証（環境変数管理）
- **データ形式**: JSON（Content-Type: application/json）

### エンドポイント分類
1. **Health Check**: システム稼働状況確認
2. **Admin API**: 管理者向け機能
3. **Monitoring API**: 監視状況・統計情報
4. **Webhook API**: Telegram Webhook受信

## 🚀 内部API仕様

### 1. Health Check API

#### GET /health
システムの稼働状況を確認します。

**リクエスト**
```http
GET /health HTTP/1.1
Host: localhost:3000
```

**レスポンス（正常時）**
```json
{
  "status": "ok",
  "timestamp": "2025-08-26T14:45:38.203Z",
  "version": "1.0.0",
  "uptime": 3600.123,
  "database": "connected",
  "scheduler": "running"
}
```

**レスポンス（異常時）**
```json
{
  "status": "error",
  "timestamp": "2025-08-26T14:45:38.203Z",
  "errors": [
    {
      "component": "database",
      "message": "Connection failed"
    }
  ]
}
```

### 2. Admin API

#### GET /admin/status
システム全体の詳細状況を取得します。

**認証**
```http
Authorization: Bearer {ADMIN_TOKEN}
```

**レスポンス**
```json
{
  "system": {
    "status": "running",
    "uptime": 86400.567,
    "memory": {
      "used": 245760000,
      "total": 536870912,
      "percentage": 45.8
    },
    "cpu": {
      "usage": 23.5,
      "loadAverage": [0.5, 0.3, 0.2]
    }
  },
  "monitoring": {
    "totalChecks": 2925,
    "successfulChecks": 731,
    "failedChecks": 2194,
    "lastCheckAt": "2025-08-26T14:45:38.203Z",
    "successRate": 25.0
  },
  "database": {
    "status": "connected",
    "size": 1048576,
    "tables": {
      "users": 5,
      "user_urls": 12,
      "properties": 2317
    }
  }
}
```

#### GET /admin/logs
システムログを取得します。

**パラメータ**
- `limit`: 取得件数（デフォルト: 100, 最大: 1000）
- `level`: ログレベル（debug, info, warn, error）
- `since`: 開始日時（ISO 8601形式）

**レスポンス**
```json
{
  "logs": [
    {
      "timestamp": "2025-08-26T14:45:38.203Z",
      "level": "info",
      "message": "property.detected",
      "data": {
        "url": "https://www.athome.co.jp/...",
        "propertyCount": 3,
        "executionTime": 5420,
        "memoryUsage": 67108864
      }
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 15420
  }
}
```

### 3. Monitoring API

#### GET /api/monitoring/statistics
監視統計情報を取得します。

**レスポンス**
```json
{
  "overall": {
    "totalChecks": 2925,
    "newPropertyDetections": 2317,
    "lastCheckAt": "2025-08-26T14:45:38.203Z",
    "lastNewPropertyAt": "2025-08-26T14:45:38.203Z",
    "averageExecutionTime": 5420,
    "successRate": 25.0
  },
  "byUrl": [
    {
      "url": "https://www.athome.co.jp/...",
      "checks": 584,
      "successes": 146,
      "successRate": 25.0,
      "lastCheck": "2025-08-26T14:45:38.203Z",
      "averageTime": 5420
    }
  ]
}
```

#### GET /api/monitoring/properties
監視中の物件情報を取得します。

**レスポンス**
```json
{
  "properties": [
    {
      "signature": "（Ｋ－２４６４７）広島県呉市西川原石町...",
      "title": "（Ｋ－２４６４７）広島県呉市西川原石町　一棟アパート＋底地バルク",
      "price": "278万円",
      "location": "広島県呉市西川原石町",
      "detectedAt": "2025-08-26T14:45:38.187Z"
    }
  ],
  "count": 3,
  "lastUpdated": "2025-08-26T14:45:38.203Z"
}
```

## 📡 Telegram Bot API仕様

### Telegram Bot設定

#### Bot初期設定
```typescript
// Telegram Bot設定
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Webhook設定
const WEBHOOK_URL = `${process.env.WEBHOOK_DOMAIN}/webhook/telegram`;
await bot.telegram.setWebhook(WEBHOOK_URL);
```

#### 環境変数
```bash
# .env設定
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ1234567890
TELEGRAM_CHAT_ID=-1001234567890
WEBHOOK_DOMAIN=https://your-domain.com
```

### Bot コマンド仕様

#### /start - ユーザー登録開始
**コマンド**
```
/start
```

**Bot応答**
```
🤖 ソクブツへようこそ！

新着物件通知サービスに登録しました。
以下のコマンドが利用できます：

📝 /add <URL> <名前> - 監視URL追加
📋 /list - 登録済みURL一覧
⏸️ /pause <ID> - 監視一時停止
▶️ /resume <ID> - 監視再開
🗑️ /delete <ID> - URL削除
ℹ️ /help - ヘルプ表示
```

#### /add - 監視URL追加
**コマンド**
```
/add https://www.athome.co.jp/chintai/... 新宿エリア
```

**Bot応答（成功時）**
```
✅ 監視URL追加完了

📍 名前: 新宿エリア
🔗 URL: https://www.athome.co.jp/chintai/...
🕐 監視間隔: 5分

5分後から監視を開始します。
```

**Bot応答（エラー時）**
```
❌ エラー: 無効なURLです

対応サイト:
• athome.co.jp

正しい形式で再入力してください。
```

#### /list - 登録済みURL一覧
**コマンド**
```
/list
```

**Bot応答**
```
📋 監視URL一覧

1️⃣ ID: 1 | ✅ 稼働中
📍 新宿エリア
🔗 https://www.athome.co.jp/chintai/...
🕐 最終チェック: 14:45 (5分前)

2️⃣ ID: 2 | ⏸️ 一時停止
📍 渋谷エリア  
🔗 https://www.athome.co.jp/chintai/...
🕐 最終チェック: 昨日 18:30

合計: 2件（稼働中: 1件）
```

### 通知メッセージ仕様

#### 新着物件通知
```html
🆕 <b>新着物件発見！</b>

📍 <b>新宿エリア</b>
🔗 <a href="https://www.athome.co.jp/chintai/...">検索結果を確認</a>

📊 検知詳細:
• 新着件数: 3件
• チェック時刻: 14:45:38
• 実行時間: 5.4秒

最新の物件情報をご確認ください。
```

#### 1時間サマリーレポート
```html
📊 <b>1時間サマリーレポート</b>

📍 <b>新宿エリア</b>
🔗 <a href="https://www.athome.co.jp/chintai/...">検索ページ</a>

📈 監視統計:
• チェック回数: 12回
• 成功回数: 3回  
• 成功率: 25.0%
• 平均実行時間: 5.4秒

🆕 新着物件: なし
🕐 レポート時刻: 15:00:00
```

#### エラー通知（管理者のみ）
```html
🚨 <b>監視エラー発生</b>

📍 URL: 新宿エリア
⚠️ エラー: Puppeteer timeout after 20000ms

📊 詳細:
• 発生時刻: 14:45:38
• 連続エラー: 3回目
• 最後の成功: 13:30:15

対応が必要な可能性があります。
```

### Webhook API

#### POST /webhook/telegram
Telegram Webhookを受信します。

**リクエスト**
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 123,
    "from": {
      "id": 987654321,
      "is_bot": false,
      "first_name": "User",
      "username": "username"
    },
    "chat": {
      "id": -1001234567890,
      "type": "group"
    },
    "date": 1693036738,
    "text": "/start"
  }
}
```

**レスポンス**
```json
{
  "status": "ok",
  "processed": true
}
```

## 🔐 認証・セキュリティ

### Telegram Bot認証

#### Bot Token検証
```typescript
// Bot Token検証
const validateBotToken = (token: string): boolean => {
  const tokenPattern = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;
  return tokenPattern.test(token);
};
```

#### Chat ID検証
```typescript
// 許可されたChat IDの検証
const isAuthorizedChat = (chatId: number): boolean => {
  const authorizedChats = process.env.TELEGRAM_CHAT_ID
    .split(',')
    .map(id => parseInt(id.trim()));
  
  return authorizedChats.includes(chatId);
};
```

### レート制限

#### Telegram API制限
- **メッセージ送信**: 30メッセージ/秒
- **同一チャット**: 1メッセージ/秒
- **ファイル送信**: 20MB/ファイル

#### 内部API制限
```typescript
// Express rate limiting
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 最大100リクエスト
  message: 'Too many requests, please try again later.'
});

app.use('/api/', apiLimiter);
```

## 🐛 エラーハンドリング

### API エラーレスポンス

#### 標準エラー形式
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid URL format",
    "details": {
      "field": "url",
      "value": "invalid-url",
      "expected": "Valid HTTP/HTTPS URL"
    },
    "timestamp": "2025-08-26T14:45:38.203Z",
    "requestId": "req-123456789"
  }
}
```

#### HTTPステータスコード
- **200**: 成功
- **400**: リクエストエラー（不正な形式等）
- **401**: 認証エラー
- **403**: 権限エラー
- **404**: リソース未発見
- **429**: レート制限超過
- **500**: サーバーエラー

### Telegram エラーハンドリング

#### Bot API エラー処理
```typescript
// Telegram API エラー処理
bot.catch((err: any, ctx: Context) => {
  logger.error('telegram.error', {
    error: err.message,
    code: err.code,
    description: err.description,
    chatId: ctx.chat?.id,
    timestamp: new Date().toISOString()
  });
  
  // ユーザーにエラー通知
  return ctx.reply('❌ 一時的なエラーが発生しました。しばらく後に再試行してください。');
});
```

#### 送信エラーリトライ
```typescript
// メッセージ送信リトライ機能
const sendMessageWithRetry = async (
  chatId: string,
  text: string,
  maxRetries: number = 3
): Promise<boolean> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
      return true;
    } catch (error) {
      logger.warn('telegram.send_retry', {
        attempt,
        maxRetries,
        error: error.message,
        chatId
      });
      
      if (attempt === maxRetries) {
        logger.error('telegram.send_failed', { chatId, error: error.message });
        return false;
      }
      
      // 指数バックオフ
      await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000));
    }
  }
  return false;
};
```

## 📊 ログ・監視

### API アクセスログ
```typescript
// Express アクセスログミドルウェア
import { logger } from './logger.js';

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    logger.info('api.access', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: Date.now() - start,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  });
  
  next();
});
```

### Telegram活動ログ
```typescript
// Telegram活動ログ
bot.use((ctx, next) => {
  logger.info('telegram.activity', {
    updateType: ctx.updateType,
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    username: ctx.from?.username,
    command: ctx.message?.text?.split(' ')[0],
    timestamp: new Date().toISOString()
  });
  
  return next();
});
```

## 📚 SDK・クライアント例

### Node.js クライアント例
```typescript
// ソクブツAPIクライアント
class SokubutsuClient {
  constructor(private baseUrl: string, private adminToken?: string) {}
  
  async getHealthStatus(): Promise<HealthStatus> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }
  
  async getSystemStatus(): Promise<SystemStatus> {
    const response = await fetch(`${this.baseUrl}/admin/status`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`
      }
    });
    return response.json();
  }
  
  async getMonitoringStatistics(): Promise<MonitoringStats> {
    const response = await fetch(`${this.baseUrl}/api/monitoring/statistics`);
    return response.json();
  }
}

// 使用例
const client = new SokubutsuClient('http://localhost:3000', 'admin-token');
const health = await client.getHealthStatus();
console.log('System status:', health.status);
```

### curl コマンド例
```bash
# ヘルスチェック
curl -X GET http://localhost:3000/health

# システム状況確認
curl -X GET http://localhost:3000/admin/status \
  -H "Authorization: Bearer your-admin-token"

# 監視統計取得
curl -X GET http://localhost:3000/api/monitoring/statistics

# ログ取得（直近100件）
curl -X GET "http://localhost:3000/admin/logs?limit=100&level=error" \
  -H "Authorization: Bearer your-admin-token"
```

## 📈 パフォーマンス仕様

### レスポンス時間目標
- **Health Check**: < 50ms
- **Admin API**: < 200ms
- **Monitoring API**: < 500ms
- **Telegram送信**: < 2000ms

### スループット目標
- **Health Check**: 1000 req/sec
- **Admin API**: 100 req/sec
- **Telegram通知**: 30 msg/sec

---

**更新日**: 2025年8月26日  
**バージョン**: 2.0（HTML形式通知対応）