/**
 * テスト用の型定義
 */

import type { User } from '../entities/User.js';
import type { UserUrl } from '../entities/UserUrl.js';

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

// 指示書で定義された型
export interface MockUser extends User {
  id: string;
  telegramChatId: string;
  isActive: boolean;
  registeredAt: Date;
  updatedAt: Date;
  urls: UserUrl[];
}

export interface MockUserUrl extends UserUrl {
  id: string;
  name: string;
  url: string;
  prefecture: string;
  isActive: boolean;
  userId: string;
  user: User;
  createdAt: Date;
  updatedAt: Date;
}

export type MockTelegramNotifier = {
  sendMessage: jest.MockedFunction<(message: string) => Promise<void>>;
  sendNewListingNotification: jest.MockedFunction<(properties: any[], count: number) => Promise<void>>;
  sendErrorAlert: jest.MockedFunction<(error: Error, context: string) => Promise<void>>;
  sendStatisticsReport: jest.MockedFunction<(stats: any) => Promise<void>>;
  testConnection: jest.MockedFunction<() => Promise<boolean>>;
  getBotInfo: jest.MockedFunction<() => Promise<{ username: string }>>;
};

export type MockRepository<T> = {
  find: jest.MockedFunction<(options?: any) => Promise<T[]>>;
  findOne: jest.MockedFunction<(options: any) => Promise<T | null>>;
  save: jest.MockedFunction<(entity: T | T[]) => Promise<T | T[]>>;
  create: jest.MockedFunction<(entityLike?: any) => T>;
  remove: jest.MockedFunction<(entity: T | T[]) => Promise<T | T[]>>;
};

export function createMockRepository<T>(): MockRepository<T> {
  return {
    find: jest.fn() as jest.MockedFunction<(options?: any) => Promise<T[]>>,
    findOne: jest.fn() as jest.MockedFunction<(options: any) => Promise<T | null>>,
    save: jest.fn() as jest.MockedFunction<(entity: T | T[]) => Promise<T | T[]>>,
    create: jest.fn() as jest.MockedFunction<(entityLike?: any) => T>,
    remove: jest.fn() as jest.MockedFunction<(entity: T | T[]) => Promise<T | T[]>>,
  };
}