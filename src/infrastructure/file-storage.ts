/**
 * ファイルストレージの抽象化
 *
 * @設計ドキュメント
 * - docs/データ永続化.md: JSONストレージ設計
 *
 * @関連クラス
 * - HashRepository: ハッシュ値の永続化で使用
 * - StatisticsRepository: 統計情報の永続化で使用
 * - vibeLogger: ファイル操作のログ出力
 */

import * as fs from 'fs';
import * as path from 'path';
import { vibeLogger } from '../utils/logger';
import { formatError } from '../utils/error-handler';

export interface IFileStorage {
  /**
   * データを読み込む
   */
  read<T>(filename: string): T | null;

  /**
   * データを書き込む
   */
  write<T>(filename: string, data: T): void;

  /**
   * ファイルが存在するか確認
   */
  exists(filename: string): boolean;

  /**
   * バックアップを作成
   */
  createBackup<T>(filename: string, data: T): string;
}

export class FileStorage implements IFileStorage {
  constructor(private readonly dataDir: string) {
    this.ensureDataDirectory();
  }

  /**
   * データディレクトリの存在確認・作成
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      vibeLogger.info('file_storage.directory_created', 'データディレクトリを作成', {
        context: { dataDir: this.dataDir },
      });
    }
  }

  /**
   * データを読み込む
   */
  read<T>(filename: string): T | null {
    const filepath = path.join(this.dataDir, filename);

    try {
      if (fs.existsSync(filepath)) {
        const content = fs.readFileSync(filepath, 'utf8');
        const data = JSON.parse(content) as T;

        vibeLogger.debug('file_storage.read_success', 'ファイル読み込み成功', {
          context: { filename, filepath },
        });

        return data;
      }

      vibeLogger.debug('file_storage.file_not_found', 'ファイルが存在しません', {
        context: { filename, filepath },
      });

      return null;
    } catch (error) {
      vibeLogger.error('file_storage.read_error', 'ファイル読み込みエラー', {
        context: {
          filename,
          filepath,
          error: formatError(error),
        },
        aiTodo: 'ファイル読み込みエラーの原因を分析',
      });

      return null;
    }
  }

  /**
   * データを書き込む
   */
  write<T>(filename: string, data: T): void {
    const filepath = path.join(this.dataDir, filename);

    try {
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

      vibeLogger.debug('file_storage.write_success', 'ファイル書き込み成功', {
        context: { filename, filepath },
      });
    } catch (error) {
      vibeLogger.error('file_storage.write_error', 'ファイル書き込みエラー', {
        context: {
          filename,
          filepath,
          error: formatError(error),
        },
        aiTodo: 'ファイル書き込みエラーの原因を分析',
      });

      // エラーを投げずにログに記録
    }
  }

  /**
   * ファイルが存在するか確認
   */
  exists(filename: string): boolean {
    const filepath = path.join(this.dataDir, filename);
    return fs.existsSync(filepath);
  }

  /**
   * バックアップを作成
   */
  createBackup<T>(filename: string, data: T): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.dataDir, 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const basename = path.basename(filename, path.extname(filename));
    const backupFilename = `${basename}-${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFilename);

    const backupData = {
      originalFile: filename,
      data,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    vibeLogger.info('file_storage.backup_created', 'バックアップ作成', {
      context: {
        originalFile: filename,
        backupPath,
      },
      humanNote: 'データのバックアップが作成されました',
    });

    return backupPath;
  }
}
