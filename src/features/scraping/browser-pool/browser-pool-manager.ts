import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, BrowserContext } from 'playwright';
import { StealthConfig } from '../stealth/stealth-config';

interface BrowserInstance {
  id: string;
  browser: Browser;
  context: BrowserContext;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  requestCount: number;
}

interface PoolConfig {
  minSize: number;
  maxSize: number;
  maxRequestsPerBrowser: number;
  browserLifetimeMs: number;
  idleTimeoutMs: number;
}

@Injectable()
export class BrowserPoolManager implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolManager.name);
  private readonly pool: Map<string, BrowserInstance> = new Map();
  private readonly waitQueue: Array<(browser: BrowserContext) => void> = [];
  
  private readonly config: PoolConfig = {
    minSize: 2,
    maxSize: 5,
    maxRequestsPerBrowser: 50, // ブラウザあたりの最大リクエスト数
    browserLifetimeMs: 10 * 60 * 1000, // 10分
    idleTimeoutMs: 2 * 60 * 1000, // 2分
  };

  constructor() {
    this.initializePool();
    this.startMaintenanceTask();
  }

  /**
   * プールの初期化
   */
  private async initializePool(): Promise<void> {
    this.logger.log('Initializing browser pool...');
    
    for (let i = 0; i < this.config.minSize; i++) {
      await this.createBrowserInstance();
    }
    
    this.logger.log(`Browser pool initialized with ${this.config.minSize} instances`);
  }

  /**
   * ブラウザインスタンスの作成
   */
  private async createBrowserInstance(): Promise<BrowserInstance> {
    const id = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const browser = await chromium.launch(StealthConfig.getStealthOptions());
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
    });

    // コンテキストレベルでのStealth設定
    await context.addInitScript(() => {
      // WebDriver検知回避
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Chrome検知回避
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {},
      };
    });

    const instance: BrowserInstance = {
      id,
      browser,
      context,
      inUse: false,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      requestCount: 0,
    };

    this.pool.set(id, instance);
    this.logger.debug(`Created browser instance: ${id}`);
    
    return instance;
  }

  /**
   * ブラウザインスタンスの取得
   */
  async acquire(): Promise<BrowserContext> {
    // 利用可能なインスタンスを探す
    for (const instance of this.pool.values()) {
      if (!instance.inUse && this.isInstanceHealthy(instance)) {
        instance.inUse = true;
        instance.lastUsedAt = new Date();
        instance.requestCount++;
        
        this.logger.debug(`Acquired browser instance: ${instance.id}`);
        return instance.context;
      }
    }

    // 利用可能なインスタンスがない場合
    if (this.pool.size < this.config.maxSize) {
      // 新しいインスタンスを作成
      const newInstance = await this.createBrowserInstance();
      newInstance.inUse = true;
      newInstance.requestCount++;
      
      return newInstance.context;
    }

    // プールが満杯の場合は待機
    this.logger.debug('Browser pool is full, waiting for available instance...');
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * ブラウザインスタンスの返却
   */
  async release(context: BrowserContext): Promise<void> {
    const instance = this.findInstanceByContext(context);
    
    if (!instance) {
      this.logger.warn('Attempted to release unknown browser context');
      return;
    }

    instance.inUse = false;
    instance.lastUsedAt = new Date();
    
    this.logger.debug(`Released browser instance: ${instance.id}`);

    // 待機中のリクエストがあれば処理
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      instance.inUse = true;
      instance.requestCount++;
      waiter(instance.context);
    }

    // インスタンスの健全性チェック
    if (!this.isInstanceHealthy(instance)) {
      await this.destroyInstance(instance.id);
      
      // 最小プールサイズを維持
      if (this.pool.size < this.config.minSize) {
        await this.createBrowserInstance();
      }
    }
  }

  /**
   * インスタンスの健全性チェック
   */
  private isInstanceHealthy(instance: BrowserInstance): boolean {
    const now = new Date().getTime();
    const age = now - instance.createdAt.getTime();
    const idleTime = now - instance.lastUsedAt.getTime();

    // 寿命チェック
    if (age > this.config.browserLifetimeMs) {
      this.logger.debug(`Instance ${instance.id} exceeded lifetime`);
      return false;
    }

    // リクエスト数チェック
    if (instance.requestCount >= this.config.maxRequestsPerBrowser) {
      this.logger.debug(`Instance ${instance.id} exceeded request limit`);
      return false;
    }

    // アイドル時間チェック（使用中でない場合のみ）
    if (!instance.inUse && idleTime > this.config.idleTimeoutMs) {
      this.logger.debug(`Instance ${instance.id} exceeded idle timeout`);
      return false;
    }

    return true;
  }

  /**
   * コンテキストからインスタンスを検索
   */
  private findInstanceByContext(context: BrowserContext): BrowserInstance | undefined {
    for (const instance of this.pool.values()) {
      if (instance.context === context) {
        return instance;
      }
    }
    return undefined;
  }

  /**
   * インスタンスの破棄
   */
  private async destroyInstance(id: string): Promise<void> {
    const instance = this.pool.get(id);
    
    if (!instance) {
      return;
    }

    try {
      await instance.context.close();
      await instance.browser.close();
      
      this.pool.delete(id);
      this.logger.debug(`Destroyed browser instance: ${id}`);
      
    } catch (error) {
      this.logger.error(`Error destroying browser instance ${id}:`, error.message);
    }
  }

  /**
   * メンテナンスタスクの開始
   */
  private startMaintenanceTask(): void {
    setInterval(async () => {
      await this.performMaintenance();
    }, 30000); // 30秒ごと
  }

  /**
   * プールのメンテナンス
   */
  private async performMaintenance(): Promise<void> {
    this.logger.debug('Performing pool maintenance...');

    const instancesToDestroy: string[] = [];

    // 健全でないインスタンスを特定
    for (const instance of this.pool.values()) {
      if (!instance.inUse && !this.isInstanceHealthy(instance)) {
        instancesToDestroy.push(instance.id);
      }
    }

    // インスタンスを破棄
    for (const id of instancesToDestroy) {
      await this.destroyInstance(id);
    }

    // 最小プールサイズを維持
    while (this.pool.size < this.config.minSize) {
      await this.createBrowserInstance();
    }

    // プールサイズの調整（需要に応じて）
    if (this.waitQueue.length > 0 && this.pool.size < this.config.maxSize) {
      const newInstances = Math.min(
        this.waitQueue.length,
        this.config.maxSize - this.pool.size
      );
      
      for (let i = 0; i < newInstances; i++) {
        await this.createBrowserInstance();
      }
    }
  }

  /**
   * プールの状態を取得
   */
  getStatus(): {
    totalInstances: number;
    activeInstances: number;
    idleInstances: number;
    queueLength: number;
    instanceDetails: Array<{
      id: string;
      inUse: boolean;
      requestCount: number;
      age: number;
      idleTime: number;
    }>;
  } {
    const now = new Date().getTime();
    const instances = Array.from(this.pool.values());
    
    return {
      totalInstances: instances.length,
      activeInstances: instances.filter(i => i.inUse).length,
      idleInstances: instances.filter(i => !i.inUse).length,
      queueLength: this.waitQueue.length,
      instanceDetails: instances.map(i => ({
        id: i.id,
        inUse: i.inUse,
        requestCount: i.requestCount,
        age: now - i.createdAt.getTime(),
        idleTime: i.inUse ? 0 : now - i.lastUsedAt.getTime(),
      })),
    };
  }

  /**
   * モジュール破棄時のクリーンアップ
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down browser pool...');
    
    // すべてのインスタンスを破棄
    const instances = Array.from(this.pool.keys());
    
    await Promise.all(
      instances.map(id => this.destroyInstance(id))
    );
    
    this.logger.log('Browser pool shut down complete');
  }
}