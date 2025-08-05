import { jest } from '@jest/globals';

export class SimpleStorage {
  load: jest.Mock;
  save: jest.Mock;
  updateStatistics: jest.Mock;
  getHash: jest.Mock;
  setHash: jest.Mock;
  incrementChecks: jest.Mock;
  incrementErrors: jest.Mock;
  incrementNewListings: jest.Mock;
  recordExecutionTime: jest.Mock;
  getSuccessRate: jest.Mock;
  backup: jest.Mock;
  resetStatistics: jest.Mock;
  displayStatistics: jest.Mock;
  exists: jest.Mock;
  delete: jest.Mock;
  list: jest.Mock;
  
  constructor() {
    // Create all mock methods
    this.load = jest.fn().mockReturnValue(null);
    this.save = jest.fn();
    this.updateStatistics = jest.fn();
    this.getHash = jest.fn();
    this.setHash = jest.fn();
    this.incrementChecks = jest.fn();
    this.incrementErrors = jest.fn();
    this.incrementNewListings = jest.fn();
    this.recordExecutionTime = jest.fn();
    this.getSuccessRate = jest.fn().mockReturnValue(100);
    this.backup = jest.fn();
    this.resetStatistics = jest.fn();
    this.displayStatistics = jest.fn();
    this.exists = jest.fn().mockReturnValue(false);
    this.delete = jest.fn();
    this.list = jest.fn().mockReturnValue([]);
  }
}