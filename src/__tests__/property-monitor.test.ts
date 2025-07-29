import { jest, describe, it, expect, beforeEach } from '@jest/globals';
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { PropertyMonitoringData } from '../types.js';

// モック関数を作成
const mockSave = jest.fn();
const mockLoad = jest.fn();
const mockGetHash = jest.fn();
const mockSetHash = jest.fn();
const mockIncrementTotalChecks = jest.fn();
const mockIncrementErrors = jest.fn();
const mockIncrementNewListings = jest.fn();
const mockRecordExecutionTime = jest.fn();
const mockGetStats = jest.fn(() => ({
  totalChecks: 0,
  errors: 0,
  newListings: 0,
  lastCheck: new Date(),
  averageExecutionTime: 0,
  successRate: 100,
}));
const mockResetStats = jest.fn();
const mockCreateBackup = jest.fn(() => '/path/to/backup.json');
const mockDisplayStats = jest.fn();

const mockVibeLoggerWarn = jest.fn();
const mockVibeLoggerError = jest.fn();
const mockVibeLoggerInfo = jest.fn();

// モジュールをモック
jest.unstable_mockModule('../storage.js', () => ({
  SimpleStorage: jest.fn().mockImplementation(() => ({
    save: mockSave,
    load: mockLoad,
    getHash: mockGetHash,
    setHash: mockSetHash,
    incrementTotalChecks: mockIncrementTotalChecks,
    incrementErrors: mockIncrementErrors,
    incrementNewListings: mockIncrementNewListings,
    recordExecutionTime: mockRecordExecutionTime,
    getStats: mockGetStats,
    resetStats: mockResetStats,
    createBackup: mockCreateBackup,
    displayStats: mockDisplayStats,
  })),
}));

jest.unstable_mockModule('../logger.js', () => ({
  vibeLogger: {
    warn: mockVibeLoggerWarn,
    error: mockVibeLoggerError,
    info: mockVibeLoggerInfo,
  },
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
  LogLevel: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  },
  Logger: jest.fn(),
}));

// モックの後でインポート
const { PropertyMonitor } = await import('../property-monitor.js');
const { SimpleStorage } = await import('../storage.js');

describe('PropertyMonitor', () => {
  let propertyMonitor: InstanceType<typeof PropertyMonitor>;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Storageのモック設定
    mockStorage = new SimpleStorage() as any;

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

      mockLoad.mockReturnValue(null); // 前回データなし

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(2);
      expect(result.newProperties).toHaveLength(2);
      expect(result.totalMonitored).toBe(2);
      expect(result.confidence).toBe('high'); // 2件の場合はhigh

      expect(mockSave.mock.calls[0]).toEqual([
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

      mockLoad.mockReturnValue(previousData);

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

      mockLoad.mockReturnValue(previousData);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(false);
      expect(result.newPropertyCount).toBe(0);
      expect(result.newProperties).toHaveLength(0);
    });

    it('空の物件リストを処理できる', () => {
      mockLoad.mockReturnValue([]);

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

      mockLoad.mockReturnValue(null);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(1);
      expect(result.newProperties[0]?.location).toBe('');
    });

    it('データ読み込みエラー時は空配列として処理', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('Load error');
      });

      const currentProperties = [{ title: '物件1', price: '1,000万円', location: '広島市中区' }];

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.hasNewProperty).toBe(true);
      expect(result.newPropertyCount).toBe(1);
      expect(mockVibeLoggerWarn.mock.calls.length).toBeGreaterThan(0);
    });

    it('データ保存エラー時は例外を投げる', () => {
      mockSave.mockImplementation(() => {
        throw new Error('Save error');
      });

      const currentProperties = [{ title: '物件1', price: '1,000万円', location: '広島市中区' }];

      expect(() => {
        propertyMonitor.detectNewProperties(currentProperties);
      }).toThrow('Save error');

      expect(mockVibeLoggerError.mock.calls.length).toBeGreaterThan(0);
    });

    it('統計情報の更新が正しく行われる', () => {
      // 初回実行（新着あり）
      mockLoad
        .mockReturnValueOnce(null) // previous_properties
        .mockReturnValueOnce(null); // monitoring_statistics

      const properties = [{ title: '物件1', price: '1,000万円' }];
      propertyMonitor.detectNewProperties(properties);

      expect(mockSave.mock.calls.find((call: any) => call[0] === 'monitoring_statistics')).toEqual([
        'monitoring_statistics',
        expect.objectContaining({
          totalChecks: 1,
          newPropertyDetections: 1,
          lastCheckAt: expect.any(Date),
          lastNewPropertyAt: expect.any(Date),
        }),
      ]);

      // 2回目実行（新着なし）
      mockSave.mockClear();
      mockLoad
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

      expect(mockSave.mock.calls.find((call: any) => call[0] === 'monitoring_statistics')).toEqual([
        'monitoring_statistics',
        expect.objectContaining({
          totalChecks: 2,
          newPropertyDetections: 1, // 増えない
        }),
      ]);
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
      expect(mockLoad.mock.calls[0]).toEqual(['monitoring_statistics']);
    });

    it('統計情報が存在しない場合はデフォルト値を返す', () => {
      mockLoad.mockReturnValue(null);

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

      mockLoad.mockReturnValue(null);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.confidence).toBe('very_high');
    });

    it('2件の場合はhigh', () => {
      const currentProperties = [
        { title: '物件1', price: '1,000万円' },
        { title: '物件2', price: '2,000万円' },
      ];

      mockLoad.mockReturnValue(null);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.confidence).toBe('high');
    });

    it('1件以下の場合はmedium', () => {
      const currentProperties = [{ title: '物件1', price: '1,000万円' }];

      mockLoad.mockReturnValue(null);

      const result = propertyMonitor.detectNewProperties(currentProperties);

      expect(result.confidence).toBe('medium');
    });
  });
});
