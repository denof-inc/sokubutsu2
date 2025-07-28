/**
 * 統計情報リポジトリ
 *
 * @設計ドキュメント
 * - docs/データ永続化.md: 統計情報管理
 *
 * @関連クラス
 * - IFileStorage: ファイルI/O処理
 * - Statistics: 統計情報の型定義
 * - vibeLogger: 操作ログの出力
 */

import { Statistics } from '../types';
import { vibeLogger } from '../utils/logger';
import { IFileStorage } from './file-storage';

export interface IStatisticsRepository {
  /**
   * 統計情報を取得
   */
  get(): Statistics;

  /**
   * 総チェック数を増加
   */
  incrementTotalChecks(): void;

  /**
   * エラー数を増加
   */
  incrementErrors(): void;

  /**
   * 新着検知数を増加
   */
  incrementNewListings(): void;

  /**
   * 実行時間を記録
   */
  recordExecutionTime(milliseconds: number): void;

  /**
   * 統計情報をリセット
   */
  reset(): void;
}

export class StatisticsRepository implements IStatisticsRepository {
  private readonly filename = 'statistics.json';
  private stats: Statistics = {
    totalChecks: 0,
    errors: 0,
    newListings: 0,
    lastCheck: new Date(),
    averageExecutionTime: 0,
    successRate: 100,
  };

  constructor(private readonly storage: IFileStorage) {
    this.loadData();
  }

  /**
   * データを読み込む
   */
  private loadData(): void {
    const data = this.storage.read<Statistics>(this.filename);

    if (data) {
      this.stats = {
        ...this.stats,
        ...data,
        lastCheck: new Date(data.lastCheck),
      };

      vibeLogger.debug('statistics_repository.loaded', '統計データ読み込み完了', {
        context: { stats: this.stats },
      });
    }
  }

  /**
   * データを保存する
   */
  private saveData(): void {
    this.storage.write(this.filename, this.stats);
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
  get(): Statistics {
    return { ...this.stats };
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
  recordExecutionTime(milliseconds: number): void {
    const currentAverage = this.stats.averageExecutionTime;
    const totalChecks = this.stats.totalChecks;

    // 移動平均を計算
    this.stats.averageExecutionTime =
      (currentAverage * (totalChecks - 1) + milliseconds / 1000) / totalChecks;

    this.saveData();
  }

  /**
   * 統計情報をリセット
   */
  reset(): void {
    this.stats = {
      totalChecks: 0,
      errors: 0,
      newListings: 0,
      lastCheck: new Date(),
      averageExecutionTime: 0,
      successRate: 100,
    };

    this.saveData();

    vibeLogger.info('statistics_repository.reset', '統計情報をリセットしました', {
      humanNote: '統計情報がクリアされました',
    });
  }

  /**
   * バックアップを作成
   */
  createBackup(): string {
    return this.storage.createBackup(this.filename, this.stats);
  }

  /**
   * 統計情報を表示
   */
  display(): void {
    console.log('📈 統計情報:');
    console.log(`  - 総チェック数: ${this.stats.totalChecks}回`);
    console.log(`  - 成功率: ${this.stats.successRate}%`);
    console.log(`  - エラー数: ${this.stats.errors}回`);
    console.log(`  - 新着検知数: ${this.stats.newListings}回`);
    console.log(`  - 平均実行時間: ${this.stats.averageExecutionTime.toFixed(2)}秒`);
    console.log(`  - 最終チェック: ${this.stats.lastCheck.toLocaleString('ja-JP')}`);
  }
}
