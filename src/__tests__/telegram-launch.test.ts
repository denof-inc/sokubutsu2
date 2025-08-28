import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mocks for grammy Bot internals
const mockDeleteWebhook = jest.fn<() => Promise<any>>();
const mockGetMe = jest.fn<() => Promise<any>>();
const mockStart = jest.fn<() => Promise<void>>();
const mockStop = jest.fn<() => void>();

const MockBot = jest.fn(() => ({
  api: {
    deleteWebhook: mockDeleteWebhook,
    getMe: mockGetMe,
  },
  start: mockStart,
  stop: mockStop,
  catch: jest.fn(),
  command: jest.fn(),
}));

jest.unstable_mockModule('grammy', () => ({
  Bot: MockBot,
}));

const { TelegramNotifier } = await import('../telegram.js');

describe('TelegramNotifier.launchBot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteWebhook.mockResolvedValue({ ok: true });
    mockGetMe.mockResolvedValue({ id: 1, username: 'bot' });
    mockStart.mockResolvedValue();
  });

  it('deletes webhook, verifies connectivity, and launches', async () => {
    const notifier = new TelegramNotifier('token', 'chat');
    await expect(notifier.launchBot()).resolves.toBeUndefined();
    expect(mockDeleteWebhook).toHaveBeenCalled();
    expect(mockGetMe).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalled();
  });

  it('retries launch on failure and eventually succeeds', async () => {
    mockStart.mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce();

    const notifier = new TelegramNotifier('token', 'chat');
    await expect(notifier.launchBot()).resolves.toBeUndefined();
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('throws after max attempts', async () => {
    mockStart.mockRejectedValue(new Error('fail'));
    const notifier = new TelegramNotifier('token', 'chat');
    await expect(notifier.launchBot()).rejects.toThrow('fail');
    expect(mockStart).toHaveBeenCalled();
  });
});
