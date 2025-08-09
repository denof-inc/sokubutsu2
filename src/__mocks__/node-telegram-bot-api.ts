import { jest } from '@jest/globals';

// node-telegram-bot-apiのモック実装
const mockSendMessage = jest.fn(() => Promise.resolve({
  message_id: 123,
  date: Date.now(),
  chat: { id: 'test-chat-id', type: 'private' },
  text: 'Test message'
}));

const mockGetMe = jest.fn(() => Promise.resolve({
  id: 1,
  is_bot: true,
  first_name: 'Test Bot',
  username: 'test_bot'
}));

export default jest.fn(() => ({
  sendMessage: mockSendMessage,
  getMe: mockGetMe
}));