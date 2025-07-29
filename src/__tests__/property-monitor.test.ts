import { PropertyMonitor } from '../property-monitor';
import { SimpleStorage } from '../storage';
import { vibeLogger } from '../logger';
import { PropertyMonitoringData } from '../types';

jest.mock('../storage');
jest.mock('../logger');

describe('PropertyMonitor', () => {
  let propertyMonitor: PropertyMonitor;
  let mockStorage: jest.Mocked<SimpleStorage>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Storageのモック設定
    mockStorage = new SimpleStorage() as jest.Mocked<SimpleStorage>;
    mockStorage.save = jest.fn();
    mockStorage.load = jest.fn();

    // PropertyMonitorインスタンスを作成
    propertyMonitor = new PropertyMonitor();
    (propertyMonitor as any).storage = mockStorage;
  });

  describe('detectNewProperties', () => {
    it('初回実行時（前回データなし）は全物件を新着として検知', () => {
      const currentProperties = [
        { title: '物件1', price: '1,000万円', location: '広島市中区' },
        { title: '物件2', price: '2,000万円', location: '広島市西区' },
      ];

      mockStorage.load.mockReturnValue(null); // 前回データなし

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(2);
      expect(result.newProperties).toHaveLength(2);
      expect(result.totalMonitored).toBe(2);
      expect(result.confidence).toBe('high'); // 2件の場合はhigh

      expect(mockStorage.save.mock.calls[0]).toEqual([
        'previous_properties',
        expect.arrayContaining([
          expect.objectContaining({
            title: '物件1',
            price: '1,000万円',
            location: '広島市中区',
          }),
        ]),
      ]);
    });

    it('2回目実行時は新着物件のみを検知', () => {
      const previousData: PropertyMonitoringData[] = [
        {
          signature: '物件1:1,000万円:広島市中区',
          title: '物件1',
          price: '1,000万円',
          location: '広島市中区',
          detectedAt: new Date(),
        },
      ];

      const currentProperties = [
        { title: '物件1', price: '1,000万円', location: '広島市中区' }, // 既存
        { title: '物件2', price: '2,000万円', location: '広島市西区' }, // 新着
      ];

      mockStorage.load.mockReturnValue(previousData);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(1);
      expect(result.newProperties).toHaveLength(1);
      expect(result.newProperties[0]?.title).toBe('物件2');
    });

    it('新着物件がない場合はhasNewPropertyがfalse', () => {
      const previousData: PropertyMonitoringData[] = [
        {
          signature: '物件1:1,000万円:広島市中区',
          title: '物件1',
          price: '1,000万円',
          location: '広島市中区',
          detectedAt: new Date(),
        },
      ];

      const currentProperties = [{ title: '物件1', price: '1,000万円', location: '広島市中区' }];

      mockStorage.load.mockReturnValue(previousData);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(false);
      expect(result.newPropertyCount).toBe(0);
      expect(result.newProperties).toHaveLength(0);
    });

    it('空の物件リストを処理できる', () => {
      mockStorage.load.mockReturnValue([]);

      const result = propertyMonitor.detectNewProperties([]);

      expect(result.hasNewProperty).toBe(false);
      expect(result.newPropertyCount).toBe(0);
      expect(result.totalMonitored).toBe(0);
      expect(result.confidence).toBe('medium');
    });

    it('location（所在地）がない物件も処理できる', () => {
      const currentProperties = [
        { title: '物件1', price: '1,000万円' }, // locationなし
      ];

      mockStorage.load.mockReturnValue(null);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(1);
      expect(result.newProperties[0]?.location).toBe('');
    });

    it('データ読み込みエラー時は空配列として処理', () => {
      mockStorage.load.mockImplementation(() => {
        throw new Error('Load error');
      });

      const currentProperties = [{ title: '物件1', price: '1,000万円', location: '広島市中区' }];

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(1);
      expect(vibeLogger.warn.mock.calls.length).toBeGreaterThan(0);
    });

    it('データ保存エラー時は例外を投げる', () => {
      mockStorage.save.mockImplementation(() => {
        throw new Error('Save error');
      });

      const currentProperties = [{ title: '物件1', price: '1,000万円', location: '広島市中区' }];

      expect(() => {
        propertyMonitor.detectNewProperties(currentProperties);
      }).toThrow('Save error');

      expect(vibeLogger.error.mock.calls.length).toBeGreaterThan(0);
    });

    it('統計情報の更新が正しく行われる', () => {
      // 初回実行（新着あり）
      mockStorage.load
        .mockReturnValueOnce(null) // previous_properties
        .mockReturnValueOnce(null); // monitoring_statistics

      const properties = [{ title: '物件1', price: '1,000万円' }];
      propertyMonitor.detectNewProperties(properties);

      expect(mockStorage.save.mock.calls.find(call => call[0] === 'monitoring_statistics')).toEqual(
        [
          'monitoring_statistics',
          expect.objectContaining({
            totalChecks: 1,
            newPropertyDetections: 1,
            lastCheckAt: expect.any(Date),
            lastNewPropertyAt: expect.any(Date),
          }),
        ]
      );

      // 2回目実行（新着なし）
      mockStorage.save.mockClear();
      mockStorage.load
        .mockReturnValueOnce([
          {
            // previous_properties
            signature: '物件1:1,000万円:',
            title: '物件1',
            price: '1,000万円',
            location: '',
            detectedAt: new Date(),
          },
        ])
        .mockReturnValueOnce({
          // monitoring_statistics
          totalChecks: 1,
          newPropertyDetections: 1,
          lastCheckAt: new Date(),
          lastNewPropertyAt: new Date(),
        });

      propertyMonitor.detectNewProperties(properties);

      expect(mockStorage.save.mock.calls.find(call => call[0] === 'monitoring_statistics')).toEqual(
        [
          'monitoring_statistics',
          expect.objectContaining({
            totalChecks: 2,
            newPropertyDetections: 1, // 増えない
          }),
        ]
      );
    });
  });

  describe('getMonitoringStatistics', () => {
    it('統計情報を取得できる', () => {
      const mockStats = {
        totalChecks: 100,
        newPropertyDetections: 10,
        lastCheckAt: new Date(),
        lastNewPropertyAt: new Date(),
      };

      mockStorage.load.mockReturnValue(mockStats);

      const stats = propertyMonitor.getMonitoringStatistics();

      expect(stats).toEqual(mockStats);
      expect(mockStorage.load.mock.calls[0]).toEqual(['monitoring_statistics']);
    });

    it('統計情報が存在しない場合はデフォルト値を返す', () => {
      mockStorage.load.mockReturnValue(null);

      const stats = propertyMonitor.getMonitoringStatistics();

      expect(stats).toEqual({
        totalChecks: 0,
        newPropertyDetections: 0,
        lastCheckAt: expect.any(Date),
      });
    });
  });

  describe('信頼度の計算', () => {
    it('3件以上で新着3件以下の場合はvery_high', () => {
      const currentProperties = [
        { title: '物件1', price: '1,000万円' },
        { title: '物件2', price: '2,000万円' },
        { title: '物件3', price: '3,000万円' },
      ];

      mockStorage.load.mockReturnValue(null);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.confidence).toBe('very_high');
    });

    it('2件の場合はhigh', () => {
      const currentProperties = [
        { title: '物件1', price: '1,000万円' },
        { title: '物件2', price: '2,000万円' },
      ];

      mockStorage.load.mockReturnValue(null);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.confidence).toBe('high');
    });

    it('1件以下の場合はmedium', () => {
      const currentProperties = [{ title: '物件1', price: '1,000万円' }];

      mockStorage.load.mockReturnValue(null);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.confidence).toBe('medium');
    });
  });
});
