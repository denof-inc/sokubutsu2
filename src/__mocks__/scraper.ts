import { jest } from '@jest/globals';

export const SimpleScraper = jest.fn().mockImplementation(() => ({
  scrapeAthome: jest.fn(() =>
    Promise.resolve({
      success: true,
      hash: 'test-hash',
      count: 10,
      executionTime: 2000,
      memoryUsage: 40,
    })
  ),
  validateResult: jest.fn(() => true),
}));
