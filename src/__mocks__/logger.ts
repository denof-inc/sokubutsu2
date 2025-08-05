import { jest } from '@jest/globals';

export const vibeLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  step: jest.fn(),
  success: jest.fn(),
};