# ソクブツ システム設計書

**バージョン**: 1.0  
**作成日**: 2025年7月25日  
**作成者**: テックリード（Manus AI）  
**対象プロジェクト**: ソクブツ（sokubutsu2）

## 概要

ソクブツは物件新着通知システムです。不動産ポータルサイトを定期的に監視し、新着物件が掲載された際に即座にユーザーへTelegram通知するサービスを提供します。

### プロジェクト目標
- **3日以内リリース**: MVP（最小限の機能）での迅速な市場投入
- **自宅サーバー運用**: 低コストでの安定稼働
- **Bot検知回避**: 高度なスクレイピング技術による継続的監視

## システム全体アーキテクチャ

### 高レベルアーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                    自宅サーバー (WSL2)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Docker Container                         │ │
│  │  ┌─────────────────────────────────────────────────────┐│ │
│  │  │              NestJS Application                     ││ │
│  │  │                                                     ││ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐││ │
│  │  │  │   REST API   │  │ Telegram Bot │  │ Task Scheduler││ │
│  │  │  │              │  │              │  │             ││ │
│  │  │  └──────────────┘  └──────────────┘  └─────────────┘││ │
│  │  │                                                     ││ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐││ │
│  │  │  │   URL Mgmt   │  │ Notification │  │  Scraping   ││ │
│  │  │  │              │  │              │  │             ││ │
│  │  │  └──────────────┘  └──────────────┘  └─────────────┘││ │
│  │  │                                                     ││ │
│  │  │  ┌─────────────────────────────────────────────────┐││ │
│  │  │  │              SQLite Database                    ││ │
│  │  │  └─────────────────────────────────────────────────┘││ │
│  │  └─────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      External Services                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │  Telegram API   │  │ Property Sites  │  │   Monitoring    ││
│  │                 │  │                 │  │                 ││
│  │  - Bot Messages │  │ - at-home.co.jp │  │ - Health Check  ││
│  │  - User Mgmt    │  │ - Other Sites   │  │ - Alerts        ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### データフロー図

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │───▶│ Telegram    │───▶│   NestJS    │
│             │    │   Bot       │    │ Application │
└─────────────┘    └─────────────┘    └─────────────┘
                                              │
                                              ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Property   │◀───│  Playwright │◀───│ Task        │
│   Sites     │    │  Scraper    │    │ Scheduler   │
└─────────────┘    └─────────────┘    └─────────────┘
                                              │
                                              ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Telegram    │◀───│ Notification│◀───│   SQLite    │
│   Users     │    │  Service    │    │  Database   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 技術スタック

### 技術選定理由

#### バックエンドフレームワーク: NestJS
**選定理由**:
- **TypeScript完全対応**: 型安全性による開発効率向上
- **モジュラーアーキテクチャ**: 機能別の明確な分離
- **豊富なエコシステム**: TypeORM、Swagger等の統合
- **エンタープライズ対応**: 大規模開発に適した設計

**メリット**:
- 開発効率の向上
- 保守性の確保
- テスタビリティの向上
- 豊富なドキュメント

**デメリット**:
- 学習コストが高い
- 小規模プロジェクトには過剰
- メモリ使用量がやや多い

#### データベース: SQLite → better-sqlite3
**選定理由**:
- **軽量性**: ファイルベースで管理が簡単
- **高性能**: better-sqlite3は同期処理で高速
- **自宅サーバー適合**: 複雑な設定不要
- **移行容易性**: PostgreSQLへの移行パスが明確

**メリット**:
- セットアップが簡単
- バックアップが容易
- リソース使用量が少ない
- 開発環境と本番環境の統一

**デメリット**:
- 同時接続数の制限
- 複雑なクエリの性能制限
- レプリケーション機能なし

#### スクレイピング: Playwright
**選定理由**:
- **Bot検知回避**: 高度なステルス機能
- **安定性**: 要素待機処理が優秀
- **マルチブラウザ対応**: Chrome、Firefox、Safari
- **企業レベル信頼性**: Microsoft開発

