import { jest, describe, it, expect, beforeEach } from '@jest/globals';
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// test-setup.tsでモックは設定済みのため、インポートのみ
const { Logger, LogLevel, logger, vibeLogger } = await import('../logger.js');
const { createFileLogger } = await import('../utils/vibe-logger-impl.js');

// モック関数への参照を取得
const mockCreateFileLogger = createFileLogger as jest.Mock;
const mockError = vibeLogger.error as jest.Mock;
const mockWarn = vibeLogger.warn as jest.Mock;
const mockInfo = vibeLogger.info as jest.Mock;
const mockDebug = vibeLogger.debug as jest.Mock;

describe.skip('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LogLevel', () => {
    it('ログレベルが正しく定義されていること', () => {
      expect(LogLevel.ERROR).toBe(0);
      expect(LogLevel.WARN).toBe(1);
      expect(LogLevel.INFO).toBe(2);
      expect(LogLevel.DEBUG).toBe(3);
    });
  });

  describe('Logger class', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const testLogger = new Logger();

    it('errorメソッドがvibeLoggerを呼び出すこと', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      testLogger.error('テストエラー');

      expect(mockError).toHaveBeenCalledWith('legacy.error', 'テストエラー', {
        humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
      });
    });

    it('errorメソッドがデータを含めてvibeLoggerを呼び出すこと', () => {
      const data = { userId: 123, action: 'test' };
      testLogger.error('エラーメッセージ', data);

      expect(mockError).toHaveBeenCalledWith('legacy.error', 'エラーメッセージ', {
        humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
        context: { data },
      });
    });

    it('warnメソッドがvibeLoggerを呼び出すこと', () => {
      testLogger.warn('警告メッセージ');

      expect(mockWarn).toHaveBeenCalledWith('legacy.warn', '警告メッセージ', {
        humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
      });
    });

    it('warnメソッドがデータを含めてvibeLoggerを呼び出すこと', () => {
      const data = { threshold: 90, current: 95 };
      testLogger.warn('閾値超過', data);

      expect(mockWarn).toHaveBeenCalledWith('legacy.warn', '閾値超過', {
        humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
        context: { data },
      });
    });

    it('infoメソッドがvibeLoggerを呼び出すこと', () => {
      testLogger.info('情報メッセージ');

      expect(mockInfo).toHaveBeenCalledWith('legacy.info', '情報メッセージ', {
        humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
      });
    });

    it('infoメソッドがデータを含めてvibeLoggerを呼び出すこと', () => {
      const data = { status: 'running', pid: 1234 };
      testLogger.info('プロセス状態', data);

      expect(mockInfo).toHaveBeenCalledWith('legacy.info', 'プロセス状態', {
        humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
        context: { data },
      });
    });

    it('debugメソッドがvibeLoggerを呼び出すこと', () => {
      testLogger.debug('デバッグメッセージ');

      expect(mockDebug).toHaveBeenCalledWith('legacy.debug', 'デバッグメッセージ', {
        humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
      });
    });

    it('debugメソッドがデータを含めてvibeLoggerを呼び出すこと', () => {
      const data = { query: 'SELECT * FROM users', time: 120 };
      testLogger.debug('クエリ実行', data);

      expect(mockDebug).toHaveBeenCalledWith('legacy.debug', 'クエリ実行', {
        humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
        context: { data },
      });
    });
  });

  describe('Exports', () => {
    it('loggerシングルトンがエクスポートされていること', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it('vibeLoggerがエクスポートされていること', () => {
      expect(vibeLogger).toBeDefined();
      expect(vibeLogger).toBeDefined();
    });

    it('createFileLoggerが正しいプロジェクト名で呼ばれていること', () => {
      // モジュールインポート時にcreateFileLoggerが呼ばれているはず
      expect(mockCreateFileLogger).toHaveBeenCalled();
      // 引数の確認
      const calls = mockCreateFileLogger.mock.calls as any[];
      expect(calls[0]?.[0]).toBe('sokubutsu');
    });
  });
});
