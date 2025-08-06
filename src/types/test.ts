/**
 * テスト用の型定義
 */

import type { User } from '../entities/User.js';
import type { UserUrl } from '../entities/UserUrl.js';
import type { Statistics } from '../types.js';

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

export interface PropertyData {
  title: string;
  price: string;
  location: string;
  url: string;
  detectedAt: string;
}

export interface MockTelegramNotifier {
  sendMessage: jest.MockedFunction<(message: string) => Promise<void>>;
  sendNewListingNotification: jest.MockedFunction<(properties: PropertyData[], count: number) => Promise<void>>;
  sendErrorAlert: jest.MockedFunction<(error: Error, context: string) => Promise<void>>;
  sendStatisticsReport: jest.MockedFunction<(stats: Statistics) => Promise<void>>;
  testConnection: jest.MockedFunction<() => Promise<boolean>>;
  getBotInfo: jest.MockedFunction<() => Promise<{ username: string }>>;
  sendStartupNotice: jest.MockedFunction<() => Promise<void>>;
  sendShutdownNotice: jest.MockedFunction<() => Promise<void>>;
}

export interface MockUserService {
  getUserUrls: jest.MockedFunction<(userId: string) => Promise<UserUrl[]>>;
  getUserById: jest.MockedFunction<(userId: string) => Promise<User | null>>;
}

export interface FindOptions {
  where?: Record<string, unknown>;
  relations?: string[];
  order?: Record<string, 'ASC' | 'DESC'>;
}

export type MockRepository<T> = {
  find: jest.MockedFunction<(options?: FindOptions) => Promise<T[]>>;
  findOne: jest.MockedFunction<(options: FindOptions) => Promise<T | null>>;
  save: jest.MockedFunction<(entity: T | T[]) => Promise<T | T[]>>;
  create: jest.MockedFunction<(entityLike?: Partial<T>) => T>;
  remove: jest.MockedFunction<(entity: T | T[]) => Promise<T | T[]>>;
};

export function createMockRepository<T>(): MockRepository<T> {
  return {
    find: jest.fn() as jest.MockedFunction<(options?: FindOptions) => Promise<T[]>>,
    findOne: jest.fn() as jest.MockedFunction<(options: FindOptions) => Promise<T | null>>,
    save: jest.fn() as jest.MockedFunction<(entity: T | T[]) => Promise<T | T[]>>,
    create: jest.fn() as jest.MockedFunction<(entityLike?: Partial<T>) => T>,
    remove: jest.fn() as jest.MockedFunction<(entity: T | T[]) => Promise<T | T[]>>,
  };
}