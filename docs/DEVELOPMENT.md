# 開発ガイド

## 🚀 開発環境のセットアップ

### 必要要件
- Node.js 18.0.0以上（ESMサポートのため）
- npm 8.0.0以上
- TypeScript 5.0.0以上

### 初期セットアップ
```bash
# リポジトリのクローン
git clone <repository-url>
cd sokubutsu-mvp

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して必要な値を設定

# 開発モードで起動
npm run start:dev
```

## 📦 モジュールシステム

このプロジェクトは**完全にESM（ECMAScript Modules）**で実装されています。

### ESMの基本ルール

1. **すべてのインポートに拡張子を付ける**
```typescript
// ✅ 正しい
import { Config } from './config.js';
import { TelegramNotifier } from './telegram.js';

// ❌ 間違い（拡張子なし）
import { Config } from './config';
```

2. **package.jsonの設定**
```json
{
  "type": "module"  // ESMを有効化
}
```

3. **TypeScriptの設定**
```json
{
  "compilerOptions": {
    "module": "ES2022",
    "target": "ES2022",
    "moduleResolution": "node"
  }
}
```

## 🧪 テスト開発

### Jest + ESMの設定

このプロジェクトではJestをESM環境で使用しています。

#### テストファイルの基本構造
```typescript
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { YourModule } from '../your-module.js';  // 拡張子必須

describe('YourModule', () => {
  it('should work correctly', () => {
    // テストコード
  });
});
```

#### モックの作成方法

**ESMでのモック（jest.unstable_mockModule使用）**
```typescript
import { jest } from '@jest/globals';

// モック関数を先に定義
const mockFunction = jest.fn<() => Promise<any>>();

// モジュールをモック
jest.unstable_mockModule('module-name', () => ({
  exportedFunction: mockFunction
}));

// モックの後でインポート（動的インポート必須）
const { ModuleToTest } = await import('../module-to-test.js');
```

**重要な注意点：**
- `jest.unstable_mockModule`は`import`より前に配置
- モックしたモジュールは動的インポート（`await import()`）で読み込む
- すべてのjest関数は`@jest/globals`からインポート

### テスト実行コマンド
```bash
# 単一テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジ付き
npm run test:coverage

# 特定のテストファイルのみ
npm test -- src/__tests__/specific.test.ts
```

## 🔍 型定義

### TypeScript Strict Mode

このプロジェクトはTypeScriptのstrict modeを有効にしています。

#### 型安全性のルール
- `any`型の使用禁止
- nullチェックの強制
- 未使用変数の警告

#### 型定義の例
```typescript
// types.ts
export interface UrlStatistics {
  url: string;
  totalChecks: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  averageExecutionTime: number;
  hasNewProperty: boolean;
  newPropertyCount: number;
  lastNewProperty: Date | null;
}

// 使用例
import { UrlStatistics } from './types.js';

function processStats(stats: UrlStatistics): void {
  // 型安全なコード
}
```

## 📝 コーディング規約

### インポート順序
1. 外部ライブラリ
2. 内部モジュール
3. 型定義

```typescript
// 外部ライブラリ
import { Telegraf } from 'telegraf';
import axios from 'axios';

// 内部モジュール
import { Config } from './config.js';
import { vibeLogger } from './logger.js';

// 型定義
import type { Statistics, NotificationData } from './types.js';
```

### ファイル命名規則
- TypeScriptファイル: `kebab-case.ts`
- テストファイル: `module-name.test.ts`
- 型定義ファイル: `types.ts`
- エンティティ: `PascalCase.ts`（TypeORM用）

### エラーハンドリング
```typescript
try {
  // 処理
} catch (error) {
  vibeLogger.error('context', 'Error message', { error });
  // 適切なフォールバック処理
}
```

## 🛠️ デバッグ

### ログの活用

vibeloggerを使用した構造化ログ：
```typescript
import { vibeLogger } from './logger.js';

// 情報ログ
vibeLogger.info('scraping', 'Started scraping', { url });

// エラーログ
vibeLogger.error('telegram', 'Failed to send message', { error });

// デバッグログ
vibeLogger.debug('storage', 'Data saved', { data });
```

ログファイルの確認：
```bash
# リアルタイムログ表示
tail -f logs/sokubutsu-*.log

# エラーログのみ抽出
grep ERROR logs/sokubutsu-*.log
```

### デバッグ実行
```bash
# Node.jsのデバッグモードで起動
node --inspect --import tsx src/main.ts

# VS Codeでのデバッグ
# launch.jsonの設定を使用
```

## 🚀 ビルドとデプロイ

### ビルドプロセス
```bash
# TypeScriptのコンパイル
npm run build

# 型チェックのみ（ビルドなし）
npm run typecheck

# 本番用ビルド
npm run build && npm prune --production
```

### 品質チェック
```bash
# すべての品質チェックを実行
npm run quality:check

# 個別実行
npm run lint:check      # ESLintチェック
npm run typecheck       # 型チェック
npm run test           # テスト実行
```

## 📚 よくある問題と解決方法

### ESM関連のエラー

**問題**: `Cannot use import statement outside a module`
**解決**: package.jsonに`"type": "module"`が設定されているか確認

**問題**: `Module not found` エラー
**解決**: インポート時に`.js`拡張子を付けているか確認

**問題**: `ReferenceError: require is not defined`
**解決**: CommonJSの`require`ではなくESMの`import`を使用

### Jest関連のエラー

**問題**: モックが正しく動作しない
**解決**: `jest.unstable_mockModule`を使用し、動的インポートにする

**問題**: タイムアウトエラー
**解決**: 非同期処理が正しくawaitされているか確認

### TypeScript関連のエラー

**問題**: 型エラーが大量に出る
**解決**: `npm run typecheck`で詳細を確認し、一つずつ修正

## 🔗 参考リンク

- [Node.js ESM Documentation](https://nodejs.org/api/esm.html)
- [TypeScript ESM Support](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Jest ESM Support](https://jestjs.io/docs/ecmascript-modules)
- [vibelogger Documentation](https://github.com/fladdict/vibe-logger)