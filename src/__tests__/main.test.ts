import { describe, it, expect } from '@jest/globals';

describe('Main - Simple', () => {
  it('環境変数の確認', () => {
    // 現在の環境変数を確認するだけのシンプルなテスト
    expect(process.env).toBeDefined();
    expect(typeof process.env).toBe('object');
  });

  it('Node.jsバージョンの確認', () => {
    // Node.jsのバージョンが存在することを確認
    expect(process.version).toBeDefined();
    expect(process.version).toMatch(/^v\d+\.\d+\.\d+/);
  });
});
