import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';

jest.mock('better-sqlite3');
jest.mock('fs');

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      pragma: jest.fn(),
      exec: jest.fn(),
      prepare: jest.fn(),
      close: jest.fn(),
      transaction: jest.fn(),
    };

    const Database = require('better-sqlite3');
    Database.mockReturnValue(mockDb);

    const fs = require('fs');
    fs.readFileSync.mockReturnValue('CREATE TABLE test;');

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
    await service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('データベース接続を確立し、スキーマを初期化すること', () => {
      const Database = require('better-sqlite3');
      const fs = require('fs');

      expect(Database).toHaveBeenCalledWith(
        expect.stringContaining('sokubutsu.sqlite'),
      );
      expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('schema.sql'),
        'utf8',
      );
      expect(mockDb.exec).toHaveBeenCalledWith('CREATE TABLE test;');
    });
  });

  describe('onModuleDestroy', () => {
    it('データベース接続を閉じること', () => {
      service.onModuleDestroy();
      expect(mockDb.close).toHaveBeenCalled();
    });
  });

  describe('query', () => {
    it('複数の結果を返すこと', () => {
      const mockStmt = {
        all: jest.fn().mockReturnValue([{ id: 1 }, { id: 2 }]),
      };
      mockDb.prepare.mockReturnValue(mockStmt as any);

      const result = service.query('SELECT * FROM test WHERE active = ?', [
        true,
      ]);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM test WHERE active = ?',
      );
      expect(mockStmt.all).toHaveBeenCalledWith(true);
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('findOne', () => {
    it('単一の結果を返すこと', () => {
      const mockStmt = {
        get: jest.fn().mockReturnValue({ id: 1, name: 'test' }),
      };
      mockDb.prepare.mockReturnValue(mockStmt as any);

      const result = service.findOne('SELECT * FROM test WHERE id = ?', [1]);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM test WHERE id = ?',
      );
      expect(mockStmt.get).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('結果がない場合はundefinedを返すこと', () => {
      const mockStmt = {
        get: jest.fn().mockReturnValue(undefined),
      };
      mockDb.prepare.mockReturnValue(mockStmt as any);

      const result = service.findOne('SELECT * FROM test WHERE id = ?', [999]);

      expect(result).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('INSERT/UPDATE/DELETE操作を実行すること', () => {
      const mockRunResult = { changes: 1, lastInsertRowid: 123 };
      const mockStmt = {
        run: jest.fn().mockReturnValue(mockRunResult),
      };
      mockDb.prepare.mockReturnValue(mockStmt as any);

      const result = service.execute('INSERT INTO test (name) VALUES (?)', [
        'test',
      ]);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO test (name) VALUES (?)',
      );
      expect(mockStmt.run).toHaveBeenCalledWith('test');
      expect(result).toEqual(mockRunResult);
    });
  });

  describe('transaction', () => {
    it('トランザクション内で関数を実行すること', () => {
      const mockFn = jest.fn().mockReturnValue('result');
      const mockTransaction = jest.fn().mockReturnValue('result');
      mockDb.transaction.mockReturnValue(mockTransaction as any);

      const result = service.transaction(mockFn);

      expect(mockDb.transaction).toHaveBeenCalledWith(mockFn);
      expect(mockTransaction).toHaveBeenCalled();
      expect(result).toBe('result');
    });
  });
});
