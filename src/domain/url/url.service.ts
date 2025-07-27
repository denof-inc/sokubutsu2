import { v4 as uuidv4 } from 'uuid';
import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { Url } from './url.interface';

@Injectable()
export class UrlService implements OnModuleInit {
  private readonly logger = new Logger(UrlService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  onModuleInit() {
    // データベースの初期化やマイグレーションはDatabaseServiceで管理されるため、ここでは不要
    // this.seedInitialData();
  }

  findAllActive(): Promise<Url[]> {
    const results = this.databaseService.query<Url>(
      'SELECT * FROM urls WHERE is_active = ?',
      [1],
    );
    return Promise.resolve(results);
  }

  /**
   * ユーザーのURL一覧を取得
   */
  findByUserId(userId: string): Promise<Url[]> {
    const results = this.databaseService.query<Url>(
      'SELECT * FROM urls WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
    );
    return Promise.resolve(results);
  }

  /**
   * ユーザーのアクティブなURL一覧を取得
   */
  findActiveByUserId(userId: string): Promise<Url[]> {
    const results = this.databaseService.query<Url>(
      'SELECT * FROM urls WHERE user_id = ? AND is_active = ? ORDER BY created_at DESC',
      [userId, 1],
    );
    return Promise.resolve(results);
  }

  /**
   * URLを追加
   */
  async addUrl(userId: string, url: string, name?: string): Promise<Url> {
    // URL検証
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('無効なURLです');
    }

    // 重複チェック
    const existing = this.databaseService.findOne(
      'SELECT * FROM urls WHERE user_id = ? AND url = ?',
      [userId, url],
    ) as Url | undefined;

    if (existing) {
      throw new BadRequestException('このURLは既に登録されています');
    }

    const urlId = uuidv4(); // UUIDを生成
    const urlName = name || this.generateUrlName(url);
    const selector = '#item-list'; // デフォルトセレクター

    this.databaseService.execute(
      'INSERT INTO urls (id, user_id, name, url, selector, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [urlId, userId, urlName, url, selector, 1],
    );

    return Promise.resolve(this.findById(urlId));
  }

  /**
   * URLを削除
   */
  removeUrl(userId: string, urlId: string): void {
    const url = this.findByIdAndUserId(urlId, userId);
    if (!url) {
      throw new NotFoundException('URLが見つかりません');
    }

    this.databaseService.execute(
      'DELETE FROM urls WHERE id = ? AND user_id = ?',
      [urlId, userId],
    );
  }

  /**
   * URL監視を一時停止
   */
  pauseUrl(userId: string, urlId: string): void {
    const url = this.findByIdAndUserId(urlId, userId);
    if (!url) {
      throw new NotFoundException('URLが見つかりません');
    }

    this.databaseService.execute(
      'UPDATE urls SET is_active = ? WHERE id = ? AND user_id = ?',
      [0, urlId, userId],
    );
  }

  /**
   * URL監視を再開
   */
  resumeUrl(userId: string, urlId: string): void {
    const url = this.findByIdAndUserId(urlId, userId);
    if (!url) {
      throw new NotFoundException('URLが見つかりません');
    }

    this.databaseService.execute(
      'UPDATE urls SET is_active = ? WHERE id = ? AND user_id = ?',
      [1, urlId, userId],
    );
  }

  /**
   * IDでURLを取得
   */
  private findById(id: string): Url {
    const url = this.databaseService.findOne(
      'SELECT * FROM urls WHERE id = ?',
      [id],
    ) as Url | undefined;

    if (!url) {
      throw new NotFoundException('URLが見つかりません');
    }

    return url;
  }

  /**
   * ユーザーIDとURL IDでURLを取得
   */
  private findByIdAndUserId(urlId: string, userId: string): Url | undefined {
    return this.databaseService.findOne(
      'SELECT * FROM urls WHERE id = ? AND user_id = ?',
      [urlId, userId],
    ) as Url | undefined;
  }

  /**
   * URLから名前を生成
   */
  private generateUrlName(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}の物件`;
    } catch {
      return '監視URL';
    }
  }

  updateHash(id: string, hash: string): Promise<void> {
    this.databaseService.execute(
      'UPDATE urls SET content_hash = ? WHERE id = ?',
      [hash, id],
    );
    return Promise.resolve();
  }
}
