import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: Database.Database;

  onModuleInit() {
    const dbPath = path.join(process.cwd(), 'sokubutsu.sqlite');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.logger.log('Database connection successfully established.');
    this.initializeDatabase();
  }

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
      this.logger.log('Database connection closed.');
    }
  }

  private initializeDatabase() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    try {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(schema);
      this.logger.log('Database schema initialized.');
    } catch (error) {
      this.logger.error('Failed to initialize database schema:', error);
    }
  }

  query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  findOne<T = any>(sql: string, params: any[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  execute(sql: string, params: any[] = []): Database.RunResult {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }
}