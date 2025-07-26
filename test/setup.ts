// Jest テストセットアップファイル

// グローバルなテスト設定
beforeAll(async () => {
  // テスト開始前の初期化処理
  console.log('🧪 テスト環境を初期化中...');
});

afterAll(async () => {
  // テスト終了後のクリーンアップ処理
  console.log('🧹 テスト環境をクリーンアップ中...');
});

// 各テストファイル実行前の処理
beforeEach(() => {
  // モックのリセット
  jest.clearAllMocks();
});

// カスタムマッチャーの追加
expect.extend({
  toBeValidUrl(received: string) {
    try {
      new URL(received);
      return {
        message: () => `expected ${received} not to be a valid URL`,
        pass: true,
      };
    } catch {
      return {
        message: () => `expected ${received} to be a valid URL`,
        pass: false,
      };
    }
  },
});

// TypeScript型定義の拡張
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidUrl(): R;
    }
  }
}

// テスト用のユーティリティ関数
export const createMockUser = () => ({
  id: '1',
  telegramId: '123456789',
  username: 'testuser',
  firstName: 'Test',
  isActive: true,
  createdAt: new Date(),
  lastActiveAt: new Date(),
});

export const createMockUrl = () => ({
  id: '1',
  userId: '123456789',
  url: 'https://example.com',
  name: 'テストURL',
  isActive: true,
  createdAt: new Date(),
  lastCheckedAt: new Date(),
  lastNotifiedAt: new Date(),
});

// 非同期テスト用のヘルパー
export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// モック用のファクトリー関数
export const createMockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

export const createMockService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});
