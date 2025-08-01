import { jest, describe, it, expect, beforeEach } from '@jest/globals';
/* eslint-disable @typescript-eslint/no-var-requires */

// モック関数を作成
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockMkdirSync = jest.fn();

// vibeloggerのモック
jest.mock('vibelogger', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  return {
    createFileLogger: jest.fn(() => mockLogger),
  };
});

// fsモジュールをモック
jest.unstable_mockModule('fs', () => ({
  __esModule: true,
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

// モックの後でインポート
await import('fs');
const { SimpleStorage } = await import('../storage.js');

describe('SimpleStorage', () => {
  let storage: InstanceType<typeof SimpleStorage>;

  beforeEach(() => {
    jest.clearAllMocks();

    // ディレクトリ存在チェックをモック
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from('{}'));
    mockWriteFileSync.mockImplementation(() => {});
    mockMkdirSync.mockImplementation(() => undefined);

    storage = new SimpleStorage();
  });

  describe('初期化', () => {
    it('データディレクトリが存在しない場合は作成すること', () => {
      mockExistsSync.mockReturnValue(false);

      new SimpleStorage();

      expect(mockMkdirSync).toHaveBeenCalledWith('./test-data', { recursive: true });
    });

    it('データ読み込みエラーが発生しても継続すること', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      expect(() => new SimpleStorage()).not.toThrow();
    });
  });

  describe('ハッシュ管理', () => {
    it('ハッシュを設定・取得できること', () => {
      const url = 'https://example.com';
      const hash = 'abc123';

      storage.setHash(url, hash);
      const retrievedHash = storage.getHash(url);

      expect(retrievedHash).toBe(hash);
    });

    it('存在しないURLのハッシュはundefinedを返すこと', () => {
      const hash = storage.getHash('https://nonexistent.com');
      expect(hash).toBeUndefined();
    });
  });

  describe('統計管理', () => {
    it('チェック数を増加できること', () => {
      const initialStats = storage.getStats();
      const initialCount = initialStats.totalChecks;

      storage.incrementTotalChecks();

      const updatedStats = storage.getStats();
      expect(updatedStats.totalChecks).toBe(initialCount + 1);
    });

    it('エラー数を増加できること', () => {
      const initialStats = storage.getStats();
      const initialErrors = initialStats.errors;

      storage.incrementErrors();

      const updatedStats = storage.getStats();
      expect(updatedStats.errors).toBe(initialErrors + 1);
    });

    it('新着検知数を増加できること', () => {
      const initialStats = storage.getStats();
      const initialNewListings = initialStats.newListings;

      storage.incrementNewListings();

      const updatedStats = storage.getStats();
      expect(updatedStats.newListings).toBe(initialNewListings + 1);
    });

    it('実行時間を記録できること', () => {
      storage.incrementTotalChecks(); // 分母を1にする
      storage.recordExecutionTime(5000); // 5秒

      const stats = storage.getStats();
      expect(stats.averageExecutionTime).toBe(5);
    });

    it('成功率を正しく計算すること', () => {
      // 10回チェック、2回エラー = 80%成功率
      for (let i = 0; i < 10; i++) {
        storage.incrementTotalChecks();
      }
      storage.incrementErrors();
      storage.incrementErrors();

      const stats = storage.getStats();
      expect(stats.successRate).toBe(80);
    });
  });

  describe('バックアップ機能', () => {
    it('バックアップを作成できること', () => {
      const backupPath = storage.createBackup();

      expect(backupPath).toContain('backup-');
      expect(backupPath).toContain('.json');
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('統計リセット', () => {
    it('統計をリセットできること', () => {
      // 統計を更新
      storage.incrementTotalChecks();
      storage.incrementErrors();
      storage.incrementNewListings();
      storage.recordExecutionTime(5000);

      // リセット前の確認
      const beforeReset = storage.getStats();
      expect(beforeReset.totalChecks).toBeGreaterThan(0);
      expect(beforeReset.errors).toBeGreaterThan(0);

      // リセット
      storage.resetStats();

      // リセット後の確認
      const afterReset = storage.getStats();
      expect(afterReset.totalChecks).toBe(0);
      expect(afterReset.errors).toBe(0);
      expect(afterReset.newListings).toBe(0);
      // executionTimesは内部プロパティなので直接チェックしない
      expect(afterReset.averageExecutionTime).toBe(0);
      expect(afterReset.successRate).toBe(100);
    });
  });

  describe('統計表示', () => {
    it('統計情報を表示できること', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      storage.displayStats();

      expect(consoleSpy).toHaveBeenCalledWith('📈 統計情報:');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('総チェック数:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('エラー数:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('新着検知数:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('成功率:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('平均実行時間:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('最終チェック:'));

      consoleSpy.mockRestore();
    });
  });

  describe('データ保存エラー処理', () => {
    it('保存エラーが発生してもクラッシュしないこと', () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      // エラーが発生してもクラッシュしない
      expect(() => storage.setHash('https://example.com', 'hash123')).not.toThrow();
    });
  });

  describe('成功率計算のエッジケース', () => {
    it('チェック数が0の場合、成功率は100%を返すこと', () => {
      const stats = storage.getStats();
      expect(stats.successRate).toBe(100);
    });
  });
});
