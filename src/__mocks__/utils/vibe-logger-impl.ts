import { jest } from '@jest/globals';

export const createFileLogger = jest.fn(() => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));
