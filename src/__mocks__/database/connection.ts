import { jest } from '@jest/globals';

export const AppDataSource = {
  isInitialized: true,
  getRepository: jest.fn(),
  initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  destroy: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
};
