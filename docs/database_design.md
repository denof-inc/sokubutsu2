# ソクブツ データベース設計書

**バージョン**: 1.0  
**作成日**: 2025年7月25日  
**作成者**: テックリード（Manus AI）  
**対象プロジェクト**: ソクブツ（sokubutsu2）

## 概要

ソクブツのデータベース設計は、物件監視システムに必要なデータを効率的に管理するために設計されています。初期はSQLiteを使用し、将来的にPostgreSQLへの移行を想定した拡張可能な設計となっています。

### 設計方針
- **シンプルさ**: 必要最小限のテーブル構成
- **拡張性**: PostgreSQL移行を考慮した設計
- **パフォーマンス**: 適切なインデックス設計
- **整合性**: 外部キー制約による参照整合性

## データベース技術選定

### 現在: SQLite → better-sqlite3

#### 選定理由
1. **軽量性**: ファイルベースで管理が簡単
2. **高性能**: better-sqlite3は同期処理で高速
3. **自宅サーバー適合**: 複雑な設定不要
4. **開発効率**: セットアップが迅速

#### better-sqlite3 vs sqlite3 比較

| 項目 | better-sqlite3 | sqlite3 |
|------|----------------|---------|
| **パフォーマンス** | 高速（同期処理） | 中程度（非同期処理） |
| **Docker対応** | 優秀 | 問題あり（ビルドエラー） |
| **メモリ使用量** | 少ない | 中程度 |
| **TypeORM対応** | 完全対応 | 完全対応 |
| **学習コスト** | 低い | 低い |

### 将来: PostgreSQL

#### 移行理由
1. **同時接続数**: 複数ユーザー対応
2. **高度なクエリ**: 複雑な検索・集計
3. **レプリケーション**: 高可用性の実現
4. **拡張性**: 大量データ処理

## エンティティ関係図（ER図）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ソクブツ ER図                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐                    ┌─────────────────┐
│      users      │                    │      urls       │
├─────────────────┤                    ├─────────────────┤
│ id (PK)         │                    │ id (PK)         │
│ telegram_id     │◀──────────────────▶│ user_id (FK)    │
│ username        │       1:N          │ name            │
│ first_name      │                    │ url             │
│ last_name       │                    │ selector        │
│ is_active       │                    │ content_hash    │
│ created_at      │                    │ is_active       │
│ updated_at      │                    │ created_at      │
└─────────────────┘                    │ updated_at      │
                                       └─────────────────┘
                                               │
                                               │ 1:N
                                               ▼
                                       ┌─────────────────┐
                                       │ monitoring_logs │
                                       ├─────────────────┤
                                       │ id (PK)         │
                                       │ url_id (FK)     │
                                       │ status          │
                                       │ has_new_content │
                                       │ content_hash    │
                                       │ response_time   │
                                       │ error_message   │
                                       │ executed_at     │
                                       └─────────────────┘

┌─────────────────┐                    ┌─────────────────┐
│  notifications  │                    │   user_urls     │
├─────────────────┤                    ├─────────────────┤
│ id (PK)         │                    │ id (PK)         │
│ user_id (FK)    │                    │ user_id (FK)    │
│ url_id (FK)     │                    │ url_id (FK)     │
│ type            │                    │ created_at      │
│ message         │                    └─────────────────┘
│ sent_at         │                           │
│ status          │                           │ N:M
└─────────────────┘                           │
        │                                     │
        │ N:1                                 │
        ▼                                     ▼
