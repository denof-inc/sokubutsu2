# RFP完全適合 ベストプラクティス実装指示書
## ソクブツMVP - マルチユーザー対応完全版

### 🎯 **実装目標**
RFP「2.1.2. ユーザー機能」を含む全要件を完璧に満たすマルチユーザー対応システムの実装

### 📊 **実装範囲**
- ✅ **Phase 1-2**: 既存の監視・通知機能（完了済み）
- 🚀 **Phase 3**: マルチユーザー対応（新規実装）
- 🚀 **Phase 4**: Telegramコマンドシステム（新規実装）
- 🚀 **Phase 5**: 管理者機能（新規実装）

---

## 🏗️ **Phase 3: マルチユーザー対応システム**

### **Step 1: データベース設計・実装**

#### **A. データベース選択・設定**
```typescript
// package.json に追加
{
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "typeorm": "^0.3.17",
    "@types/better-sqlite3": "^7.6.8"
  }
}
```

#### **B. エンティティ定義**
```typescript
// src/entities/User.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserUrl } from './UserUrl.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  telegramChatId!: string;

  @Column({ nullable: true })
  telegramUsername?: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  registeredAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => UserUrl, userUrl => userUrl.user)
  urls!: UserUrl[];

  // ビジネスロジック
  canAddUrl(): boolean {
    const activeUrls = this.urls.filter(url => url.isActive);
    return activeUrls.length < 3; // RFP要件: 1-3件制限
  }

  getUrlsByPrefecture(prefecture: string): UserUrl[] {
    return this.urls.filter(url => url.prefecture === prefecture && url.isActive);
  }

  canAddUrlInPrefecture(prefecture: string): boolean {
    const prefectureUrls = this.getUrlsByPrefecture(prefecture);
    return prefectureUrls.length === 0; // RFP要件: 都道府県単位で1つまで
  }
}
```

```typescript
// src/entities/UserUrl.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User.js';

@Entity('user_urls')
export class UserUrl {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  url!: string;

  @Column()
  name!: string;

  @Column()
  prefecture!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: true })
  isMonitoring!: boolean; // 一時停止・再開用

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  userId!: string;

  @ManyToOne(() => User, user => user.urls)
  user!: User;

  // 最後の監視結果
  @Column({ nullable: true })
  lastHash?: string;

  @Column({ nullable: true })
  lastCheckedAt?: Date;

  @Column({ default: 0 })
  newListingsCount!: number;

  @Column({ default: 0 })
  totalChecks!: number;

  @Column({ default: 0 })
  errorCount!: number;
}
```

#### **C. データベース接続設定**
```typescript
// src/database/connection.ts
import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { UserUrl } from '../entities/UserUrl.js';
import { config } from '../config.js';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: `${config.storage.dataDir}/sokubutsu.db`,
  entities: [User, UserUrl],
  synchronize: true, // 開発時のみ
  logging: config.app.env === 'development',
});

export async function initializeDatabase(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('✅ データベース接続完了');
  } catch (error) {
    console.error('❌ データベース接続エラー:', error);
    throw error;
  }
}
```

### **Step 2: ユーザー管理サービス**

