import { jest } from '@jest/globals';

export const Telegraf = jest.fn().mockImplementation(() => ({
  telegram: {
    getMe: jest.fn(() =>
      Promise.resolve({
        id: 123456789,
        is_bot: true,
        first_name: 'Test Bot',
        username: 'test_bot',
      })
    ),
    sendMessage: jest.fn(() =>
      Promise.resolve({
        message_id: 1,
        date: Date.now(),
        chat: { id: -123456789, type: 'group' },
        text: 'Test message',
      })
    ),
  },
}));