┌─────────────────┐                    ┌─────────────────┐
│      users      │                    │      urls       │
│   (参照先)       │                    │   (参照先)       │
└─────────────────┘                    └─────────────────┘
```

## テーブル設計

### 1. users テーブル

#### 概要
Telegramユーザーの情報を管理するテーブル

#### テーブル定義
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'ja',
    is_active BOOLEAN DEFAULT TRUE,
    max_urls INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### フィールド詳細

| フィールド名 | データ型 | 制約 | 説明 |
|-------------|----------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | 内部ID |
| `telegram_id` | VARCHAR(255) | UNIQUE, NOT NULL | Telegram ユーザーID |
| `username` | VARCHAR(255) | NULL | Telegram ユーザー名 |
| `first_name` | VARCHAR(255) | NULL | 名前 |
| `last_name` | VARCHAR(255) | NULL | 姓 |
| `language_code` | VARCHAR(10) | DEFAULT 'ja' | 言語設定 |
| `is_active` | BOOLEAN | DEFAULT TRUE | アクティブ状態 |
| `max_urls` | INTEGER | DEFAULT 3 | 登録可能URL数上限 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新日時 |

#### インデックス
```sql
CREATE UNIQUE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
```

#### TypeORM エンティティ
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  telegramId: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ default: 'ja' })
  languageCode: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 3 })
  maxUrls: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserUrl, userUrl => userUrl.user)
  userUrls: UserUrl[];
}
```

### 2. urls テーブル

#### 概要
監視対象URLの情報を管理するテーブル

#### テーブル定義
```sql
CREATE TABLE urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) UNIQUE NOT NULL,
    selector VARCHAR(255) NOT NULL,
    content_hash TEXT,
    check_interval INTEGER DEFAULT 300,
    timeout_seconds INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    last_checked_at DATETIME,
    last_content_change_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### フィールド詳細

| フィールド名 | データ型 | 制約 | 説明 |
|-------------|----------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | 内部ID |
| `name` | VARCHAR(255) | NOT NULL | URL表示名 |
| `url` | VARCHAR(500) | UNIQUE, NOT NULL | 監視対象URL |
| `selector` | VARCHAR(255) | NOT NULL | CSSセレクター |
| `content_hash` | TEXT | NULL | 前回取得コンテンツのハッシュ |
| `check_interval` | INTEGER | DEFAULT 300 | チェック間隔（秒） |
| `timeout_seconds` | INTEGER | DEFAULT 30 | タイムアウト時間（秒） |
| `is_active` | BOOLEAN | DEFAULT TRUE | 監視有効フラグ |
| `last_checked_at` | DATETIME | NULL | 最終チェック日時 |
| `last_content_change_at` | DATETIME | NULL | 最終コンテンツ変更日時 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新日時 |

#### インデックス
```sql
CREATE UNIQUE INDEX idx_urls_url ON urls(url);
CREATE INDEX idx_urls_is_active ON urls(is_active);
CREATE INDEX idx_urls_last_checked_at ON urls(last_checked_at);
CREATE INDEX idx_urls_created_at ON urls(created_at);
```

#### TypeORM エンティティ
```typescript
@Entity('urls')
export class Url {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true, length: 500 })
  url: string;

  @Column()
  selector: string;

  @Column({ type: 'text', nullable: true })
  contentHash: string;

  @Column({ default: 300 })
  checkInterval: number;

  @Column({ default: 30 })
  timeoutSeconds: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastCheckedAt: Date;

  @Column({ nullable: true })
  lastContentChangeAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserUrl, userUrl => userUrl.url)
  userUrls: UserUrl[];

  @OneToMany(() => MonitoringLog, log => log.url)
  monitoringLogs: MonitoringLog[];
}
```

### 3. user_urls テーブル（中間テーブル）

#### 概要
ユーザーとURLの多対多関係を管理する中間テーブル

#### テーブル定義
```sql
CREATE TABLE user_urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url_id INTEGER NOT NULL,
    nickname VARCHAR(255),
    is_notification_enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE,
    UNIQUE(user_id, url_id)
);
```

#### フィールド詳細

| フィールド名 | データ型 | 制約 | 説明 |
|-------------|----------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | 内部ID |
| `user_id` | INTEGER | NOT NULL, FK | ユーザーID |
| `url_id` | INTEGER | NOT NULL, FK | URL ID |
| `nickname` | VARCHAR(255) | NULL | ユーザー独自の名前 |
| `is_notification_enabled` | BOOLEAN | DEFAULT TRUE | 通知有効フラグ |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 作成日時 |

#### インデックス
```sql
CREATE UNIQUE INDEX idx_user_urls_user_url ON user_urls(user_id, url_id);
CREATE INDEX idx_user_urls_user_id ON user_urls(user_id);
CREATE INDEX idx_user_urls_url_id ON user_urls(url_id);
```

#### TypeORM エンティティ
```typescript
@Entity('user_urls')
export class UserUrl {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  urlId: number;

