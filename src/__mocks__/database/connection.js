import { jest } from '@jest/globals';

export const AppDataSource = {
  isInitialized: true,
  getRepository: jest.fn(),
  initialize: jest.fn(),
  destroy: jest.fn(),
};