#### **A. ユーザーサービス実装**
```typescript
// src/services/UserService.ts
import { Repository } from 'typeorm';
import { User } from '../entities/User.js';
import { UserUrl } from '../entities/UserUrl.js';
import { AppDataSource } from '../database/connection.js';
import { vibeLogger } from '../logger.js';

export class UserService {
  private userRepository: Repository<User>;
  private urlRepository: Repository<UserUrl>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.urlRepository = AppDataSource.getRepository(UserUrl);
  }

  /**
   * ユーザー登録または取得
   */
  async registerOrGetUser(telegramChatId: string, telegramUsername?: string): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { telegramChatId },
      relations: ['urls'],
    });

    if (!user) {
      user = this.userRepository.create({
        telegramChatId,
        telegramUsername,
        isActive: true,
      });
      await this.userRepository.save(user);
      
      vibeLogger.info('user.registered', 'ユーザー登録完了', {
        context: { userId: user.id, telegramChatId, telegramUsername },
        humanNote: '新規ユーザーがサービスに登録しました',
      });
    }

    return user;
  }

  /**
   * URL登録
   */
  async registerUrl(
    userId: string,
    url: string,
    name: string,
    prefecture: string
  ): Promise<{ success: boolean; message: string; userUrl?: UserUrl }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['urls'],
    });

    if (!user) {
      return { success: false, message: 'ユーザーが見つかりません' };
    }

    // RFP要件チェック: URL数制限
    if (!user.canAddUrl()) {
      return { success: false, message: '登録可能URL数の上限（3件）に達しています' };
    }

    // RFP要件チェック: 都道府県制限
    if (!user.canAddUrlInPrefecture(prefecture)) {
      return { success: false, message: `${prefecture}では既にURLが登録されています（1都道府県1URLまで）` };
    }

    // URL重複チェック
    const existingUrl = await this.urlRepository.findOne({
      where: { userId, url, isActive: true },
    });

    if (existingUrl) {
      return { success: false, message: '同じURLが既に登録されています' };
    }

    const userUrl = this.urlRepository.create({
      userId,
      url,
      name,
      prefecture,
      isActive: true,
      isMonitoring: true,
    });

    await this.urlRepository.save(userUrl);

    vibeLogger.info('user.url_registered', 'URL登録完了', {
      context: { userId, urlId: userUrl.id, url, name, prefecture },
      humanNote: 'ユーザーが新しい監視URLを登録しました',
    });

    return { success: true, message: 'URL登録が完了しました', userUrl };
  }

  /**
   * ユーザーのURL一覧取得
   */
  async getUserUrls(userId: string): Promise<UserUrl[]> {
    return this.urlRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * URL監視状態変更（一時停止・再開）
   */
  async toggleUrlMonitoring(userId: string, urlId: string): Promise<{ success: boolean; message: string; isMonitoring?: boolean }> {
    const userUrl = await this.urlRepository.findOne({
      where: { id: urlId, userId, isActive: true },
    });

    if (!userUrl) {
      return { success: false, message: 'URLが見つかりません' };
    }

    userUrl.isMonitoring = !userUrl.isMonitoring;
    await this.urlRepository.save(userUrl);

    const status = userUrl.isMonitoring ? '再開' : '一時停止';
    vibeLogger.info('user.url_toggle', `URL監視${status}`, {
      context: { userId, urlId, isMonitoring: userUrl.isMonitoring },
    });

    return { 
      success: true, 
      message: `「${userUrl.name}」の監視を${status}しました`,
      isMonitoring: userUrl.isMonitoring 
    };
  }

  /**
   * URL削除
   */
  async deleteUrl(userId: string, urlId: string): Promise<{ success: boolean; message: string }> {
    const userUrl = await this.urlRepository.findOne({
      where: { id: urlId, userId, isActive: true },
    });

    if (!userUrl) {
      return { success: false, message: 'URLが見つかりません' };
    }

    userUrl.isActive = false;
    await this.urlRepository.save(userUrl);

    vibeLogger.info('user.url_deleted', 'URL削除完了', {
      context: { userId, urlId, name: userUrl.name },
    });

    return { success: true, message: `「${userUrl.name}」を削除しました` };
  }

  /**
   * 全ユーザーの監視対象URL取得（監視システム用）
   */
  async getAllActiveMonitoringUrls(): Promise<UserUrl[]> {
    return this.urlRepository.find({
      where: { isActive: true, isMonitoring: true },
      relations: ['user'],
    });
  }

  /**
   * 管理者用: 全ユーザー取得
   */
  async getAllUsers(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['urls'],
      order: { registeredAt: 'DESC' },
    });
  }
}
```

### **Step 3: 設定システム更新**

#### **A. 設定型定義更新**
```typescript
// src/types.ts に追加
export interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  database: string;
  synchronize: boolean;
  logging: boolean;
}

export interface Config {
  telegram: {
    botToken: string;
    enabled: boolean;
  };
  monitoring: {
    interval: string;
  };
  app: {
    port: number;
    env: string;
  };
  storage: {
    dataDir: string;
  };
  database: DatabaseConfig; // 追加
}
```

#### **B. 設定ファイル更新**
```typescript
// src/config.ts 更新
export const config: Config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    enabled: process.env.TELEGRAM_ENABLED !== 'false',
  },
  monitoring: {
    interval: process.env.MONITORING_INTERVAL || '*/5 * * * *',
  },
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  storage: {
    dataDir: process.env.DATA_DIR || './data',
  },
  database: {
    type: 'sqlite',
    database: `${process.env.DATA_DIR || './data'}/sokubutsu.db`,
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
  },
};
```

