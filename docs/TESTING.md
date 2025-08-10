# テストガイド

## 🧪 テスト環境の概要

このプロジェクトは**Jest + ESM環境**でテストを実行します。すべてのテストはTypeScriptで記述され、ESMモジュールシステムに完全対応しています。

## 📋 テスト戦略

### テストカバレッジ目標
- **全体**: 80%以上
- **重要モジュール**: 90%以上（scraper, telegram, storage）
- **ユーティリティ**: 70%以上

### テストの種類
1. **単体テスト**: 個々のモジュールの機能テスト
2. **統合テスト**: モジュール間の連携テスト
3. **E2Eテスト**: 実際の動作環境を模したテスト

## 🚀 テストの実行

### 基本コマンド
```bash
# すべてのテストを実行
npm test

# ウォッチモードで実行（ファイル変更を監視）
npm run test:watch

# カバレッジレポート付きで実行
npm run test:coverage

# CI環境用（並列実行制限付き）
npm run test:ci

# 特定のテストファイルのみ実行
npm test -- src/__tests__/telegram.test.ts

# 特定のテストスイートのみ実行
npm test -- --testNamePattern="TelegramNotifier"
```

## 📝 テストの書き方

### 基本的なテスト構造

```typescript
// 必要なインポート（@jest/globalsから）
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// テスト対象のモジュール（.js拡張子必須）
import { YourModule } from '../your-module.js';

describe('YourModule', () => {
  // セットアップ
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // テストケース
  it('should perform expected behavior', () => {
    const result = YourModule.doSomething();
    expect(result).toBe(expectedValue);
  });

  // 非同期テスト
  it('should handle async operations', async () => {
    const result = await YourModule.doAsync();
    expect(result).toBeDefined();
  });
});
```

### ESMでのモック作成

#### 基本的なモックパターン

```typescript
import { jest } from '@jest/globals';

// 1. モック関数を定義
const mockSendMessage = jest.fn<() => Promise<void>>();
const mockGetMe = jest.fn<() => Promise<any>>();

// 2. モジュールをモック（unstable_mockModuleを使用）
jest.unstable_mockModule('telegraf', () => ({
  Telegraf: jest.fn(() => ({
    telegram: {
      sendMessage: mockSendMessage,
      getMe: mockGetMe,
    },
  })),
}));

// 3. モックの後で動的インポート（重要！）
const { TelegramNotifier } = await import('../telegram.js');

describe('TelegramNotifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // モックのデフォルト動作を設定
    mockSendMessage.mockResolvedValue(undefined);
    mockGetMe.mockResolvedValue({ id: 1, username: 'test_bot' });
  });

  it('should send message', async () => {
    const notifier = new TelegramNotifier('token', 'chatId');
    await notifier.sendMessage('test');
    
    expect(mockSendMessage).toHaveBeenCalledWith(
      'chatId',
      'test',
      expect.any(Object)
    );
  });
});
```

#### ファイルシステムのモック

```typescript
// __mocks__/fs.js
import { jest } from '@jest/globals';

export const readFileSync = jest.fn();
export const writeFileSync = jest.fn();
export const existsSync = jest.fn();

export default {
  readFileSync,
  writeFileSync,
  existsSync,
};
```

### 非同期処理のテスト

```typescript
describe('Async Operations', () => {
  // Promise を返す
  it('should handle promises', async () => {
    const result = await asyncFunction();
    expect(result).toBe('expected');
  });

  // エラーのテスト
  it('should handle errors', async () => {
    const asyncError = async () => {
      throw new Error('Test error');
    };
    
    await expect(asyncError()).rejects.toThrow('Test error');
  });

  // タイムアウトの設定（デフォルト: 5000ms）
  it('should complete within timeout', async () => {
    const result = await longRunningOperation();
    expect(result).toBeDefined();
  }, 10000); // 10秒のタイムアウト
});
```

## 🔧 テスト環境の設定

### jest.config.mjs

```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        target: 'ES2022',
      },
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
```

### テストセットアップファイル

```typescript
// src/__tests__/setup.ts
import { jest } from '@jest/globals';

// グローバルなテスト設定
beforeAll(() => {
  // テスト環境のセットアップ
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // クリーンアップ
  jest.clearAllMocks();
});

// グローバルなタイムアウト設定
jest.setTimeout(10000);
```

## 📊 カバレッジレポート

### カバレッジの確認

```bash
# カバレッジレポートの生成
npm run test:coverage

# HTMLレポートを開く
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### カバレッジの基準

```javascript
// jest.config.mjs に設定
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
},
```

## 🐛 デバッグ

### テストのデバッグ

```bash
# Node.jsデバッガーを使用
node --inspect-brk --experimental-vm-modules \
  node_modules/.bin/jest --runInBand

# VS Codeでのデバッグ設定（.vscode/launch.json）
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "runtimeArgs": [
    "--experimental-vm-modules"
  ],
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### よくあるテストエラーと解決方法

#### 1. モジュールが見つからない

**エラー**: `Cannot find module '../module.js'`

**解決方法**:
- インポート時に`.js`拡張子を付ける
- パスが正しいか確認

#### 2. モックが効かない

**エラー**: モックした関数が実際の関数を呼び出してしまう

**解決方法**:
```typescript
// ❌ 間違い: インポートが先
import { Module } from '../module.js';
jest.unstable_mockModule('../module.js', ...);

// ✅ 正しい: モックが先
jest.unstable_mockModule('../module.js', ...);
const { Module } = await import('../module.js');
```

#### 3. タイムアウトエラー

**エラー**: `Exceeded timeout of 5000 ms`

**解決方法**:
```typescript
// テストごとにタイムアウトを設定
it('long running test', async () => {
  // テストコード
}, 30000); // 30秒

// または全体で設定
jest.setTimeout(30000);
```

#### 4. 非同期処理が終わらない

**解決方法**:
```typescript
// すべてのPromiseをawaitする
it('should wait for all promises', async () => {
  const promise1 = asyncOp1();
  const promise2 = asyncOp2();
  
  await Promise.all([promise1, promise2]);
  
  expect(result).toBeDefined();
});
```

## 📝 ベストプラクティス

### 1. テストの独立性を保つ
- 各テストは他のテストに依存しない
- `beforeEach`で初期化、`afterEach`でクリーンアップ

### 2. 明確なテスト名
```typescript
// ✅ 良い例
it('should return error when URL is invalid', ...);

// ❌ 悪い例
it('test error', ...);
```

### 3. AAA パターン
```typescript
it('should calculate total', () => {
  // Arrange（準備）
  const items = [{ price: 100 }, { price: 200 }];
  
  // Act（実行）
  const total = calculateTotal(items);
  
  // Assert（検証）
  expect(total).toBe(300);
});
```

### 4. モックは必要最小限に
- 外部依存（API、ファイルシステム等）のみモック
- ビジネスロジックはモックしない

### 5. エラーケースも必ずテスト
```typescript
describe('Error handling', () => {
  it('should handle network errors', async () => {
    mockAxios.get.mockRejectedValue(new Error('Network error'));
    
    await expect(fetchData()).rejects.toThrow('Network error');
  });
});
```

## 🔗 参考リンク

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Jest ESM Support](https://jestjs.io/docs/ecmascript-modules)
- [Testing Library](https://testing-library.com/)
- [TypeScript Testing](https://www.typescriptlang.org/docs/handbook/testing.html)