  @Column({ nullable: true })
  nickname: string;

  @Column({ default: true })
  isNotificationEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, user => user.userUrls, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Url, url => url.userUrls, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'url_id' })
  url: Url;
}
```

### 4. monitoring_logs テーブル

#### 概要
監視実行の履歴とログを管理するテーブル

#### テーブル定義
```sql
CREATE TABLE monitoring_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    has_new_content BOOLEAN DEFAULT FALSE,
    content_hash TEXT,
    response_time INTEGER,
    error_message TEXT,
    user_agent VARCHAR(500),
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE
);
```

#### フィールド詳細

| フィールド名 | データ型 | 制約 | 説明 |
|-------------|----------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | 内部ID |
| `url_id` | INTEGER | NOT NULL, FK | URL ID |
| `status` | VARCHAR(50) | NOT NULL | 実行ステータス |
| `has_new_content` | BOOLEAN | DEFAULT FALSE | 新着コンテンツ有無 |
| `content_hash` | TEXT | NULL | 取得コンテンツのハッシュ |
| `response_time` | INTEGER | NULL | レスポンス時間（ミリ秒） |
| `error_message` | TEXT | NULL | エラーメッセージ |
| `user_agent` | VARCHAR(500) | NULL | 使用したUser-Agent |
| `executed_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 実行日時 |

#### ステータス値
- `success`: 正常完了
- `error`: エラー発生
- `timeout`: タイムアウト
- `blocked`: アクセス拒否
- `not_found`: ページ未発見

#### インデックス
```sql
CREATE INDEX idx_monitoring_logs_url_id ON monitoring_logs(url_id);
CREATE INDEX idx_monitoring_logs_executed_at ON monitoring_logs(executed_at);
CREATE INDEX idx_monitoring_logs_status ON monitoring_logs(status);
CREATE INDEX idx_monitoring_logs_has_new_content ON monitoring_logs(has_new_content);
```

#### TypeORM エンティティ
```typescript
@Entity('monitoring_logs')
export class MonitoringLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  urlId: number;

  @Column()
  status: 'success' | 'error' | 'timeout' | 'blocked' | 'not_found';

  @Column({ default: false })
  hasNewContent: boolean;

  @Column({ type: 'text', nullable: true })
  contentHash: string;

  @Column({ nullable: true })
  responseTime: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ nullable: true, length: 500 })
  userAgent: string;

  @CreateDateColumn()
  executedAt: Date;

  @ManyToOne(() => Url, url => url.monitoringLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'url_id' })
  url: Url;
}
```

### 5. notifications テーブル

#### 概要
送信された通知の履歴を管理するテーブル

#### テーブル定義
```sql
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url_id INTEGER,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    telegram_message_id VARCHAR(255),
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE SET NULL
);
```

#### フィールド詳細

| フィールド名 | データ型 | 制約 | 説明 |
|-------------|----------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | 内部ID |
| `user_id` | INTEGER | NOT NULL, FK | ユーザーID |
| `url_id` | INTEGER | FK | URL ID（NULL可） |
| `type` | VARCHAR(50) | NOT NULL | 通知タイプ |
| `title` | VARCHAR(255) | NULL | 通知タイトル |
| `message` | TEXT | NOT NULL | 通知メッセージ |
| `status` | VARCHAR(50) | DEFAULT 'pending' | 送信ステータス |
| `telegram_message_id` | VARCHAR(255) | NULL | TelegramメッセージID |
| `sent_at` | DATETIME | NULL | 送信日時 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 作成日時 |