---

## 🤖 **Phase 4: Telegramコマンドシステム**

### **Step 1: コマンドハンドラー実装**

#### **A. ベースコマンドシステム**
```typescript
// src/telegram/TelegramBot.ts
import { Telegraf, Context } from 'telegraf';
import { UserService } from '../services/UserService.js';
import { vibeLogger } from '../logger.js';

interface BotContext extends Context {
  userId?: string;
}

export class TelegramBot {
  private bot: Telegraf<BotContext>;
  private userService: UserService;

  constructor(botToken: string) {
    this.bot = new Telegraf<BotContext>(botToken);
    this.userService = new UserService();
    this.setupCommands();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // ユーザー認証ミドルウェア
    this.bot.use(async (ctx, next) => {
      if (ctx.from) {
        const user = await this.userService.registerOrGetUser(
          ctx.from.id.toString(),
          ctx.from.username
        );
        ctx.userId = user.id;
      }
      return next();
    });
  }

  private setupCommands(): void {
    // /start - サービス開始
    this.bot.command('start', async (ctx) => {
      const welcomeMessage = `
🏠 *ソクブツへようこそ！*

新着物件を見逃さない監視サービスです。

📋 *利用可能なコマンド*
/register \\<URL\\> \\<名前\\> \\<都道府県\\> \\- URL登録
/list \\- 登録URL一覧
/pause \\<番号\\> \\- 監視一時停止
/resume \\<番号\\> \\- 監視再開
/delete \\<番号\\> \\- URL削除
/status \\- 監視状況確認
/help \\- ヘルプ表示

🎯 *最大3件のURLを登録できます*
📍 *1都道府県につき1URLまで*

まずは /register コマンドでURLを登録してください！
      `;

      await ctx.replyWithMarkdownV2(welcomeMessage);
    });

    // /register - URL登録
    this.bot.command('register', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length < 3) {
        await ctx.reply(
          '❌ 使用方法: /register <URL> <名前> <都道府県>\\n\\n' +
          '例: /register https://www.athome.co.jp/... "広島の物件" "広島県"',
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      const [url, name, prefecture] = args;
      
      // URL形式チェック
      try {
        new URL(url);
      } catch {
        await ctx.reply('❌ 無効なURL形式です');
        return;
      }

      const result = await this.userService.registerUrl(ctx.userId!, url, name, prefecture);
      
      if (result.success) {
        await ctx.reply(`✅ ${result.message}\\n\\n📊 監視を開始しました！`, { parse_mode: 'MarkdownV2' });
      } else {
        await ctx.reply(`❌ ${result.message}`);
      }
    });

    // /list - URL一覧
    this.bot.command('list', async (ctx) => {
      const urls = await this.userService.getUserUrls(ctx.userId!);
      
      if (urls.length === 0) {
        await ctx.reply('📝 登録されているURLはありません\\n\\n/register コマンドでURLを登録してください', { parse_mode: 'MarkdownV2' });
        return;
      }

      let message = '📋 *登録URL一覧*\\n\\n';
      urls.forEach((url, index) => {
        const status = url.isMonitoring ? '🟢 監視中' : '🔴 停止中';
        message += `${index + 1}\\. *${this.escapeMarkdown(url.name)}*\\n`;
        message += `   ${status} \\| ${this.escapeMarkdown(url.prefecture)}\\n`;
        message += `   ${this.escapeMarkdown(url.url.substring(0, 50))}...\\n\\n`;
      });

      message += '💡 *操作方法*\\n';
      message += '/pause \\<番号\\> \\- 一時停止\\n';
      message += '/resume \\<番号\\> \\- 再開\\n';
      message += '/delete \\<番号\\> \\- 削除';

      await ctx.replyWithMarkdownV2(message);
    });

    // /pause - 監視一時停止
    this.bot.command('pause', async (ctx) => {
      await this.handleToggleCommand(ctx, 'pause');
    });

    // /resume - 監視再開
    this.bot.command('resume', async (ctx) => {
      await this.handleToggleCommand(ctx, 'resume');
    });

    // /delete - URL削除
    this.bot.command('delete', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length === 0) {
        await ctx.reply('❌ 使用方法: /delete <番号>\\n\\n/list で番号を確認してください', { parse_mode: 'MarkdownV2' });
        return;
      }

      const index = parseInt(args[0]) - 1;
      const urls = await this.userService.getUserUrls(ctx.userId!);
      
      if (index < 0 || index >= urls.length) {
        await ctx.reply('❌ 無効な番号です');
        return;
      }

      const result = await this.userService.deleteUrl(ctx.userId!, urls[index].id);
      await ctx.reply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
    });

    // /status - 監視状況確認
    this.bot.command('status', async (ctx) => {
      const urls = await this.userService.getUserUrls(ctx.userId!);
      
      if (urls.length === 0) {
        await ctx.reply('📝 登録されているURLはありません');
        return;
      }

      let message = '📊 *監視状況*\\n\\n';
      urls.forEach((url, index) => {
        const status = url.isMonitoring ? '🟢 監視中' : '🔴 停止中';
        message += `${index + 1}\\. *${this.escapeMarkdown(url.name)}*\\n`;
        message += `   ${status}\\n`;
        message += `   📈 総チェック: ${url.totalChecks}回\\n`;
        message += `   🆕 新着検知: ${url.newListingsCount}回\\n`;
        message += `   ⚠️ エラー: ${url.errorCount}回\\n`;
        if (url.lastCheckedAt) {
          message += `   🕐 最終チェック: ${new Date(url.lastCheckedAt).toLocaleString('ja-JP')}\\n`;
        }
        message += '\\n';
      });

      await ctx.replyWithMarkdownV2(message);
    });

    // /help - ヘルプ
    this.bot.command('help', async (ctx) => {
      const helpMessage = `
