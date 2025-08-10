// vibeloggerのモック実装
import { jest } from '@jest/globals';

export const createFileLogger = jest.fn(() => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
