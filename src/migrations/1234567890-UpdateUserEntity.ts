import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserEntity1234567890 implements MigrationInterface {
  name = 'UpdateUserEntity1234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // SQLiteの場合の処理
    const databaseType = queryRunner.connection.options.type;

    if (databaseType === 'better-sqlite3' || databaseType === 'sqlite') {
      // SQLiteではALTER TABLEの制限があるため、新しいテーブルを作成して移行

      // 1. 新しいスキーマでテーブルを作成
      await queryRunner.query(`
        CREATE TABLE "users_new" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "telegramId" TEXT NOT NULL,
          "username" TEXT,
          "firstName" TEXT NOT NULL,
          "lastName" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT (1),
          "languageCode" TEXT,
          "settings" TEXT,
          "lastActiveAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // 2. ユニークインデックスを作成
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_users_telegramId" ON "users_new" ("telegramId")
      `);

      // 3. 既存データを移行（telegramIdを主キーとして使用していた場合）
      await queryRunner.query(`
        INSERT INTO "users_new" (
          "telegramId", "username", "firstName", "lastName", 
          "isActive", "languageCode", "settings", 
          "lastActiveAt", "createdAt", "updatedAt"
        )
        SELECT 
          "telegramId", "username", "firstName", "lastName",
          "isActive", "languageCode", "settings",
          "lastActiveAt", "createdAt", "updatedAt"
        FROM "users"
      `);

      // 4. 古いテーブルを削除
      await queryRunner.query(`DROP TABLE "users"`);

      // 5. 新しいテーブルをリネーム
      await queryRunner.query(`ALTER TABLE "users_new" RENAME TO "users"`);
    } else if (databaseType === 'postgres') {
      // PostgreSQLの場合

      // 1. id列を追加（既に存在しない場合）
      const hasIdColumn = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'id'
      `);

      if (!hasIdColumn.length) {
        await queryRunner.query(`
          ALTER TABLE "users" 
          ADD COLUMN "id" SERIAL PRIMARY KEY
        `);
      }

      // 2. telegramIdのユニーク制約を追加
      await queryRunner.query(`
        ALTER TABLE "users" 
        ADD CONSTRAINT "UQ_users_telegramId" UNIQUE ("telegramId")
      `);

      // 3. インデックスを作成
      await queryRunner.query(`
        CREATE INDEX "IDX_users_telegramId" ON "users" ("telegramId")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const databaseType = queryRunner.connection.options.type;

    if (databaseType === 'better-sqlite3' || databaseType === 'sqlite') {
      // SQLiteの場合：元のスキーマに戻す

      // 1. 元のスキーマでテーブルを作成
      await queryRunner.query(`
        CREATE TABLE "users_old" (
          "telegramId" TEXT PRIMARY KEY NOT NULL,
          "username" TEXT,
          "firstName" TEXT NOT NULL,
          "lastName" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT (1),
          "languageCode" TEXT,
          "settings" TEXT,
          "lastActiveAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // 2. データを戻す
      await queryRunner.query(`
        INSERT INTO "users_old" (
          "telegramId", "username", "firstName", "lastName",
          "isActive", "languageCode", "settings",
          "lastActiveAt", "createdAt", "updatedAt"
        )
        SELECT 
          "telegramId", "username", "firstName", "lastName",
          "isActive", "languageCode", "settings",
          "lastActiveAt", "createdAt", "updatedAt"
        FROM "users"
      `);

      // 3. 現在のテーブルを削除
      await queryRunner.query(`DROP TABLE "users"`);

      // 4. 古いテーブルをリネーム
      await queryRunner.query(`ALTER TABLE "users_old" RENAME TO "users"`);
    } else if (databaseType === 'postgres') {
      // PostgreSQLの場合

      // 1. インデックスを削除
      await queryRunner.query(`DROP INDEX "IDX_users_telegramId"`);

      // 2. ユニーク制約を削除
      await queryRunner.query(`
        ALTER TABLE "users" 
        DROP CONSTRAINT "UQ_users_telegramId"
      `);

      // 3. id列を削除（注意：データ損失の可能性）
      await queryRunner.query(`
        ALTER TABLE "users" 
        DROP COLUMN "id"
      `);

      // 4. telegramIdを主キーに戻す
      await queryRunner.query(`
        ALTER TABLE "users" 
        ADD CONSTRAINT "PK_users" PRIMARY KEY ("telegramId")
      `);
    }
  }
}