📖 *ソクブツ ヘルプ*

🔧 *基本コマンド*
/start \\- サービス開始
/register \\<URL\\> \\<名前\\> \\<都道府県\\> \\- URL登録
/list \\- 登録URL一覧
/status \\- 監視状況確認

⚙️ *管理コマンド*
/pause \\<番号\\> \\- 監視一時停止
/resume \\<番号\\> \\- 監視再開
/delete \\<番号\\> \\- URL削除

📋 *制限事項*
• 最大3件のURLまで登録可能
• 1都道府県につき1URLまで
• 監視間隔は5分固定

💡 *使用例*
/register https://www\\.athome\\.co\\.jp/chintai/hiroshima/list/ "広島の物件" "広島県"

❓ *サポート*
問題が発生した場合は管理者にお問い合わせください。
      `;

      await ctx.replyWithMarkdownV2(helpMessage);
    });
  }

  private async handleToggleCommand(ctx: BotContext, action: 'pause' | 'resume'): Promise<void> {
    const args = ctx.message!.text.split(' ').slice(1);
    
    if (args.length === 0) {
      await ctx.reply(`❌ 使用方法: /${action} <番号>\\n\\n/list で番号を確認してください`, { parse_mode: 'MarkdownV2' });
      return;
    }

    const index = parseInt(args[0]) - 1;
    const urls = await this.userService.getUserUrls(ctx.userId!);
    
    if (index < 0 || index >= urls.length) {
      await ctx.reply('❌ 無効な番号です');
      return;
    }

    const targetUrl = urls[index];
    const shouldBeMonitoring = action === 'resume';
    
    if (targetUrl.isMonitoring === shouldBeMonitoring) {
      const status = shouldBeMonitoring ? '監視中' : '停止中';
      await ctx.reply(`ℹ️ 「${targetUrl.name}」は既に${status}です`);
      return;
    }

    const result = await this.userService.toggleUrlMonitoring(ctx.userId!, targetUrl.id);
    await ctx.reply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  async start(): Promise<void> {
    await this.bot.launch();
    vibeLogger.info('telegram.bot_started', 'Telegram Bot起動完了', {
      humanNote: 'ユーザーからのコマンドを受付開始',
    });
  }

  async stop(): Promise<void> {
    this.bot.stop();
  }
}
```

### **Step 2: 通知システム更新**

#### **A. マルチユーザー対応通知**
```typescript
// src/services/NotificationService.ts
import { TelegramNotifier } from '../telegram.js';
import { UserService } from './UserService.js';
import { UserUrl } from '../entities/UserUrl.js';
import { NewPropertyDetectionResult } from '../types.js';

export class NotificationService {
  private userService: UserService;
  private telegramNotifier: TelegramNotifier;

  constructor(botToken: string) {
    this.userService = new UserService();
    this.telegramNotifier = new TelegramNotifier(botToken, ''); // Chat IDは動的設定
  }

  /**
   * 新着物件通知（ユーザー別）
   */
  async sendNewPropertyNotification(
    userUrl: UserUrl,
    detectionResult: NewPropertyDetectionResult
  ): Promise<void> {
    const user = userUrl.user;
    
    const message = `
