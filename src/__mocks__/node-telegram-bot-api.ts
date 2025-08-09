import { jest } from '@jest/globals';

// node-telegram-bot-apiのモック実装
export default jest.fn().mockImplementation(() => ({
  sendMessage: jest.fn().mockResolvedValue({
    message_id: 123,
    date: Date.now(),
    chat: { id: 'test-chat-id', type: 'private' },
    text: 'Test message'
  }),
  getMe: jest.fn().mockResolvedValue({
    id: 1,
    is_bot: true,
    first_name: 'Test Bot',
    username: 'test_bot'
  })
}));