#### 通知タイプ
- `new_content`: 新着コンテンツ通知
- `status_report`: ステータス報告
- `error_alert`: エラーアラート
- `welcome`: ウェルカムメッセージ
- `system`: システム通知

#### ステータス値
- `pending`: 送信待ち
- `sent`: 送信完了
- `failed`: 送信失敗
- `cancelled`: 送信キャンセル

#### インデックス
```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_url_id ON notifications(url_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

#### TypeORM エンティティ
```typescript
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ nullable: true })
  urlId: number;

  @Column()
  type: 'new_content' | 'status_report' | 'error_alert' | 'welcome' | 'system';

  @Column({ nullable: true })
  title: string;

  @Column('text')
  message: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'sent' | 'failed' | 'cancelled';

  @Column({ nullable: true })
  telegramMessageId: string;

  @Column({ nullable: true })
  sentAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Url, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'url_id' })
  url: Url;
}
```

## データベース初期化

### 1. 初期化スクリプト

#### schema.sql
```sql
-- ユーザーテーブル
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'ja',
    is_active BOOLEAN DEFAULT TRUE,
    max_urls INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- URLテーブル
CREATE TABLE urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) UNIQUE NOT NULL,
    selector VARCHAR(255) NOT NULL,
    content_hash TEXT,
    check_interval INTEGER DEFAULT 300,
    timeout_seconds INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    last_checked_at DATETIME,
    last_content_change_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ユーザーURL中間テーブル
CREATE TABLE user_urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url_id INTEGER NOT NULL,
    nickname VARCHAR(255),
    is_notification_enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE,
    UNIQUE(user_id, url_id)
);

-- 監視ログテーブル
CREATE TABLE monitoring_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    has_new_content BOOLEAN DEFAULT FALSE,
    content_hash TEXT,
    response_time INTEGER,
    error_message TEXT,
    user_agent VARCHAR(500),
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE
);

-- 通知テーブル
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url_id INTEGER,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    telegram_message_id VARCHAR(255),
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE SET NULL
);
```

#### indexes.sql
```sql
-- ユーザーテーブルのインデックス
CREATE UNIQUE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

-- URLテーブルのインデックス
CREATE UNIQUE INDEX idx_urls_url ON urls(url);
CREATE INDEX idx_urls_is_active ON urls(is_active);
CREATE INDEX idx_urls_last_checked_at ON urls(last_checked_at);
CREATE INDEX idx_urls_created_at ON urls(created_at);

-- ユーザーURL中間テーブルのインデックス
CREATE UNIQUE INDEX idx_user_urls_user_url ON user_urls(user_id, url_id);
CREATE INDEX idx_user_urls_user_id ON user_urls(user_id);
CREATE INDEX idx_user_urls_url_id ON user_urls(url_id);

-- 監視ログテーブルのインデックス
CREATE INDEX idx_monitoring_logs_url_id ON monitoring_logs(url_id);
CREATE INDEX idx_monitoring_logs_executed_at ON monitoring_logs(executed_at);
CREATE INDEX idx_monitoring_logs_status ON monitoring_logs(status);
CREATE INDEX idx_monitoring_logs_has_new_content ON monitoring_logs(has_new_content);

