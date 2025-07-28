/**
 * ハッシュ値リポジトリ
 *
 * @設計ドキュメント
 * - docs/データ永続化.md: ハッシュ値管理
 *
 * @関連クラス
 * - IFileStorage: ファイルI/O処理
 * - vibeLogger: 操作ログの出力
 */

import { vibeLogger } from '../utils/logger';
import { IFileStorage } from './file-storage';

export interface IHashRepository {
  /**
   * URLのハッシュ値を取得
   */
  get(url: string): string | undefined;

  /**
   * URLのハッシュ値を設定
   */
  set(url: string, hash: string): void;

  /**
   * すべてのハッシュ値を取得
   */
  getAll(): Record<string, string>;

  /**
   * ハッシュ値の数を取得
   */
  getCount(): number;
}

export class HashRepository implements IHashRepository {
  private readonly filename = 'hashes.json';
  private hashData: Record<string, string> = {};

  constructor(private readonly storage: IFileStorage) {
    this.loadData();
  }

  /**
   * データを読み込む
   */
  private loadData(): void {
    const data = this.storage.read<Record<string, string>>(this.filename);

    if (data) {
      this.hashData = data;
      vibeLogger.debug('hash_repository.loaded', 'ハッシュデータ読み込み', {
        context: { count: Object.keys(this.hashData).length },
      });
    }
  }

  /**
   * データを保存する
   */
  private saveData(): void {
    this.storage.write(this.filename, this.hashData);
  }

  /**
   * URLのハッシュ値を取得
   */
  get(url: string): string | undefined {
    return this.hashData[url];
  }

  /**
   * URLのハッシュ値を設定
   */
  set(url: string, hash: string): void {
    this.hashData[url] = hash;
    this.saveData();

    vibeLogger.debug('hash_repository.updated', 'ハッシュ更新', {
      context: {
        url,
        hash: hash.substring(0, 8) + '...',
        totalUrls: Object.keys(this.hashData).length,
      },
    });
  }

  /**
   * すべてのハッシュ値を取得
   */
  getAll(): Record<string, string> {
    return { ...this.hashData };
  }

  /**
   * ハッシュ値の数を取得
   */
  getCount(): number {
    return Object.keys(this.hashData).length;
  }

  /**
   * バックアップを作成
   */
  createBackup(): string {
    return this.storage.createBackup(this.filename, this.hashData);
  }
}
