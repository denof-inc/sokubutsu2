import { Statistics } from '../types';
import { config } from '../config';
import { vibeLogger } from '../utils/logger';
import { IStorageService } from './interfaces';
import { FileStorage } from '../infrastructure/file-storage';
import { HashRepository } from '../infrastructure/hash-repository';
import { StatisticsRepository } from '../infrastructure/statistics-repository';

/**
 * シンプルなJSONファイルストレージ
 *
 * @設計ドキュメント
 * - README.md: データ保存方式
 * - docs/データ永続化.md: JSONストレージ設計
 *
 * @関連クラス
 * - MonitoringScheduler: URLハッシュの読み書き、統計情報の更新
 * - Logger: ファイル操作のエラーログ出力
 * - config: データディレクトリパスの取得
 * - types.ts: Statistics型定義
 *
 * @主要機能
 * - URLごとのコンテンツハッシュ管理
 * - 監視統計情報の永続化
 * - 自動バックアップ機能
 * - 成功率・実行時間の追跡
 */
export class SimpleStorage implements IStorageService {
  private readonly hashRepository: HashRepository;
  private readonly statisticsRepository: StatisticsRepository;

  constructor() {
    const fileStorage = new FileStorage(config.storage.dataDir);
    this.hashRepository = new HashRepository(fileStorage);
    this.statisticsRepository = new StatisticsRepository(fileStorage);
  }

  /**
   * URLのハッシュ値を取得
   */
  getHash(url: string): string | undefined {
    return this.hashRepository.get(url);
  }

  /**
   * URLのハッシュ値を設定
   */
  setHash(url: string, hash: string): void {
    this.hashRepository.set(url, hash);
  }

  /**
   * 総チェック数を増加
   */
  incrementTotalChecks(): void {
    this.statisticsRepository.incrementTotalChecks();
  }

  /**
   * エラー数を増加
   */
  incrementErrors(): void {
    this.statisticsRepository.incrementErrors();
  }

  /**
   * 新着検知数を増加
   */
  incrementNewListings(): void {
    this.statisticsRepository.incrementNewListings();
  }

  /**
   * 実行時間を記録
   */
  recordExecutionTime(executionTime: number): void {
    this.statisticsRepository.recordExecutionTime(executionTime);
  }

  /**
   * 統計情報を取得
   */
  getStats(): Statistics {
    return this.statisticsRepository.get();
  }

  /**
   * 統計情報をリセット
   */
  resetStats(): void {
    this.statisticsRepository.reset();
  }

  /**
   * データのバックアップを作成
   */
  createBackup(): string {
    const hashBackup = this.hashRepository.createBackup();
    const statsBackup = this.statisticsRepository.createBackup();

    vibeLogger.info('storage.backup_created', 'バックアップ作成', {
      context: {
        hashBackup,
        statsBackup,
        dataSize: {
          hashes: this.hashRepository.getCount(),
          stats: this.getStats(),
        },
      },
      humanNote: 'データのバックアップが作成されました',
    });

    return hashBackup; // 互換性のためハッシュバックアップファイルを返す
  }

  /**
   * 統計情報を表示
   */
  displayStats(): void {
    this.statisticsRepository.display();
    console.log(`  - 監視URL数: ${this.hashRepository.getCount()}件`);
  }
}