**メリット**:
- 高い成功率
- 豊富な機能
- 活発な開発
- 優秀なドキュメント

**デメリット**:
- リソース使用量が多い
- 学習コストが高い
- ブラウザダウンロードが必要

#### 通知システム: Telegram Bot
**選定理由**:
- **即時性**: リアルタイム通知
- **使いやすさ**: 直感的なコマンド操作
- **無料**: API使用料無料
- **豊富な機能**: ボタン、画像、ファイル送信対応

**メリット**:
- 開発コストが低い
- ユーザビリティが高い
- 拡張性がある
- 信頼性が高い

**デメリット**:
- Telegramアカウントが必要
- API制限がある
- 日本での普及率が低い

## モジュール設計

### アプリケーション構成

```
src/
├── app.module.ts           # ルートモジュール
├── app.controller.ts       # メインコントローラー
├── app.service.ts          # メインサービス
├── main.ts                 # エントリーポイント
├── notification/           # 通知機能モジュール
│   ├── notification.module.ts
│   ├── notification.service.ts
│   └── notification.service.spec.ts
├── scraping/              # スクレイピング機能モジュール
│   ├── scraping.module.ts
│   ├── scraping.service.ts
│   └── scraping.service.spec.ts
├── task-scheduler/        # タスクスケジューラーモジュール
│   ├── task-scheduler.module.ts
│   ├── task-scheduler.service.ts
│   └── task-scheduler.service.spec.ts
└── url/                   # URL管理モジュール
    ├── url.module.ts
    ├── url.service.ts
    ├── url.entity.ts
    └── url.service.spec.ts
```

### モジュール間依存関係

```
┌─────────────────┐
│   App Module    │
└─────────────────┘
         │
    ┌────┴────┬────────────┬─────────────┐
    │         │            │             │
┌───▼───┐ ┌──▼──┐ ┌───────▼───┐ ┌───────▼────┐
│  URL  │ │Notif│ │ Scraping  │ │Task Sched  │
│Module │ │Module│ │  Module   │ │   Module   │
└───────┘ └─────┘ └───────────┘ └────────────┘
    │         ▲            │             │
    └─────────┼────────────┴─────────────┘
              │
         ┌────▼────┐
         │Database │
         │(SQLite) │
         └─────────┘
```

### 各モジュールの責務

#### URL Module
**責務**: 監視対象URLの管理
- URL登録・更新・削除
- 監視状態の管理
- URLバリデーション

**主要クラス**:
```typescript
@Entity()
export class Url {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  url: string;

  @Column()
  selector: string;

  @Column({ type: 'text', nullable: true })
  contentHash: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### Scraping Module
**責務**: Webサイトのスクレイピング
- Playwrightによるページアクセス
- コンテンツハッシュの生成・比較
- Bot検知回避処理

**主要機能**:
```typescript
@Injectable()
export class ScrapingService {
  async scrapeUrl(url: Url): Promise<ScrapingResult> {
    // Playwrightでページアクセス
    // セレクターでコンテンツ取得
    // ハッシュ値計算・比較
    // 新着判定
  }
}
```

#### Notification Module
**責務**: 通知の送信
- Telegram Bot API連携
- 通知メッセージの生成
- 通知履歴の管理

**主要機能**:
```typescript
@Injectable()
export class NotificationService {
  async sendNewContentAlert(url: Url): Promise<void> {
    // 新着通知の送信
  }

  async sendStatusReport(): Promise<void> {
    // 定期ステータス報告
  }

  async sendErrorAlert(error: Error): Promise<void> {
    // エラー通知
  }
}
```

#### Task Scheduler Module
**責務**: 定期実行タスクの管理
- 監視タスクのスケジューリング
- タスク実行状況の管理
- エラーハンドリング

**主要機能**:
```typescript
@Injectable()
export class TaskSchedulerService {
  @Cron('*/5 * * * *') // 5分毎
  async executeMonitoring(): Promise<void> {
    // 全アクティブURLの監視実行
  }

