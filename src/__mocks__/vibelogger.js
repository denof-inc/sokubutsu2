// vibeloggerのモック実装
export const createFileLogger = jest.fn(() => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
