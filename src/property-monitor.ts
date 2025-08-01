import { SimpleStorage } from './storage.js';
import { PropertyMonitoringData, NewPropertyDetectionResult, MonitoringStatistics } from './types.js';
import { vibeLogger } from './logger.js';

/**
 * 新着物件監視サービス
 * 最新3件の物件を監視し、新着物件を検知する
 */
export class PropertyMonitor {
  private readonly storage: SimpleStorage;
  private readonly PREVIOUS_PROPERTIES_KEY = 'previous_properties';
  private readonly MONITORING_STATS_KEY = 'monitoring_statistics';

  constructor() {
    this.storage = new SimpleStorage();
  }

  /**
   * 新着物件を検知する
   * @param currentProperties 現在取得した物件データ
   * @returns 新着検知結果
   */
  detectNewProperties(currentProperties: any[]): NewPropertyDetectionResult {
    const startTime = Date.now();

    try {
      // 1. 現在の物件データを監視用データに変換
      const currentMonitoringData = this.convertToMonitoringData(currentProperties);

      // 2. 前回の物件データを取得
      const previousMonitoringData = this.loadPreviousProperties();

      // 3. 新着物件を検知
      const newProperties = this.findNewProperties(currentMonitoringData, previousMonitoringData);

      // 4. 現在のデータを保存
      this.savePreviousProperties(currentMonitoringData);

      // 5. 統計情報を更新
      this.updateMonitoringStatistics(newProperties.length > 0);

      // 6. 結果を作成
      const result: NewPropertyDetectionResult = {
        hasNewProperty: newProperties.length > 0,
        newPropertyCount: newProperties.length,
        newProperties,
        totalMonitored: currentMonitoringData.length,
        detectedAt: new Date(),
        confidence: this.calculateConfidence(currentMonitoringData.length, newProperties.length),
      };

      const executionTime = Date.now() - startTime;

      vibeLogger.info('property_monitoring.detection_completed', '新着物件検知完了', {
        context: {
          hasNewProperty: result.hasNewProperty,
          newPropertyCount: result.newPropertyCount,
          totalMonitored: result.totalMonitored,
          confidence: result.confidence,
          executionTime,
        },
        humanNote: '新着物件の検知処理が正常に完了しました',
      });

      return result;
    } catch (error) {
      vibeLogger.error('property_monitoring.detection_failed', '新着物件検知失敗', {
        context: {
          error: error instanceof Error ? error.message : String(error),
          executionTime: Date.now() - startTime,
        },
        humanNote: '新着物件の検知処理でエラーが発生しました',
      });
      throw error;
    }
  }

  /**
   * 物件データを監視用データに変換
   */
  private convertToMonitoringData(properties: any[]): PropertyMonitoringData[] {
    return properties.map(property => ({
      signature: this.createPropertySignature(property),
      title: property.title || '',
      price: property.price || '',
      location: property.location || '',
      detectedAt: new Date(),
    }));
  }

  /**
   * 物件の一意署名を作成
   * タイトル + 価格 + 所在地で一意性を確保
   */
  private createPropertySignature(property: any): string {
    const title = (property.title || '').trim();
    const price = (property.price || '').trim();
    const location = (property.location || '').trim();

    return `${title}:${price}:${location}`;
  }

  /**
   * 新着物件を検知
   */
  private findNewProperties(
    current: PropertyMonitoringData[],
    previous: PropertyMonitoringData[]
  ): PropertyMonitoringData[] {
    const previousSignatures = new Set(previous.map(p => p.signature));

    return current.filter(property => !previousSignatures.has(property.signature));
  }

  /**
   * 信頼度を計算
   */
  private calculateConfidence(
    totalMonitored: number,
    newPropertyCount: number
  ): 'very_high' | 'high' | 'medium' {
    if (totalMonitored >= 3 && newPropertyCount <= 3) {
      return 'very_high';
    } else if (totalMonitored >= 2) {
      return 'high';
    } else {
      return 'medium';
    }
  }

  /**
   * 前回の物件データを読み込み
   */
  private loadPreviousProperties(): PropertyMonitoringData[] {
    try {
      const data = this.storage.load<PropertyMonitoringData[]>(this.PREVIOUS_PROPERTIES_KEY);
      return data || [];
    } catch (error) {
      vibeLogger.warn('property_monitoring.load_previous_failed', '前回データ読み込み失敗', {
        context: {
          error: error instanceof Error ? error.message : String(error),
        },
        humanNote: '前回データが存在しないか読み込みに失敗しました',
      });
      return [];
    }
  }

  /**
   * 現在の物件データを保存
   */
  private savePreviousProperties(properties: PropertyMonitoringData[]): void {
    try {
      this.storage.save(this.PREVIOUS_PROPERTIES_KEY, properties);
    } catch (error) {
      vibeLogger.error('property_monitoring.save_previous_failed', '物件データ保存失敗', {
        context: {
          error: error instanceof Error ? error.message : String(error),
        },
        humanNote: '物件データの保存に失敗しました',
      });
      throw error;
    }
  }

  /**
   * 監視統計情報を更新
   */
  private updateMonitoringStatistics(hasNewProperty: boolean): void {
    try {
      const stats = this.loadMonitoringStatistics();

      const updatedStats: MonitoringStatistics = {
        totalChecks: stats.totalChecks + 1,
        newPropertyDetections: stats.newPropertyDetections + (hasNewProperty ? 1 : 0),
        lastCheckAt: new Date(),
        ...(hasNewProperty
          ? { lastNewPropertyAt: new Date() }
          : stats.lastNewPropertyAt
            ? { lastNewPropertyAt: stats.lastNewPropertyAt }
            : {}),
      };

      this.storage.save(this.MONITORING_STATS_KEY, updatedStats);
    } catch (error) {
      vibeLogger.warn('property_monitoring.update_stats_failed', '統計更新失敗', {
        context: {
          error: error instanceof Error ? error.message : String(error),
        },
        humanNote: '統計情報の更新に失敗しました',
      });
    }
  }

  /**
   * 監視統計情報を読み込み
   */
  private loadMonitoringStatistics(): MonitoringStatistics {
    try {
      const stats = this.storage.load<MonitoringStatistics>(this.MONITORING_STATS_KEY);
      return (
        stats || {
          totalChecks: 0,
          newPropertyDetections: 0,
          lastCheckAt: new Date(),
        }
      );
    } catch {
      return {
        totalChecks: 0,
        newPropertyDetections: 0,
        lastCheckAt: new Date(),
      };
    }
  }

  /**
   * 監視統計情報を取得
   */
  getMonitoringStatistics(): MonitoringStatistics {
    return this.loadMonitoringStatistics();
  }
}
