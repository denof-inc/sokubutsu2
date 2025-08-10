import { jest, describe, it, expect } from '@jest/globals';
import { MonitoringScheduler } from '../scheduler.js';

// 依存関係のモック
jest.mock('../telegram.js');
jest.mock('../storage.js');
jest.mock('../scraper.js');
jest.mock('../property-monitor.js');
jest.mock('../circuit-breaker.js');
jest.mock('../logger.js');
jest.mock('node-cron');

describe('MonitoringScheduler', () => {
  describe('constructor', () => {
    it('インスタンスを正しく初期化すること', () => {
      const scheduler = new MonitoringScheduler('test-token', 'test-chat-id');
      expect(scheduler).toBeDefined();
      expect(scheduler).toBeInstanceOf(MonitoringScheduler);
    });
  });
});