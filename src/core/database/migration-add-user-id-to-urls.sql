-- URLテーブルにuser_idカラムを追加し、IDをUUIDに変換するマイグレーション

-- 1. 新しいテーブル構造を作成 (IDとuser_idをTEXT型に)
CREATE TABLE IF NOT EXISTS urls_new (
  id TEXT PRIMARY KEY, -- UUIDを格納するためTEXT型に変更
  user_id TEXT NOT NULL, -- UUIDを格納するためTEXT型に変更
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  selector TEXT NOT NULL DEFAULT '#item-list',
  content_hash TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, url),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. 既存のデータを移行 (IDをUUIDに変換し、user_idに仮のUUIDを割り当て)
-- 注意: 既存のuser_idが数値型の場合、対応するUUIDにマッピングする必要があります。
-- ここでは仮のUUID '00000000-0000-0000-0000-000000000001' を使用します。
-- 実際の運用では、既存ユーザーのUUIDを適切に取得して設定してください。
INSERT INTO urls_new (id, user_id, name, url, selector, content_hash, is_active, created_at, updated_at)
SELECT
  printf('%s%s%s%s-%s%s-%s%s-%s%s-%s%s%s%s%s%s',
         substr(hex(randomblob(4)),1,8), substr(hex(randomblob(2)),1,4),
         substr(hex(randomblob(2)),1,4), substr(hex(randomblob(2)),1,4),
         substr(hex(randomblob(6)),1,12)) AS uuid, -- 新しいUUIDを生成
  '00000000-0000-0000-0000-000000000001', -- 仮のuser_id UUID
  name, url, selector, content_hash, is_active, created_at, updated_at
FROM urls;

-- 3. 古いテーブルを削除
DROP TABLE urls;

-- 4. 新しいテーブルをリネーム
ALTER TABLE urls_new RENAME TO urls;

-- 5. updated_atの自動更新用トリガーを再作成
CREATE TRIGGER IF NOT EXISTS update_urls_updated_at 
AFTER UPDATE ON urls
BEGIN
  UPDATE urls SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 6. インデックスを作成
CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id);
CREATE INDEX IF NOT EXISTS idx_urls_is_active ON urls(is_active);
