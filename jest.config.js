module.exports = {
  // 基本設定
  preset: 'ts-jest',
  testEnvironment: 'node',

  // ルートディレクトリ
  roots: ['<rootDir>/src'],

  // テストファイルのパターン
  testRegex: '.*\\.spec\\.ts$',

  // 変換設定
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // モジュール拡張子
  moduleFileExtensions: ['js', 'json', 'ts'],

  // カバレッジ設定
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  // モジュール名マッピング
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  // テストタイムアウト
  testTimeout: 30000,

  // 並列実行設定
  maxWorkers: process.env.CI ? 1 : '50%',

  // キャッシュ設定
  cache: !process.env.CI,
  cacheDirectory: '<rootDir>/.jest-cache',

  // 詳細出力
  verbose: true,

  // エラー時の詳細表示
  errorOnDeprecated: true,

  // CI/CD専用設定
  ...(process.env.CI && {
    maxWorkers: 1,
    forceExit: true,
    detectOpenHandles: true,
    verbose: true,
    bail: false,
    silent: false,
  }),

  // グローバル設定
  globals: {
    'ts-jest': {
      tsconfig: {
        // テスト用のTypeScript設定オーバーライド
        strict: false,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
      },
    },
  },
};
