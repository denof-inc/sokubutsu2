import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { UserUrl } from '../entities/UserUrl.js';
import { config } from '../config.js';
import { vibeLogger } from '../logger.js';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: config.database?.database || `${config.storage.dataDir}/sokubutsu.db`,
  entities: [User, UserUrl],
  synchronize: config.database?.synchronize ?? true,
  logging: config.database?.logging ?? config.app.env === 'development',
});

export async function initializeDatabase(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ データベース接続完了');
      vibeLogger.info('database.initialized', 'データベース接続完了', {
        context: {
          database: config.database?.database || `${config.storage.dataDir}/sokubutsu.db`,
          entities: ['User', 'UserUrl'],
          synchronize: config.database?.synchronize ?? true,
        },
        humanNote: 'TypeORM + SQLiteデータベースの初期化成功',
      });
    }
  } catch (error) {
    console.error('❌ データベース接続エラー:', error);
    vibeLogger.error('database.initialization_failed', 'データベース接続エラー', {
      context: { error },
      humanNote: 'データベース初期化に失敗しました',
    });
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      vibeLogger.info('database.closed', 'データベース接続終了', {
        humanNote: 'データベース接続を正常に終了しました',
      });
    }
  } catch (error) {
    vibeLogger.error('database.close_failed', 'データベース接続終了失敗', {
      context: { error },
    });
  }
}
