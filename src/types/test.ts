/**
 * テスト用の型定義
 */

export interface MockCall<T extends unknown[]> {
  args: T;
  result?: unknown;
}

export interface SafeMock<T> {
  mock: {
    calls: T[][];
    instances: T[];
    results: { type: 'return' | 'throw'; value: unknown }[];
  };
}

export type SafeMockFunction<T extends (...args: unknown[]) => unknown> = 
  jest.MockedFunction<T> & SafeMock<Parameters<T>>;

// Jest Mock結果の型定義
export interface MockResult<T> {
  type: 'return' | 'throw';
  value: T;
}

// 型安全なモックインスタンス取得用ヘルパー型
export type SafeMockInstance<T> = T extends new (...args: unknown[]) => infer R ? R : never;

// 型ガード関数
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export function isNotEmpty<T>(array: T[] | undefined | null): array is T[] {
  return array !== undefined && array !== null && array.length > 0;
}