  @Cron('0 * * * *') // 1時間毎
  async sendStatusReport(): Promise<void> {
    // ステータス報告送信
  }
}
```

## データベース設計

### エンティティ関係図

```
┌─────────────────┐     ┌─────────────────┐
│      User       │     │       Url       │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ telegramId      │     │ name            │
│ username        │     │ url (UNIQUE)    │
│ isActive        │     │ selector        │
│ createdAt       │     │ contentHash     │
│ updatedAt       │     │ isActive        │
└─────────────────┘     │ createdAt       │
                        │ updatedAt       │
                        └─────────────────┘
                                │
                                │ 1:N
                                ▼
                        ┌─────────────────┐
                        │ MonitoringLog   │
                        ├─────────────────┤
                        │ id (PK)         │
                        │ urlId (FK)      │
                        │ status          │
                        │ hasNewContent   │
                        │ contentHash     │
                        │ executedAt      │
                        │ errorMessage    │
                        └─────────────────┘
```

### テーブル定義

#### users テーブル
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### urls テーブル
```sql
CREATE TABLE urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) UNIQUE NOT NULL,
  selector VARCHAR(255) NOT NULL,
  content_hash TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### monitoring_logs テーブル
```sql
CREATE TABLE monitoring_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_id INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  has_new_content BOOLEAN DEFAULT FALSE,
  content_hash TEXT,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,
  FOREIGN KEY (url_id) REFERENCES urls(id)
);
```

## セキュリティ設計

### Bot検知回避戦略

#### 1. User-Agent ローテーション
```typescript
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
];
```

#### 2. アクセスパターンの人間化
```typescript
// ランダム待機時間
const delay = Math.random() * 3000 + 1000; // 1-4秒
await page.waitForTimeout(delay);

// 人間的なマウス移動
await page.mouse.move(
  Math.random() * 800,
  Math.random() * 600
);
```

#### 3. プロキシローテーション（将来実装）
```typescript
const proxies = [
  'http://proxy1:8080',
  'http://proxy2:8080',
  'http://proxy3:8080'
];
```

### アプリケーションセキュリティ

#### 1. 入力値検証
```typescript
@IsUrl()
@IsNotEmpty()
url: string;

@IsString()
@Length(1, 100)
name: string;

@IsString()
@Length(1, 255)
selector: string;
```

#### 2. セキュリティヘッダー
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

#### 3. レート制限
```typescript
app.use(rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 100, // 最大100リクエスト
  message: 'Too many requests from this IP'
}));
```

## パフォーマンス設計

### 監視処理の最適化

#### 1. 並列処理
```typescript
async executeMonitoring(): Promise<void> {
  const activeUrls = await this.urlService.findActive();
  
  // 最大5並列で処理
  const chunks = this.chunkArray(activeUrls, 5);
  
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(url => this.scrapingService.scrapeUrl(url))
    );
  }
}
```

#### 2. キャッシュ戦略
```typescript
// メモリキャッシュでハッシュ値を保持
private contentHashCache = new Map<number, string>();

async checkForNewContent(url: Url): Promise<boolean> {
  const cachedHash = this.contentHashCache.get(url.id);
  const currentHash = await this.generateContentHash(url);
  
  if (cachedHash !== currentHash) {
    this.contentHashCache.set(url.id, currentHash);
    return true;
  }
  
  return false;
}
```

#### 3. データベース最適化
```sql
-- インデックス作成
CREATE INDEX idx_urls_is_active ON urls(is_active);
CREATE INDEX idx_monitoring_logs_url_id ON monitoring_logs(url_id);
CREATE INDEX idx_monitoring_logs_executed_at ON monitoring_logs(executed_at);
```

## 運用設計

### ログ設計

