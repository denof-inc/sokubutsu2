-- URLテーブル: 監視対象のURLを管理
CREATE TABLE IF NOT EXISTS urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  selector TEXT NOT NULL,
  content_hash TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- URLチェック履歴テーブル: 監視の実行履歴を記録
CREATE TABLE IF NOT EXISTS url_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_id INTEGER NOT NULL,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL, -- 'success', 'error', 'no_change', 'new_items'
  error_message TEXT,
  items_count INTEGER,
  FOREIGN KEY (url_id) REFERENCES urls(id)
);

-- 通知履歴テーブル: 送信した通知の記録
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'new_items', 'hourly_summary', 'error'
  message TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (url_id) REFERENCES urls(id)
);

-- updated_atの自動更新用トリガー
CREATE TRIGGER IF NOT EXISTS update_urls_updated_at 
AFTER UPDATE ON urls
BEGIN
  UPDATE urls SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;