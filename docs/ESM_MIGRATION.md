# ESMマイグレーションガイド

## 📋 概要

このドキュメントは、CommonJSからESM（ECMAScript Modules）への移行が完了したプロジェクトの現状と、新規参加者向けの注意事項をまとめています。

**現在のステータス**: ✅ **完全ESM対応完了**

## 🎯 ESM統一の背景

### なぜESMに統一したか

1. **Node.js標準への準拠**: Node.jsはESMを標準モジュールシステムとして推進
2. **TypeScriptとの親和性**: 最新のTypeScriptはESMをネイティブサポート
3. **将来性**: CommonJSは徐々に非推奨化される傾向
4. **パフォーマンス**: 静的解析によるTree Shakingが可能
5. **コードの一貫性**: import/export構文の統一

### 移行前の問題点

- CommonJSとESMが混在していた
- `require()`と`import`が混在
- Jestのモック機能がESMで正しく動作しなかった
- 型定義の不整合

## ✅ 現在の設定

### package.json
```json
{
  "type": "module",  // ESMを有効化
  "main": "dist/main.js",
  "scripts": {
    // NODE_OPTIONS で ESM モジュールを有効化
    "test": "NODE_OPTIONS='--experimental-vm-modules --no-warnings' jest"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",  // ESM出力
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

### jest.config.mjs
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
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
};
```

## 📝 コーディングルール

### 1. インポート/エクスポート

```typescript
// ✅ 正しい: 拡張子付き
import { Config } from './config.js';
import { vibeLogger } from './logger.js';
export { Config } from './config.js';

// ❌ 間違い: 拡張子なし
import { Config } from './config';

// ❌ 間違い: CommonJS構文
const config = require('./config');
module.exports = { Config };
```

### 2. 動的インポート

```typescript
// ✅ ESMの動的インポート
const { Module } = await import('./module.js');

// ❌ CommonJSのrequire
const Module = require('./module');
```

### 3. __dirname と __filename

```typescript
// ✅ ESMでの代替方法
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ❌ CommonJSの方法（ESMでは使用不可）
console.log(__dirname);  // ReferenceError
```

## 🧪 テストのESM対応

### Jestでのモック

```typescript
import { jest } from '@jest/globals';

// 1. unstable_mockModule を使用（ESM用）
jest.unstable_mockModule('module-name', () => ({
  exportedFunction: jest.fn(),
}));

// 2. 動的インポートでモジュールを読み込む
const { ModuleToTest } = await import('../module.js');

// ❌ 従来のjest.mock（ESMでは動作しない）
jest.mock('module-name');  // ESMでは効果なし
```

### モックファイルの作成

```javascript
// src/__mocks__/vibelogger.js
import { jest } from '@jest/globals';  // 必須：jestをインポート

export const createFileLogger = jest.fn(() => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
```

## ⚠️ よくある落とし穴と解決方法

### 1. "Cannot use import statement outside a module"

**原因**: `package.json`に`"type": "module"`がない

**解決**:
```json
{
  "type": "module"
}
```

### 2. "Module not found" エラー

**原因**: インポート時に拡張子がない

**解決**:
```typescript
// 拡張子を追加
import { Module } from './module.js';
```

### 3. "ReferenceError: require is not defined"

**原因**: ESM環境でCommonJSの`require`を使用

**解決**:
```typescript
// import に変更
import module from 'module-name';
```

### 4. "ReferenceError: jest is not defined"

**原因**: ESMモックファイルで`jest`がグローバルでない

**解決**:
```javascript
import { jest } from '@jest/globals';
```

### 5. Jestのモックが効かない

**原因**: `jest.mock`を使用している、または順序が間違っている

**解決**:
```typescript
// 正しい順序
jest.unstable_mockModule('module', ...);  // 先にモック
const { Module } = await import('module');  // 後でインポート
```

## 🔄 既存コードの移行チェックリスト

新しくプロジェクトに参加する場合、以下を確認してください：

- [ ] `package.json`に`"type": "module"`が設定されている
- [ ] すべてのインポートに`.js`拡張子が付いている
- [ ] `require()`や`module.exports`が使われていない
- [ ] テストファイルで`@jest/globals`からjestをインポートしている
- [ ] モックには`jest.unstable_mockModule`を使用している
- [ ] `__dirname`や`__filename`を使用していない（または適切に対処）
- [ ] 動的インポートは`await import()`を使用している

## 📚 参考資料

### 公式ドキュメント
- [Node.js ESM Documentation](https://nodejs.org/api/esm.html)
- [TypeScript ESM Support](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Jest ESM Support](https://jestjs.io/docs/ecmascript-modules)

### 移行ガイド
- [From CommonJS to ESM](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)
- [Pure ESM Package](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)

## 🎉 まとめ

このプロジェクトは完全にESMに移行済みです。新規開発時は必ずESM構文を使用し、CommonJSの混在を避けてください。不明な点があれば、このドキュメントを参照するか、既存のコードを参考にしてください。