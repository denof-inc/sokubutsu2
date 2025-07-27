import * as fs from 'fs';
import * as path from 'path';
import { Statistics } from './types';
import { config } from './config';
import { logger } from './logger';

/**
 * シンプルなJSONファイルストレージ
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
      logger.info(`データディレクトリを作成: ${this.dataDir}`);
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
        this.hashData = JSON.parse(hashContent);
        logger.debug(`ハッシュデータ読み込み: ${Object.keys(this.hashData).length}件`);
      }
      
      // 統計データの読み込み
      if (fs.existsSync(this.statsFile)) {
        const statsContent = fs.readFileSync(this.statsFile, 'utf8');
        const loadedStats = JSON.parse(statsContent);
        this.stats = {
          ...this.stats,
          ...loadedStats,
          lastCheck: new Date(loadedStats.lastCheck),
        };
        logger.debug('統計データ読み込み完了', this.stats);
      }
      
    } catch (error) {
      logger.error('データ読み込みエラー', error);
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
      
      logger.debug('データ保存完了');
      
    } catch (error) {
      logger.error('データ保存エラー', error);
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
    logger.debug(`ハッシュ更新: ${url} -> ${hash.substring(0, 8)}...`);
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
      this.stats.successRate = Math.round((successCount / this.stats.totalChecks) * 100 * 100) / 100;
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
    logger.info('統計情報をリセットしました');
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
    logger.info(`バックアップ作成: ${backupFile}`);
    
    return backupFile;
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