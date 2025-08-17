import { jest } from '@jest/globals';
import { MultiUserMonitoringScheduler } from '../scheduler/MultiUserScheduler.js';
import { UserService } from '../services/UserService.js';
import { SimpleScraper } from '../scraper.js';
import { PropertyMonitor } from '../property-monitor.js';
import { UserUrl } from '../entities/UserUrl.js';

// Mock dependencies
jest.mock('../services/UserService.js');
jest.mock('../scraper.js');
jest.mock('../property-monitor.js');
jest.mock('../database/connection.js');
jest.mock('../logger.js');

describe('MultiUser Integration Test', () => {
  let scheduler: MultiUserMonitoringScheduler;
  let mockUserService: jest.Mocked<UserService>;
  let mockScraper: jest.Mocked<SimpleScraper>;
  let mockPropertyMonitor: jest.Mocked<PropertyMonitor>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // UserService mock
    mockUserService = new UserService() as jest.Mocked<UserService>;
    
    // SimpleScraper mock
    mockScraper = new SimpleScraper() as jest.Mocked<SimpleScraper>;
    
    // PropertyMonitor mock
    mockPropertyMonitor = new PropertyMonitor() as jest.Mocked<PropertyMonitor>;
    
    scheduler = new MultiUserMonitoringScheduler();
    
    // Replace internal dependencies
    (scheduler as any).userService = mockUserService;
    (scheduler as any).scraper = mockScraper;
    (scheduler as any).propertyMonitor = mockPropertyMonitor;
  });

  describe('マルチユーザー機能の基本動作', () => {
    it('複数ユーザーのURL監視ができること', async () => {
      // Test data
      const testUrls: Partial<UserUrl>[] = [
        {
          id: 'url1',
          url: 'https://www.athome.co.jp/test1',
          name: 'テスト物件1',
          userId: 'user1',
          isActive: true,
          isMonitoring: true,
          totalChecks: 0,
          errorCount: 0,
          newListingsCount: 0,
        },
        {
          id: 'url2', 
          url: 'https://www.athome.co.jp/test2',
          name: 'テスト物件2',
          userId: 'user2',
          isActive: true,
          isMonitoring: true,
          totalChecks: 0,
          errorCount: 0,
          newListingsCount: 0,
        }
      ];

      // Mock setup
      mockUserService.getAllActiveMonitoringUrls = jest.fn(() => 
        Promise.resolve(testUrls as UserUrl[])
      );

      mockScraper.scrapeAthome = jest.fn(() => Promise.resolve({
        success: true,
        count: 10,
        hash: 'test-hash',
        properties: []
      }));

      mockPropertyMonitor.detectNewProperties = jest.fn(() => ({
        hasNewProperty: false,
        newPropertyCount: 0,
        totalMonitored: 10,
        confidence: 'high' as const,
        newProperties: [],
        detectedAt: new Date()
      }));

      // Execute monitoring cycle
      await (scheduler as any).runMonitoringCycle();

      // Verify calls
      expect(mockUserService.getAllActiveMonitoringUrls).toHaveBeenCalledTimes(1);
      expect(mockScraper.scrapeAthome).toHaveBeenCalledTimes(2);
      expect(mockScraper.scrapeAthome).toHaveBeenCalledWith(testUrls[0]?.url);
      expect(mockScraper.scrapeAthome).toHaveBeenCalledWith(testUrls[1]?.url);
    });

    it('Scraper APIの互換性確認', async () => {
      // Check if SimpleScraper has the required method
      const scraper = new SimpleScraper();
      expect(typeof scraper.scrapeAthome).toBe('function');
      
      // Test method signature compatibility
      const mockUrl = 'https://www.athome.co.jp/test';
      const result = await scraper.scrapeAthome(mockUrl);
      
      // Verify return structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('properties');
    });

    it('PropertyMonitor APIの互換性確認', () => {
      const propertyMonitor = new PropertyMonitor();
      
      // Test method signature compatibility
      const testProperties: any[] = [];
      const result = propertyMonitor.detectNewProperties(testProperties);
      
      // Verify return structure
      expect(result).toHaveProperty('hasNewProperty');
      expect(result).toHaveProperty('newPropertyCount');
      expect(result).toHaveProperty('totalMonitored');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('newProperties');
      expect(result).toHaveProperty('detectedAt');
    });
  });

  describe('エラーハンドリング', () => {
    it('スクレイピングエラー時の処理', async () => {
      const testUrl: Partial<UserUrl> = {
        id: 'url1',
        url: 'https://www.athome.co.jp/error',
        name: 'エラーテスト',
        userId: 'user1',
        isActive: true,
        isMonitoring: true,
        totalChecks: 0,
        errorCount: 0,
      };

      mockUserService.getAllActiveMonitoringUrls = jest.fn(() => 
        Promise.resolve([testUrl as UserUrl])
      );

      mockScraper.scrapeAthome = jest.fn(() => Promise.resolve({
        success: false,
        error: 'Network error',
        count: 0,
        hash: '',
        properties: []
      }));

      // Execute monitoring cycle
      await (scheduler as any).runMonitoringCycle();

      // Should handle error gracefully
      expect(mockScraper.scrapeAthome).toHaveBeenCalledWith(testUrl.url);
      expect(mockPropertyMonitor.detectNewProperties).not.toHaveBeenCalled();
    });
  });

  describe('新着物件検知', () => {
    it('新着物件検知時の通知処理', async () => {
      const testUrl: Partial<UserUrl> = {
        id: 'url1',
        url: 'https://www.athome.co.jp/new',
        name: '新着テスト',
        userId: 'user1',
        isActive: true,
        isMonitoring: true,
        totalChecks: 0,
        errorCount: 0,
        newListingsCount: 0,
        lastHash: 'old-hash',
      };

      mockUserService.getAllActiveMonitoringUrls = jest.fn(() => 
        Promise.resolve([testUrl as UserUrl])
      );

      mockScraper.scrapeAthome = jest.fn(() => Promise.resolve({
        success: true,
        count: 12,
        hash: 'new-hash', // Hash changed
        properties: [
          { title: '新着物件1', price: '10万円', location: '東京都' },
          { title: '新着物件2', price: '12万円', location: '東京都' }
        ]
      }));

      mockPropertyMonitor.detectNewProperties = jest.fn(() => ({
        hasNewProperty: true,
        newPropertyCount: 2,
        totalMonitored: 12,
        confidence: 'high' as const,
        newProperties: [
          { title: '新着物件1', price: '10万円', location: '東京都', signature: 'sig1', detectedAt: new Date() },
          { title: '新着物件2', price: '12万円', location: '東京都', signature: 'sig2', detectedAt: new Date() }
        ],
        detectedAt: new Date()
      }));

      // Mock notification service
      const mockNotificationService = {
        sendNewPropertyNotification: jest.fn(() => Promise.resolve())
      };
      (scheduler as any).notificationService = mockNotificationService;

      // Execute monitoring cycle
      await (scheduler as any).runMonitoringCycle();

      // Verify new property detection and notification
      expect(mockPropertyMonitor.detectNewProperties).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.sendNewPropertyNotification).toHaveBeenCalledTimes(1);
    });
  });
});