#### 1. アプリケーションログ
```typescript
@Injectable()
export class LoggerService {
  private logger = new Logger(LoggerService.name);

  logMonitoringStart(url: Url): void {
    this.logger.log(`Monitoring started for ${url.name} (${url.url})`);
  }

  logNewContentFound(url: Url): void {
    this.logger.warn(`New content found for ${url.name}`);
  }

  logMonitoringError(url: Url, error: Error): void {
    this.logger.error(`Monitoring failed for ${url.name}: ${error.message}`);
  }
}
```

#### 2. ログローテーション
```typescript
// winston設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});
```

### 監視・アラート

#### 1. ヘルスチェック
```typescript
@Controller('health')
export class HealthController {
  @Get()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.telegram.pingCheck('telegram'),
      () => this.disk.checkStorage('storage', { 
        path: '/', 
        thresholdPercent: 0.9 
      }),
    ]);
  }
}
```

#### 2. メトリクス収集
```typescript
// Prometheus メトリクス
const monitoringCounter = new Counter({
  name: 'sokubutsu_monitoring_total',
  help: 'Total number of monitoring executions',
  labelNames: ['status', 'url_id']
});

const newContentCounter = new Counter({
  name: 'sokubutsu_new_content_total',
  help: 'Total number of new content detections'
});
```

## 拡張性設計

### 水平スケーリング対応

#### 1. ステートレス設計
- セッション情報はデータベースに保存
- インメモリキャッシュは最小限に抑制
- ファイルシステムへの依存を排除

#### 2. データベース分離
```typescript
// 読み取り専用レプリカ対応
@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(Url, 'master') 
    private urlMasterRepo: Repository<Url>,
    
    @InjectRepository(Url, 'slave') 
    private urlSlaveRepo: Repository<Url>
  ) {}

  async findUrls(): Promise<Url[]> {
    return this.urlSlaveRepo.find(); // 読み取りはスレーブから
  }

  async saveUrl(url: Url): Promise<Url> {
    return this.urlMasterRepo.save(url); // 書き込みはマスターへ
  }
}
```

### 機能拡張対応

#### 1. プラグインアーキテクチャ
```typescript
interface ScrapingPlugin {
  name: string;
  supports(url: string): boolean;
  scrape(url: string): Promise<ScrapingResult>;
}

@Injectable()
export class ScrapingService {
  private plugins: ScrapingPlugin[] = [];

  registerPlugin(plugin: ScrapingPlugin): void {
    this.plugins.push(plugin);
  }

  async scrapeUrl(url: Url): Promise<ScrapingResult> {
    const plugin = this.plugins.find(p => p.supports(url.url));
    return plugin ? plugin.scrape(url.url) : this.defaultScrape(url);
  }
}
```

#### 2. 設定駆動開発
```typescript
interface SiteConfig {
  domain: string;
  selector: string;
  waitTime: number;
  userAgent: string;
  customHeaders?: Record<string, string>;
}

const siteConfigs: SiteConfig[] = [
  {
    domain: 'at-home.co.jp',
    selector: '.property-list',
    waitTime: 2000,
    userAgent: 'Mozilla/5.0...'
  }
];
```

## 今後の技術的課題

### 短期課題（1ヶ月以内）
1. **SQLite3 → better-sqlite3 移行**
2. **Docker環境の最適化**
3. **CI/CD パイプライン構築**
4. **監視・ログシステム実装**

### 中期課題（3ヶ月以内）
1. **PostgreSQL移行**
2. **Redis導入（キャッシュ・セッション）**
3. **マイクロサービス化検討**
4. **負荷分散対応**

### 長期課題（6ヶ月以内）
1. **Kubernetes対応**
2. **AI/ML機能統合**
3. **リアルタイム通知システム**
4. **グローバル展開対応**

---

**注意**: この設計書は現在の実装状況と将来の拡張性を考慮して作成されており、開発進捗に応じて継続的に更新される予定です。

