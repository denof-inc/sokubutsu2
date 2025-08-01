import { jest } from '@jest/globals';

export const SimpleStorage = jest.fn().mockImplementation(() => ({
  save: jest.fn(),
  load: jest.fn(),
  getHash: jest.fn(),
  setHash: jest.fn(),
  incrementTotalChecks: jest.fn(),
  incrementErrors: jest.fn(),
  incrementNewListings: jest.fn(),
  recordExecutionTime: jest.fn(),
  getStats: jest.fn(() => ({
    totalChecks: 0,
    errors: 0,
    newListings: 0,
    lastCheck: new Date(),
    averageExecutionTime: 0,
    successRate: 100,
  })),
  resetStats: jest.fn(),
  createBackup: jest.fn(() => '/path/to/backup.json'),
  displayStats: jest.fn(),
}));