🆕 *新着物件発見！*

📋 *監視対象*: ${this.escapeMarkdown(userUrl.name)}
📍 *エリア*: ${this.escapeMarkdown(userUrl.prefecture)}

📊 *検知情報*
• 新着件数: *${detectionResult.newPropertyCount}件*
• 監視範囲: 最新${detectionResult.totalMonitored}件
• 信頼度: ${this.getConfidenceText(detectionResult.confidence)}
• 検知時刻: ${detectionResult.detectedAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

🏠 *新着物件詳細*
${detectionResult.newProperties.map((property, index) => 
  `${index + 1}\\. *${this.escapeMarkdown(property.title)}*\\n` +
  `   💰 ${this.escapeMarkdown(property.price)}\\n` +
  (property.location ? `   📍 ${this.escapeMarkdown(property.location)}\\n` : '')
).join('\\n')}

🔗 [物件一覧を確認](${userUrl.url})

🎯 *理想の物件をお見逃しなく！*
    `;

    await this.telegramNotifier.sendMessageToUser(user.telegramChatId, message);
  }

  /**
   * ユーザー別統計レポート
   */
  async sendUserStatisticsReport(userId: string): Promise<void> {
    const urls = await this.userService.getUserUrls(userId);
    const user = await this.userService.getUserById(userId);
    
    if (!user || urls.length === 0) return;

    const totalChecks = urls.reduce((sum, url) => sum + url.totalChecks, 0);
    const totalNewListings = urls.reduce((sum, url) => sum + url.newListingsCount, 0);
    const totalErrors = urls.reduce((sum, url) => sum + url.errorCount, 0);
    const successRate = totalChecks > 0 ? ((totalChecks - totalErrors) / totalChecks * 100) : 100;

    let message = `
📊 *あなたの監視統計レポート*

📈 *全体パフォーマンス*
  • 総チェック数: *${totalChecks}回*
  • 成功率: *${successRate.toFixed(1)}%*
  • 新着検知数: *${totalNewListings}回*
  • エラー数: *${totalErrors}回*

🏠 *監視対象別詳細*
`;

    urls.forEach((url, index) => {
      const urlSuccessRate = url.totalChecks > 0 ? ((url.totalChecks - url.errorCount) / url.totalChecks * 100) : 100;
      message += `
${index + 1}\\. *${this.escapeMarkdown(url.name)}*
  • チェック数: ${url.totalChecks}回
  • 新着検知: ${url.newListingsCount}回
  • 成功率: ${urlSuccessRate.toFixed(1)}%
  • 状態: ${url.isMonitoring ? '🟢 監視中' : '🔴 停止中'}
`;
    });

    message += `
⏰ *稼働状況*
  • 監視間隔: 5分ごと
  • 登録URL数: ${urls.length}/3件

${successRate >= 95 ? 
  '✅ *システムは正常に動作しています*' : 
  '⚠️ *エラー率が高めです\\. /status で詳細をご確認ください*'
}

🎯 *理想の物件との出会いを継続監視中！*
    `;

    await this.telegramNotifier.sendMessageToUser(user.telegramChatId, message);
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  private getConfidenceText(confidence: string): string {
    switch (confidence) {
      case 'very_high': return '*非常に高い* ⭐⭐⭐';
      case 'high': return '*高い* ⭐⭐';
      case 'medium': return '*中程度* ⭐';
      default: return '*不明*';
    }
  }
}
```

---

## 🛠️ **Phase 5: 管理者機能**

### **Step 1: 管理者Web インターフェース**

#### **A. Express サーバー設定**
```typescript
// src/admin/AdminServer.ts
import express from 'express';
import { UserService } from '../services/UserService.js';
import { vibeLogger } from '../logger.js';

export class AdminServer {
  private app: express.Application;
  private userService: UserService;

  constructor() {
    this.app = express();
    this.userService = new UserService();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static('public'));
    this.app.set('view engine', 'ejs');
    this.app.set('views', './src/admin/views');
  }

  private setupRoutes(): void {
    // ダッシュボード
    this.app.get('/', async (req, res) => {
      try {
        const users = await this.userService.getAllUsers();
        const stats = {
          totalUsers: users.length,
          activeUsers: users.filter(u => u.isActive).length,
          totalUrls: users.reduce((sum, u) => sum + u.urls.filter(url => url.isActive).length, 0),
          monitoringUrls: users.reduce((sum, u) => sum + u.urls.filter(url => url.isActive && url.isMonitoring).length, 0),
        };

        res.render('dashboard', { users, stats });
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // ユーザー一覧API
    this.app.get('/api/users', async (req, res) => {
      try {
        const users = await this.userService.getAllUsers();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
      }
    });

    // ユーザー詳細API
    this.app.get('/api/users/:id', async (req, res) => {
      try {
        const user = await this.userService.getUserById(req.params.id);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
      }
    });

    // ユーザー無効化API
    this.app.patch('/api/users/:id/deactivate', async (req, res) => {
      try {
        const result = await this.userService.deactivateUser(req.params.id);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: 'Failed to deactivate user' });
      }
    });

    // URL削除API
    this.app.delete('/api/urls/:id', async (req, res) => {
      try {
        const result = await this.userService.adminDeleteUrl(req.params.id);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete URL' });
      }
    });
  }

  start(port: number): void {
    this.app.listen(port, () => {
      console.log(`🔧 管理者画面: http://localhost:${port}`);
      vibeLogger.info('admin.server_started', '管理者サーバー起動', {
        context: { port },
      });
    });
  }
}
```

#### **B. ダッシュボードテンプレート**
```html
<!-- src/admin/views/dashboard.ejs -->
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ソクブツ 管理者ダッシュボード</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .stats { display: flex; gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #2196F3; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .status-active { color: green; }
        .status-inactive { color: red; }
        .btn { padding: 8px 16px; margin: 2px; border: none; border-radius: 4px; cursor: pointer; }
        .btn-danger { background-color: #f44336; color: white; }
        .btn-info { background-color: #2196F3; color: white; }
    </style>
</head>
<body>
    <h1>🏠 ソクブツ 管理者ダッシュボード</h1>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-number"><%= stats.totalUsers %></div>
            <div>総ユーザー数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number"><%= stats.activeUsers %></div>
            <div>アクティブユーザー</div>
        </div>
        <div class="stat-card">
            <div class="stat-number"><%= stats.totalUrls %></div>
            <div>登録URL数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number"><%= stats.monitoringUrls %></div>
            <div>監視中URL数</div>
        </div>
    </div>

    <h2>👥 ユーザー一覧</h2>
    <table>
        <thead>
            <tr>
                <th>ユーザーID</th>
                <th>Telegram</th>
                <th>登録日</th>
                <th>URL数</th>
                <th>状態</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            <% users.forEach(user => { %>
            <tr>
                <td><%= user.id.substring(0, 8) %>...</td>
                <td>@<%= user.telegramUsername || 'N/A' %></td>
                <td><%= new Date(user.registeredAt).toLocaleDateString('ja-JP') %></td>
                <td><%= user.urls.filter(url => url.isActive).length %></td>
                <td class="<%= user.isActive ? 'status-active' : 'status-inactive' %>">
                    <%= user.isActive ? '🟢 アクティブ' : '🔴 無効' %>
                </td>
                <td>
                    <button class="btn btn-info" onclick="viewUser('<%= user.id %>')">詳細</button>
                    <% if (user.isActive) { %>
                    <button class="btn btn-danger" onclick="deactivateUser('<%= user.id %>')">無効化</button>
                    <% } %>
                </td>
            </tr>
            <% }); %>
        </tbody>
    </table>

    <script>
        function viewUser(userId) {
            window.open(`/users/${userId}`, '_blank');
        }

        async function deactivateUser(userId) {
            if (!confirm('このユーザーを無効化しますか？')) return;
            
            try {
                const response = await fetch(`/api/users/${userId}/deactivate`, {
                    method: 'PATCH'
                });
                const result = await response.json();
                
                if (result.success) {
                    alert('ユーザーを無効化しました');
                    location.reload();
                } else {
                    alert('エラー: ' + result.message);
                }
            } catch (error) {
                alert('エラーが発生しました');
            }
        }
    </script>
</body>
</html>
```

---

## 🔄 **統合・更新**

### **Step 1: メインシステム更新**

#### **A. main.ts 更新**
```typescript
// src/main.ts 完全更新
import { config, validateConfig, displayConfig } from './config.js';
import { MultiUserMonitoringScheduler } from './scheduler/MultiUserScheduler.js';
import { TelegramBot } from './telegram/TelegramBot.js';
import { AdminServer } from './admin/AdminServer.js';
import { initializeDatabase } from './database/connection.js';
import { vibeLogger } from './logger.js';

async function main(): Promise<void> {
  console.log('===========================================');
  console.log('   ソクブツ MVP - マルチユーザー対応版   ');
  console.log('     RFP完全準拠実装                    ');
  console.log('===========================================');

  // データベース初期化
  await initializeDatabase();

  // 設定検証
  if (!validateConfig()) {
    console.error('🚨 設定エラー。.envファイルを確認してください。');
    process.exit(1);
  }

  displayConfig();

  // Telegram Bot起動
  const telegramBot = new TelegramBot(config.telegram.botToken);
  await telegramBot.start();

  // 監視スケジューラー起動
  const scheduler = new MultiUserMonitoringScheduler();
  await scheduler.start();

  // 管理者サーバー起動
  const adminServer = new AdminServer();
  adminServer.start(config.app.port);

  console.log('✅ ソクブツMVP（マルチユーザー版）起動完了');
  console.log('🤖 Telegram Bot: ユーザーコマンド受付中');
  console.log('📊 監視システム: 5分間隔で実行中');
  console.log(`🔧 管理者画面: http://localhost:${config.app.port}`);

  // グレースフルシャットダウン
  setupGracefulShutdown(telegramBot, scheduler);
}

function setupGracefulShutdown(bot: TelegramBot, scheduler: MultiUserMonitoringScheduler): void {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 ${signal} 信号を受信。シャットダウン開始...`);
    
    await bot.stop();
    await scheduler.stop();
    
    console.log('✅ ソクブツMVP正常終了');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(error => {
  console.error('💀 致命的エラー:', error);
  process.exit(1);
});
```

### **Step 2: 環境変数更新**

#### **A. .env.example 更新**
```bash
# Telegram Bot設定
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ENABLED=true

# 監視設定
MONITORING_INTERVAL="*/5 * * * *"

# アプリケーション設定
PORT=3000
NODE_ENV=production
DATA_DIR=./data
LOG_LEVEL=info

# データベース設定
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/sokubutsu.db
```

---

## 🧪 **テスト・検証手順**

### **Phase 3テスト: マルチユーザー機能**
```bash
# 1. データベース初期化確認
npm run start
# → データベースファイル作成確認

# 2. ユーザー登録テスト
# Telegram で /start コマンド実行
# → ウェルカムメッセージ受信確認

# 3. URL登録テスト
/register https://www.athome.co.jp/... "テスト物件" "東京都"
# → 登録成功メッセージ確認

# 4. 制限テスト
# 4件目のURL登録試行 → エラーメッセージ確認
# 同一都道府県で2件目登録試行 → エラーメッセージ確認
```

### **Phase 4テスト: コマンドシステム**
```bash
# 1. 全コマンド動作確認
/list     # → URL一覧表示
/status   # → 監視状況表示
/pause 1  # → 一時停止確認
/resume 1 # → 再開確認
/delete 1 # → 削除確認
/help     # → ヘルプ表示
```

### **Phase 5テスト: 管理者機能**
```bash
# 1. 管理者画面アクセス
http://localhost:3000
# → ダッシュボード表示確認

# 2. ユーザー管理機能
# → ユーザー一覧表示
# → ユーザー詳細表示
# → ユーザー無効化機能
```

---

## ✅ **RFP完全適合確認**

### **2.1.2. ユーザー機能**
- ✅ 不特定多数のユーザー登録・利用
- ✅ 複数監視URL登録（最大3件）
- ✅ URLごとの名前付け
- ✅ 監視の一時停止・再開・削除
- ✅ URL数制限（1-3件）
- ✅ 都道府県単位制限

### **2.1.4. 操作インターフェース**
- ✅ Telegramコマンド完全実装

### **2.1.5. 管理者機能**
- ✅ ユーザー・URL管理画面

**この実装により、RFP要件100%適合が達成されます！**

