jest.mock('../logger.js');

// Manual mock for SimpleStorage
const mockStorage = {
  load: jest.fn(),
  save: jest.fn(),
  updateStatistics: jest.fn(),
  getHash: jest.fn(),
  setHash: jest.fn(),
  incrementChecks: jest.fn(),
  incrementErrors: jest.fn(),
  incrementNewListings: jest.fn(),
  recordExecutionTime: jest.fn(),
  getSuccessRate: jest.fn().mockReturnValue(100),
  backup: jest.fn(),
  resetStatistics: jest.fn(),
  displayStatistics: jest.fn(),
  exists: jest.fn().mockReturnValue(false),
  delete: jest.fn(),
  list: jest.fn().mockReturnValue([]),
};

jest.mock('../storage.js', () => ({
  SimpleStorage: jest.fn().mockImplementation(() => mockStorage),
}));

import { jest } from '@jest/globals';
import { PropertyMonitor } from '../property-monitor.js';
import { PropertyMonitoringData } from '../types.js';

describe('PropertyMonitor', () => {
  let propertyMonitor: PropertyMonitor;
  let mockStorageInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock behavior for different keys
    mockStorage.load.mockImplementation((key: string): any => {
      if (key === 'previous_properties') {
        return null; // Default: no previous properties
      } else if (key === 'monitoring_statistics') {
        return {
          totalChecks: 0,
          newPropertyDetections: 0,
          lastCheckAt: new Date(),
        };
      }
      return null;
    });
    
    // Create the PropertyMonitor which will create a SimpleStorage instance internally
    propertyMonitor = new PropertyMonitor();
    
    // Use the global mockStorage
    mockStorageInstance = mockStorage;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectNewProperties', () => {
    const createProperty = (title: string, price: string, location?: string) => ({
      title,
      price,
      location,
    });

    it('新着物件を検知できること', () => {
      // 前回のデータ
      const previousData: PropertyMonitoringData[] = [
        {
          signature: '物件A:1000万円:東京都',
          title: '物件A',
          price: '1000万円',
          location: '東京都',
          detectedAt: new Date('2024-01-01'),
        },
      ];

      // 現在のデータ（新着あり）
      const currentProperties = [
        createProperty('物件A', '1000万円', '東京都'), // 既存
        createProperty('物件B', '2000万円', '神奈川県'), // 新着
      ];

      mockStorageInstance.load.mockReturnValue(previousData);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(1);
      expect(result.newProperties).toHaveLength(1);
      expect(result.newProperties[0]?.title).toBe('物件B');
      expect(result.totalMonitored).toBe(2);
    });

    it('新着物件がない場合はfalseを返すこと', () => {
      const previousData: PropertyMonitoringData[] = [
        {
          signature: '物件A:1000万円:東京都',
          title: '物件A',
          price: '1000万円',
          location: '東京都',
          detectedAt: new Date('2024-01-01'),
        },
      ];

      const currentProperties = [
        createProperty('物件A', '1000万円', '東京都'), // 既存のみ
      ];

      mockStorageInstance.load.mockReturnValue(previousData);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(false);
      expect(result.newPropertyCount).toBe(0);
      expect(result.newProperties).toHaveLength(0);
    });

    it('初回チェック時は全て新着として扱うこと', () => {
      const currentProperties = [
        createProperty('物件A', '1000万円', '東京都'),
        createProperty('物件B', '2000万円', '神奈川県'),
      ];

      mockStorageInstance.load.mockReturnValue(null); // 前回データなし

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(2);
      expect(result.newProperties).toHaveLength(2);
    });

    it('空の物件リストを処理できること', () => {
      const currentProperties: any[] = [];

      mockStorageInstance.load.mockReturnValue([]);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(false);
      expect(result.newPropertyCount).toBe(0);
      expect(result.newProperties).toHaveLength(0);
      expect(result.totalMonitored).toBe(0);
    });

    it('統計情報を更新すること', () => {
      const currentProperties = [
        createProperty('物件A', '1000万円', '東京都'),
      ];

      mockStorageInstance.load.mockReturnValue([]);

      propertyMonitor.detectNewProperties(currentProperties);

      expect(mockStorageInstance.save).toHaveBeenCalledTimes(2); // previous_properties and monitoring_statistics
      const saveCalls = mockStorageInstance.save.mock.calls;
      // Find the monitoring_statistics save call
      const statsCall = saveCalls.find((call: any) => call[0] === 'monitoring_statistics');
      expect(statsCall).toBeDefined();
      if (statsCall) {
        const stats = statsCall[1];
        expect(stats.newPropertyDetections).toBeGreaterThan(0);
      }
    });

    it('現在のデータを保存すること', () => {
      const currentProperties = [
        createProperty('物件A', '1000万円', '東京都'),
      ];

      mockStorageInstance.load.mockReturnValue([]);

      propertyMonitor.detectNewProperties(currentProperties);

      expect(mockStorageInstance.save).toHaveBeenCalled();
      const saveCalls = mockStorageInstance.save.mock.calls;
      expect(saveCalls).toHaveLength(1);
      expect(saveCalls[0]).toBeDefined();
      
      const saveCall = saveCalls[0];
      if (!saveCall) {
        throw new Error('Save was not called');
      }
      expect(saveCall[0]).toBe('previous_properties');
      expect(saveCall[1]).toBeDefined();
      expect(Array.isArray(saveCall[1])).toBe(true);
      
      const savedData = saveCall[1] as PropertyMonitoringData[];
      expect(savedData).toHaveLength(1);
      expect(savedData[0]?.title).toBe('物件A');
    });

    it('信頼度を正しく計算すること', () => {
      // very_high: 3件以上監視、新着3件以下
      const properties1 = [
        createProperty('物件A', '1000万円'),
        createProperty('物件B', '2000万円'),
        createProperty('物件C', '3000万円'),
      ];
      mockStorageInstance.load.mockReturnValue([]);
      
      let result = propertyMonitor.detectNewProperties(properties1);
      expect(result.confidence).toBe('very_high');

      // high: 2件以上監視
      const properties2 = [
        createProperty('物件A', '1000万円'),
        createProperty('物件B', '2000万円'),
      ];
      
      result = propertyMonitor.detectNewProperties(properties2);
      expect(result.confidence).toBe('high');

      // medium: それ以外
      const properties3 = [
        createProperty('物件A', '1000万円'),
      ];
      
      result = propertyMonitor.detectNewProperties(properties3);
      expect(result.confidence).toBe('medium');
    });

    it('エラー時に例外を投げること', () => {
      mockStorageInstance.load.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const currentProperties = [
        createProperty('物件A', '1000万円'),
      ];

      expect(() => {
        propertyMonitor.detectNewProperties(currentProperties);
      }).toThrow('Storage error');
    });
  });

  describe('createPropertySignature', () => {
    it('物件の一意署名を作成できること', () => {
      const property = {
        title: '新築マンション',
        price: '3000万円',
        location: '東京都渋谷区',
      };

      mockStorageInstance.load.mockReturnValue([]);
      // プライベートメソッドのテストは間接的に
      const result = propertyMonitor.detectNewProperties([property]);
      
      expect(result.newProperties[0]?.signature).toBe('新築マンション:3000万円:東京都渋谷区');
    });

    it('空白をトリムして署名を作成すること', () => {
      const property = {
        title: '  新築マンション  ',
        price: '  3000万円  ',
        location: '  東京都渋谷区  ',
      };

      mockStorageInstance.load.mockReturnValue([]);
      const result = propertyMonitor.detectNewProperties([property]);
      
      expect(result.newProperties[0]?.signature).toBe('新築マンション:3000万円:東京都渋谷区');
    });

    it('locationがない場合も署名を作成できること', () => {
      const property = {
        title: '新築マンション',
        price: '3000万円',
      };

      mockStorageInstance.load.mockReturnValue([]);
      const result = propertyMonitor.detectNewProperties([property]);
      
      expect(result.newProperties[0]?.signature).toBe('新築マンション:3000万円:');
    });
  });

  describe('loadPreviousProperties', () => {
    it('前回データの読み込みエラーをハンドルすること', () => {
      mockStorageInstance.load.mockImplementation(() => {
        throw new Error('File not found');
      });

      // エラーが発生しても続行（空配列として扱う）
      const currentProperties = [
        { title: '物件A', price: '1000万円' },
      ];

      // エラーをスローする
      expect(() => {
        propertyMonitor.detectNewProperties(currentProperties);
      }).toThrow('File not found');
    });
  });

  describe('updateMonitoringStatistics', () => {
    it('新着検知時に統計を更新すること', () => {
      const currentProperties = [
        { title: '新着物件', price: '1000万円' },
      ];

      mockStorageInstance.load.mockReturnValue([]); // 前回データなし

      propertyMonitor.detectNewProperties(currentProperties);

      // monitoring_statistics save callを確認
      const saveCalls = mockStorageInstance.save.mock.calls;
      const statsCall = saveCalls.find((call: any) => call[0] === 'monitoring_statistics');
      expect(statsCall).toBeDefined();
    });

    it('新着なしの場合も統計を更新すること', () => {
      const previousData: PropertyMonitoringData[] = [
        {
          signature: '既存物件:1000万円:',
          title: '既存物件',
          price: '1000万円',
          detectedAt: new Date(),
        },
      ];

      const currentProperties = [
        { title: '既存物件', price: '1000万円' },
      ];

      mockStorageInstance.load.mockReturnValue(previousData);

      propertyMonitor.detectNewProperties(currentProperties);

      // monitoring_statistics save callを確認
      const saveCalls = mockStorageInstance.save.mock.calls;
      const statsCall = saveCalls.find((call: any) => call[0] === 'monitoring_statistics');
      expect(statsCall).toBeDefined();
    });
  });

  describe('Integration tests', () => {
    it('複数の新着物件を正しく処理できること', () => {
      const previousData: PropertyMonitoringData[] = [
        {
          signature: '既存A:1000万円:東京',
          title: '既存A',
          price: '1000万円',
          location: '東京',
          detectedAt: new Date(),
        },
      ];

      const currentProperties = [
        { title: '既存A', price: '1000万円', location: '東京' },
        { title: '新着B', price: '2000万円', location: '神奈川' },
        { title: '新着C', price: '3000万円', location: '千葉' },
        { title: '新着D', price: '4000万円', location: '埼玉' },
      ];

      mockStorageInstance.load.mockReturnValue(previousData);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(3);
      expect(result.newProperties).toHaveLength(3);
      expect(result.totalMonitored).toBe(4);
      expect(result.confidence).toBe('very_high');
    });

    it('重複する署名の物件は新着として検知しないこと', () => {
      const previousData: PropertyMonitoringData[] = [
        {
          signature: '物件A:1000万円:東京',
          title: '物件A',
          price: '1000万円',
          location: '東京',
          detectedAt: new Date(),
        },
      ];

      const currentProperties = [
        { title: '物件A', price: '1000万円', location: '東京' }, // 既存（同じ署名）
        { title: '物件A', price: '1100万円', location: '東京' }, // 新着（価格が違う）
        { title: '物件A', price: '1000万円', location: '神奈川' }, // 新着（場所が違う）
      ];

      mockStorageInstance.load.mockReturnValue(previousData);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(2);
      expect(result.newProperties).toHaveLength(2);
    });
  });
});