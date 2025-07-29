import * as fs from 'fs';
import * as path from 'path';
import { Statistics } from './types';
import { config } from './config';
import { vibeLogger } from './logger';

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
export class SimpleStorage {
  private readonly dataDir: string;
  private readonly hashFile: string;
  private readonly statsFile: string;

  private hashData: Record<string, string> = {};
  private stats: Statistics = {
    totalChecks: 0,
    errors: 0,
    newListings: 0,
    lastCheck: new Date(),
    averageExecutionTime: 0,
    successRate: 100,
  };

  constructor() {
    this.dataDir = config.storage.dataDir;
    this.hashFile = path.join(this.dataDir, 'hashes.json');
    this.statsFile = path.join(this.dataDir, 'statistics.json');

    this.ensureDataDirectory();
    this.loadData();
  }

  /**
   * データディレクトリの存在確認・作成
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      vibeLogger.info('storage.directory_created', `データディレクトリを作成`, {
        context: { dataDir: this.dataDir },
      });
    }
  }

  /**
   * データファイルの読み込み
   */
  private loadData(): void {
    try {
      // ハッシュデータの読み込み
      if (fs.existsSync(this.hashFile)) {
        const hashContent = fs.readFileSync(this.hashFile, 'utf8');
        this.hashData = JSON.parse(hashContent) as Record<string, string>;
        vibeLogger.debug('storage.hash_loaded', `ハッシュデータ読み込み`, {
          context: { count: Object.keys(this.hashData).length },
        });
      }

      // 統計データの読み込み
      if (fs.existsSync(this.statsFile)) {
        const statsContent = fs.readFileSync(this.statsFile, 'utf8');
        const loadedStats = JSON.parse(statsContent) as Statistics;
        this.stats = {
          ...this.stats,
          ...loadedStats,
          lastCheck: new Date(loadedStats.lastCheck),
        };
        vibeLogger.debug('storage.stats_loaded', '統計データ読み込み完了', {
          context: { stats: this.stats },
        });
      }
    } catch (error) {
      vibeLogger.error('storage.load_error', 'データ読み込みエラー', {
        context: {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : { message: String(error) },
        },
        aiTodo: 'データ読み込みエラーの原因を分析',
      });
      // エラーが発生してもデフォルト値で継続
    }
  }

  /**
   * データファイルの保存
   */
  private saveData(): void {
    try {
      // ハッシュデータの保存
      fs.writeFileSync(this.hashFile, JSON.stringify(this.hashData, null, 2));

      // 統計データの保存
      fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));

      vibeLogger.debug('storage.save_complete', 'データ保存完了', {
        context: {
          hashFile: this.hashFile,
          statsFile: this.statsFile,
        },
      });
    } catch (error) {
      vibeLogger.error('storage.save_error', 'データ保存エラー', {
        context: {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : { message: String(error) },
        },
        aiTodo: 'データ保存エラーの原因を分析',
      });
    }
  }

  /**
   * URLのハッシュ値を取得
   */
  getHash(url: string): string | undefined {
    return this.hashData[url];
  }

  /**
   * URLのハッシュ値を設定
   */
  setHash(url: string, hash: string): void {
    this.hashData[url] = hash;
    this.saveData();
    vibeLogger.debug('storage.hash_updated', 'ハッシュ更新', {
      context: { url, hash: hash.substring(0, 8) + '...' },
    });
  }

  /**
   * 総チェック数を増加
   */
  incrementTotalChecks(): void {
    this.stats.totalChecks++;
    this.stats.lastCheck = new Date();
    this.updateSuccessRate();
    this.saveData();
  }

  /**
   * エラー数を増加
   */
  incrementErrors(): void {
    this.stats.errors++;
    this.updateSuccessRate();
    this.saveData();
  }

  /**
   * 新着検知数を増加
   */
  incrementNewListings(): void {
    this.stats.newListings++;
    this.saveData();
  }

  /**
   * 実行時間を記録
   */
  recordExecutionTime(executionTime: number): void {
    const currentAverage = this.stats.averageExecutionTime;
    const totalChecks = this.stats.totalChecks;

    // 移動平均を計算
    this.stats.averageExecutionTime =
      (currentAverage * (totalChecks - 1) + executionTime / 1000) / totalChecks;

    this.saveData();
  }

  /**
   * 成功率を更新
   */
  private updateSuccessRate(): void {
    if (this.stats.totalChecks > 0) {
      const successCount = this.stats.totalChecks - this.stats.errors;
      this.stats.successRate =
        Math.round((successCount / this.stats.totalChecks) * 100 * 100) / 100;
    }
  }

  /**
   * 統計情報を取得
   */
  getStats(): Statistics {
    return { ...this.stats };
  }

  /**
   * 統計情報をリセット
   */
  resetStats(): void {
    this.stats = {
      totalChecks: 0,
      errors: 0,
      newListings: 0,
      lastCheck: new Date(),
      averageExecutionTime: 0,
      successRate: 100,
    };
    this.saveData();
    vibeLogger.info('storage.stats_reset', '統計情報をリセットしました', {
      humanNote: '統計情報がクリアされました',
    });
  }

  /**
   * データのバックアップを作成
   */
  createBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.dataDir, 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    const backupData = {
      hashes: this.hashData,
      statistics: this.stats,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    vibeLogger.info('storage.backup_created', 'バックアップ作成', {
      context: {
        backupFile,
        dataSize: {
          hashes: Object.keys(this.hashData).length,
          stats: this.stats,
        },
      },
      humanNote: 'データのバックアップが作成されました',
    });

    return backupFile;
  }

  /**
   * 汎用的なデータ保存
   */
  save<T>(key: string, data: T): void {
    const filePath = path.join(this.dataDir, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    vibeLogger.debug('storage.save', `データ保存: ${key}`, {
      context: { key, filePath },
    });
  }

  /**
   * 汎用的なデータ読み込み
   */
  load<T>(key: string): T | null {
    const filePath = path.join(this.dataDir, `${key}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data) as T;
      }
    } catch (error) {
      vibeLogger.error('storage.load_error', `データ読み込みエラー: ${key}`, {
        context: {
          key,
          filePath,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
    return null;
  }

  /**
   * 統計情報を表示
   */
  displayStats(): void {
    console.log('📈 統計情報:');
    console.log(`  - 総チェック数: ${this.stats.totalChecks}回`);
    console.log(`  - 成功率: ${this.stats.successRate}%`);
    console.log(`  - エラー数: ${this.stats.errors}回`);
    console.log(`  - 新着検知数: ${this.stats.newListings}回`);
    console.log(`  - 平均実行時間: ${this.stats.averageExecutionTime.toFixed(2)}秒`);
    console.log(`  - 最終チェック: ${this.stats.lastCheck.toLocaleString('ja-JP')}`);
    console.log(`  - 監視URL数: ${Object.keys(this.hashData).length}件`);
  }
}
