import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mocks for Telegraf internals
const mockDeleteWebhook = jest.fn<() => Promise<any>>();
const mockGetMe = jest.fn<() => Promise<any>>();
const mockLaunch = jest.fn<() => Promise<void>>();
const mockStop = jest.fn<() => void>();

const mockTelegraf = jest.fn(() => ({
  telegram: {
    deleteWebhook: mockDeleteWebhook,
    getMe: mockGetMe,
  },
  launch: mockLaunch,
  stop: mockStop,
}));

jest.unstable_mockModule('telegraf', () => ({
  Telegraf: mockTelegraf,
}));

const { TelegramNotifier } = await import('../telegram.js');

describe('TelegramNotifier.launchBot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteWebhook.mockResolvedValue({ ok: true });
    mockGetMe.mockResolvedValue({ id: 1, username: 'bot' });
    mockLaunch.mockResolvedValue();
  });

  it('deletes webhook, verifies connectivity, and launches', async () => {
    const notifier = new TelegramNotifier('token', 'chat');
    await expect(notifier.launchBot()).resolves.toBeUndefined();
    expect(mockDeleteWebhook).toHaveBeenCalled();
    expect(mockGetMe).toHaveBeenCalled();
    expect(mockLaunch).toHaveBeenCalled();
  });

  it('retries launch on failure and eventually succeeds', async () => {
    mockLaunch.mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce();

    const notifier = new TelegramNotifier('token', 'chat');
    await expect(notifier.launchBot()).resolves.toBeUndefined();
    expect(mockLaunch).toHaveBeenCalledTimes(2);
  });

  it('throws after max attempts', async () => {
    mockLaunch.mockRejectedValue(new Error('fail'));
    const notifier = new TelegramNotifier('token', 'chat');
    await expect(notifier.launchBot()).rejects.toThrow('fail');
    expect(mockLaunch).toHaveBeenCalled();
  });
});
