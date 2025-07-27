import { SimpleStorage } from '../storage';
import * as fs from 'fs';

// fs をモック化
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('SimpleStorage', () => {
  let storage: SimpleStorage;

  beforeEach(() => {
    jest.clearAllMocks();

    // ディレクトリ存在チェックをモック
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('{}');
    mockedFs.writeFileSync.mockImplementation(() => {});
    mockedFs.mkdirSync.mockImplementation(() => '');

    storage = new SimpleStorage();
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
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });
});
