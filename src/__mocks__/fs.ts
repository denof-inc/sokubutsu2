import { jest } from '@jest/globals';

// fsモジュールのモック実装
const existsSync = jest.fn();
const readFileSync = jest.fn();
const writeFileSync = jest.fn();
const mkdirSync = jest.fn();
const readdirSync = jest.fn();
const statSync = jest.fn();
const unlinkSync = jest.fn();
const rmdirSync = jest.fn();
const copyFileSync = jest.fn();
const renameSync = jest.fn();

export {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmdirSync,
  copyFileSync,
  renameSync,
};

// promises API
export const promises = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  rmdir: jest.fn(),
  copyFile: jest.fn(),
  rename: jest.fn(),
};

// デフォルトエクスポート
const fs = {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmdirSync,
  copyFileSync,
  renameSync,
  promises,
};

export default fs;