-- 通知テーブルのインデックス
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_url_id ON notifications(url_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

### 2. TypeORM設定

#### database.config.ts
```typescript
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Url } from './entities/url.entity';
import { UserUrl } from './entities/user-url.entity';
import { MonitoringLog } from './entities/monitoring-log.entity';
import { Notification } from './entities/notification.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'better-sqlite3',
  database: process.env.DATABASE_PATH || 'sokubutsu.sqlite',
  entities: [User, Url, UserUrl, MonitoringLog, Notification],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  migrations: ['dist/migrations/*.js'],
  migrationsRun: true,
};
```

## マイグレーション戦略

### 1. SQLite → better-sqlite3 移行

#### 移行手順
```bash
# 1. 現在のデータをバックアップ
cp sokubutsu.sqlite sokubutsu_backup.sqlite

# 2. better-sqlite3をインストール
pnpm remove sqlite3
pnpm add better-sqlite3

# 3. TypeORM設定を更新
# type: 'sqlite' → type: 'better-sqlite3'

# 4. アプリケーション再起動
pnpm run start:dev
```

#### データ移行スクリプト
```typescript
// migration/sqlite-to-better-sqlite3.ts
import Database from 'better-sqlite3';
import * as sqlite3 from 'sqlite3';

export async function migrateSqliteToBetterSqlite3() {
  const oldDb = new sqlite3.Database('sokubutsu_old.sqlite');
  const newDb = new Database('sokubutsu.sqlite');

  // テーブル作成
  const schema = fs.readFileSync('schema.sql', 'utf8');
  newDb.exec(schema);

  // データ移行
  const tables = ['users', 'urls', 'user_urls', 'monitoring_logs', 'notifications'];
  
  for (const table of tables) {
    const rows = await queryOldDb(`SELECT * FROM ${table}`);
    const insert = newDb.prepare(`INSERT INTO ${table} VALUES (?)`);
    
    for (const row of rows) {
      insert.run(Object.values(row));
    }
  }

  newDb.close();
  oldDb.close();
}
```

### 2. PostgreSQL移行準備

#### 移行計画
1. **Phase 1**: スキーマ設計の調整
2. **Phase 2**: データ型の最適化
3. **Phase 3**: インデックス戦略の見直し
4. **Phase 4**: 実データ移行

#### PostgreSQL用スキーマ
```sql
-- PostgreSQL版スキーマ（将来用）
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'ja',
    is_active BOOLEAN DEFAULT TRUE,
    max_urls INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 他のテーブルも同様に調整
```

## パフォーマンス最適化

### 1. クエリ最適化

#### よく使用されるクエリ
```sql
-- アクティブなURLの取得
SELECT * FROM urls 
WHERE is_active = TRUE 
ORDER BY last_checked_at ASC NULLS FIRST;

-- ユーザーの登録URL一覧
SELECT u.*, uu.nickname, uu.is_notification_enabled
FROM urls u
JOIN user_urls uu ON u.id = uu.url_id
WHERE uu.user_id = ? AND u.is_active = TRUE;

-- 最近の監視ログ
SELECT * FROM monitoring_logs 
WHERE url_id = ? 
ORDER BY executed_at DESC 
LIMIT 10;
```

#### インデックス効果測定
```sql
-- クエリプランの確認
EXPLAIN QUERY PLAN 
SELECT * FROM urls WHERE is_active = TRUE;

-- インデックス使用状況
PRAGMA index_info(idx_urls_is_active);
```

### 2. データ保持ポリシー

#### ログローテーション
```sql
-- 30日以上古い監視ログを削除
DELETE FROM monitoring_logs 
WHERE executed_at < datetime('now', '-30 days');

-- 90日以上古い通知履歴を削除
DELETE FROM notifications 
WHERE created_at < datetime('now', '-90 days') 
AND status = 'sent';
```

#### 自動クリーンアップ
```typescript
@Cron('0 2 * * *') // 毎日2時に実行
async cleanupOldLogs(): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await this.monitoringLogRepository
    .createQueryBuilder()
    .delete()
    .where('executed_at < :date', { date: thirtyDaysAgo })
    .execute();
}
```

## バックアップ・復旧

### 1. バックアップ戦略

#### 日次バックアップ
```bash
#!/bin/bash
# daily-backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ubuntu/backups"
DB_FILE="sokubutsu.sqlite"

# データベースファイルをコピー
cp $DB_FILE $BACKUP_DIR/sokubutsu_$DATE.sqlite

# 7日以上古いバックアップを削除
find $BACKUP_DIR -name "sokubutsu_*.sqlite" -mtime +7 -delete

# バックアップ完了をログに記録
echo "$(date): Backup completed - sokubutsu_$DATE.sqlite" >> $BACKUP_DIR/backup.log
```

#### 週次フルバックアップ
```bash
#!/bin/bash
# weekly-backup.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR="/home/ubuntu/backups/weekly"

# SQLダンプを作成
sqlite3 sokubutsu.sqlite .dump > $BACKUP_DIR/sokubutsu_dump_$DATE.sql

# 圧縮
gzip $BACKUP_DIR/sokubutsu_dump_$DATE.sql

# 4週間以上古いダンプを削除
find $BACKUP_DIR -name "sokubutsu_dump_*.sql.gz" -mtime +28 -delete
```

### 2. 復旧手順

#### データベースファイル復旧
```bash
# 1. サービス停止
docker-compose down

# 2. 現在のファイルをバックアップ
mv sokubutsu.sqlite sokubutsu_corrupted.sqlite

# 3. バックアップから復旧
cp backups/sokubutsu_20250725_020000.sqlite sokubutsu.sqlite

# 4. サービス再開
docker-compose up -d
```

#### SQLダンプからの復旧
```bash
# 1. 新しいデータベースファイルを作成
rm sokubutsu.sqlite

# 2. ダンプから復旧
gunzip -c backups/weekly/sokubutsu_dump_20250725.sql.gz | sqlite3 sokubutsu.sqlite

# 3. 権限設定
chmod 644 sokubutsu.sqlite
```

## セキュリティ考慮事項

### 1. データ保護

#### 機密情報の暗号化
```typescript
// 機密情報は暗号化して保存
@Column({ transformer: {
  to: (value: string) => encrypt(value),
  from: (value: string) => decrypt(value)
}})
sensitiveData: string;
```

#### アクセス制御
```sql
-- データベースファイルの権限設定
chmod 600 sokubutsu.sqlite
chown app:app sokubutsu.sqlite
```

### 2. SQLインジェクション対策

#### パラメータ化クエリ
```typescript
// 危険な例（使用禁止）
const query = `SELECT * FROM users WHERE telegram_id = '${telegramId}'`;

// 安全な例（推奨）
const user = await this.userRepository.findOne({
  where: { telegramId }
});
```

#### 入力値検証
```typescript
@IsString()
@Length(1, 255)
@Matches(/^[a-zA-Z0-9_]+$/)
telegramId: string;
```

## 監視・メンテナンス

### 1. データベース監視

#### サイズ監視
```sql
-- データベースサイズ確認
SELECT 
  page_count * page_size as size_bytes,
  page_count * page_size / 1024 / 1024 as size_mb
FROM pragma_page_count(), pragma_page_size();
```

#### テーブルサイズ監視
```sql
-- テーブル別レコード数
SELECT 
  name,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as record_count
FROM sqlite_master m 
WHERE type='table';
```

### 2. パフォーマンス監視

#### スロークエリ検出
```typescript
// TypeORMでクエリ実行時間をログ出力
{
  type: 'better-sqlite3',
  logging: ['query', 'error', 'slow'],
  maxQueryExecutionTime: 1000, // 1秒以上のクエリをログ出力
}
```

#### 統計情報収集
```sql
-- インデックス使用統計
PRAGMA optimize;

-- データベース統計更新
ANALYZE;
```

---

**注意**: この設計書は現在の実装状況と将来の拡張性を考慮して作成されており、開発進捗に応じて継続的に更新される予定です。

