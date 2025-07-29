import { jest } from '@jest/globals';

export const PropertyMonitor = jest.fn().mockImplementation(() => ({
  detectNewProperties: jest.fn(() => ({
    hasNewProperty: false,
    newPropertyCount: 0,
    newProperties: [],
    totalMonitored: 3,
    detectedAt: new Date(),
    confidence: 'very_high',
  })),
  getMonitoringStatistics: jest.fn(() => ({
    totalChecks: 10,
    newPropertyDetections: 2,
    lastCheckAt: new Date(),
    lastNewPropertyAt: new Date(),
  })),
}));
