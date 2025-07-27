// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/', 'node_modules/', '*.config.js', 'scripts/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // 段階的厳格化 - Phase 1: 全てwarnレベル（絶対にoffにしない）
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      
      // Phase 2（1ヶ月後）: これらをerrorに変更予定
      // '@typescript-eslint/no-explicit-any': 'error',
      // '@typescript-eslint/no-unused-vars': 'error',
      
      // 絶対に無効化してはならないルール
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/unbound-method': 'warn',
      
      // 基本的なルール
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      
      // NestJS固有の設定（必要最小限）
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // NestJSのモジュールクラスは空でも正常
      '@typescript-eslint/no-extraneous-class': ['error', {
        allowWithDecorator: true,
        allowEmpty: true,
      }],
    },
  },
  {
    // テストファイルでも型安全性は維持
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      // テストファイルでも最低限の型安全性を維持
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // テスト固有の緩和（最小限）
      '@typescript-eslint/unbound-method': 'off',
      // テストでのモックオブジェクト作成のためスプレッド演算子を許可
      '@typescript-eslint/no-misused-spread': 'off',
    },
  },
);