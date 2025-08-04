import { jest } from '@jest/globals';
import { PropertyMonitor } from '../property-monitor.js';
import { PropertyMonitoringData } from '../types.js';
import { isDefined } from '../types/test.js';

// モジュール全体のモック
const mockStorage = {
  load: jest.fn(),
  save: jest.fn(),
  updateStatistics: jest.fn(),
};

jest.mock('../storage.js', () => ({
  SimpleStorage: jest.fn(() => mockStorage),
}));

jest.mock('../logger.js', () => ({
  vibeLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('PropertyMonitor', () => {
  let propertyMonitor: PropertyMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    propertyMonitor = new PropertyMonitor();
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

      mockStorage.load.mockReturnValue(previousData);

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

      mockStorage.load.mockReturnValue(previousData);

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

      mockStorage.load.mockReturnValue(null); // 前回データなし

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(2);
      expect(result.newProperties).toHaveLength(2);
    });

    it('空の物件リストを処理できること', () => {
      const currentProperties: any[] = [];

      mockStorage.load.mockReturnValue([]);

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

      mockStorage.load.mockReturnValue([]);

      propertyMonitor.detectNewProperties(currentProperties);

      expect(mockStorage.updateStatistics).toHaveBeenCalled();
      const updateCalls = (mockStorage.updateStatistics as jest.Mock).mock.calls;
      if (!isDefined(updateCalls[0])) {
        throw new Error('updateStatistics was not called');
      }
      const updateCall = updateCalls[0][0] as { hasNewProperty: boolean };
      expect(updateCall.hasNewProperty).toBe(true);
    });

    it('現在のデータを保存すること', () => {
      const currentProperties = [
        createProperty('物件A', '1000万円', '東京都'),
      ];

      mockStorage.load.mockReturnValue([]);

      propertyMonitor.detectNewProperties(currentProperties);

      expect(mockStorage.save).toHaveBeenCalled();
      const saveCalls = (mockStorage.save as jest.Mock).mock.calls;
      
      if (!isDefined(saveCalls[0])) {
        throw new Error('save method was not called');
      }
      
      const saveCall = saveCalls[0];
      expect(saveCall[0]).toBe('previous_properties');
      expect(saveCall[1]).toBeDefined();
      expect(saveCall[1]).toHaveLength(1);
      expect(saveCall[1][0].title).toBe('物件A');
    });

    it('信頼度を正しく計算すること', () => {
      // very_high: 3件以上監視、新着3件以下
      const properties1 = [
        createProperty('物件A', '1000万円'),
        createProperty('物件B', '2000万円'),
        createProperty('物件C', '3000万円'),
      ];
      mockStorage.load.mockReturnValue([]);
      
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
      mockStorage.load.mockImplementation(() => {
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

      mockStorage.load.mockReturnValue([]);
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

      mockStorage.load.mockReturnValue([]);
      const result = propertyMonitor.detectNewProperties([property]);
      
      expect(result.newProperties[0]?.signature).toBe('新築マンション:3000万円:東京都渋谷区');
    });

    it('locationがない場合も署名を作成できること', () => {
      const property = {
        title: '新築マンション',
        price: '3000万円',
      };

      mockStorage.load.mockReturnValue([]);
      const result = propertyMonitor.detectNewProperties([property]);
      
      expect(result.newProperties[0]?.signature).toBe('新築マンション:3000万円:');
    });
  });

  describe('loadPreviousProperties', () => {
    it('前回データの読み込みエラーをハンドルすること', () => {
      mockStorage.load.mockImplementation(() => {
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

      mockStorage.load.mockReturnValue([]); // 前回データなし

      propertyMonitor.detectNewProperties(currentProperties);

      expect(mockStorage.updateStatistics).toHaveBeenCalledWith({
        hasNewProperty: true,
      });
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

      mockStorage.load.mockReturnValue(previousData);

      propertyMonitor.detectNewProperties(currentProperties);

      expect(mockStorage.updateStatistics).toHaveBeenCalledWith({
        hasNewProperty: false,
      });
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

      mockStorage.load.mockReturnValue(previousData);

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

      mockStorage.load.mockReturnValue(previousData);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(2);
      expect(result.newProperties).toHaveLength(2);
    });
  });
});