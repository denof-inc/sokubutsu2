# 🍎 Mac環境での本番同等テスト実行ガイド

## 🎯 Phase 2: Mac環境での本番同等テスト

### **実行手順（推定時間: 1-2時間）**

## Step 1: 環境準備（15分）

### **1.1 リポジトリクローン**
```bash
# Mac環境で実行
git clone https://github.com/denof-inc/sokubutsu2.git
cd sokubutsu2

# 最新版確認
git status
git log --oneline -3
```

### **1.2 依存関係インストール**
```bash
# Node.js環境確認
node --version  # v18以上推奨
npm --version

# 依存関係インストール
npm install

# ビルド確認
npm run build
```

## Step 2: Telegram Bot設定（15分）

### **2.1 Telegram Bot作成**
1. Telegramで[@BotFather](https://t.me/BotFather)にアクセス
2. `/newbot`コマンドでBot作成
3. Bot名とユーザー名を設定
4. **Bot Token**を取得・保存

### **2.2 Chat ID取得**
```bash
# 1. 作成したBotに何かメッセージを送信
# 2. 以下のURLにアクセス（BOT_TOKENを置き換え）
https://api.telegram.org/bot<BOT_TOKEN>/getUpdates

# 3. レスポンスから"chat":{"id":123456789}を確認
# 4. Chat IDを保存
```

## Step 3: 環境変数設定（10分）

### **3.1 .envファイル作成**
```bash
# .env.exampleをコピー
cp .env.example .env

# .envファイルを編集
nano .env  # またはお好みのエディタ
```

### **3.2 本番同等設定**
```bash
# Telegram設定（実際の値に置き換え）
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789
TELEGRAM_ENABLED=true

# 監視設定（athome.co.jp広島）
MONITORING_URLS="https://www.athome.co.jp/chintai/hiroshima/list/?pref=34&basic=kp401,kp522,kt201,kf201,ke001,kn001,kj001&tsubo=0&tanka=0&kod=&q=1&sort=33&limit=30"
MONITORING_INTERVAL="*/5 * * * *"

# 本番設定
NODE_ENV=production
PORT=3000
DATA_DIR=./data

# マルチユーザー設定（初回はfalse）
MULTI_USER_MODE=false

# 管理機能
ADMIN_ENABLED=true
ADMIN_PORT=3001

# データベース
DATABASE_PATH=./data/sokubutsu.db
DATABASE_LOGGING=false

# ログ設定
LOG_LEVEL=info
```

## Step 4: シングルユーザーモードテスト（20分）

### **4.1 開発モードでの動作確認**
```bash
# 開発モードで起動
npm run start:dev

# 確認項目:
# ✅ 正常起動メッセージ
# ✅ Telegram接続成功
# ✅ athome.co.jp接続成功
# ✅ 5分間隔での監視開始
# ✅ 初回Telegram通知受信

# Ctrl+Cで停止
```

### **4.2 本番モードでの動作確認**
```bash
# 本番ビルド
npm run build

# 本番モードで起動
npm start

# 確認項目:
# ✅ 本番環境での正常起動
# ✅ データ永続化確認（./dataディレクトリ）
# ✅ ログ出力確認（./logsディレクトリ）
# ✅ 統計情報の保存確認

# Ctrl+Cで停止
```

## Step 5: Docker環境テスト（20分）

### **5.1 Docker環境確認**
```bash
# Docker確認
docker --version
docker-compose --version

# Dockerイメージビルド
npm run docker:build
```

### **5.2 Docker Composeでの起動**
```bash
# Docker Composeで起動
npm run docker:run

# 確認項目:
# ✅ コンテナ正常起動
# ✅ ログ出力確認
docker-compose logs -f

# ✅ データ永続化確認
ls -la data/

# ✅ Telegram通知確認
# ✅ 5分間隔での監視動作確認
```

### **5.3 管理画面確認**
```bash
# 管理画面アクセス（Docker環境）
open http://localhost:3001

# 確認項目:
# ✅ 管理画面表示
# ✅ ダッシュボード機能
# ✅ 統計情報表示

# Docker環境での注意事項:
# - ポート3001が正しくマッピングされている
# - ADMIN_ENABLED=trueが設定されている
# - ADMIN_PORT=3001が設定されている
```

## Step 6: マルチユーザーモードテスト（20分）

### **6.1 マルチユーザーモード設定**
```bash
# .envファイル編集
MULTI_USER_MODE=true

# Docker再起動
docker-compose restart
```

### **6.2 Telegramコマンドテスト**
```bash
# Telegramで以下のコマンドをテスト:
/start      # ユーザー登録
/register   # URL登録
/list       # URL一覧
/status     # 監視状況
/help       # ヘルプ表示

# 確認項目:
# ✅ 全コマンド正常動作
# ✅ ユーザー登録機能
# ✅ URL登録・管理機能
# ✅ 監視状況表示
```

## Step 7: 長時間稼働テスト（30分）

### **7.1 連続稼働確認**
```bash
# 30分間の連続稼働
# 確認項目:
# ✅ メモリリーク無し
# ✅ CPU使用率安定
# ✅ 定期的な監視実行
# ✅ エラー無し
# ✅ Telegram通知正常

# リソース監視
docker stats
```

### **7.2 エラーハンドリング確認**
```bash
# 意図的なエラー発生テスト:
# 1. ネットワーク切断
# 2. 不正URL設定
# 3. Telegram接続エラー

# 確認項目:
# ✅ 適切なエラーハンドリング
# ✅ 自動復旧機能
# ✅ エラー通知機能
```

## 🎯 成功判定基準

### **Phase 2完了基準**
- ✅ シングルユーザーモード正常動作
- ✅ マルチユーザーモード正常動作
- ✅ Docker環境での安定稼働
- ✅ Telegram通知機能完全動作
- ✅ athome.co.jp監視機能正常
- ✅ 管理画面アクセス可能
- ✅ 30分間連続稼働成功
- ✅ エラーハンドリング適切

### **Phase 2完了後の状態**
- 🎉 **本番稼働準備完了**
- 🎉 **全機能動作確認済み**
- 🎉 **WSL環境移行準備完了**

## 🚨 トラブルシューティング

### **よくある問題と解決策**

#### **1. npm install失敗**
```bash
# Node.jsバージョン確認
node --version  # v18以上必要

# キャッシュクリア
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### **2. Telegram接続エラー**
```bash
# Bot Token確認
curl "https://api.telegram.org/bot<BOT_TOKEN>/getMe"

# Chat ID確認
curl "https://api.telegram.org/bot<BOT_TOKEN>/getUpdates"
```

#### **3. Docker起動エラー**
```bash
# ポート確認
lsof -i :3000
lsof -i :3001

# Docker環境リセット
docker-compose down
docker system prune -f
npm run docker:build
npm run docker:run
```

#### **4. athome.co.jp接続エラー**
```bash
# URL確認
curl -I "https://www.athome.co.jp/chintai/hiroshima/list/"

# User-Agent設定確認
# src/scraper.tsのUser-Agent設定を確認
```

## 📊 次のステップ

Phase 2完了後:
1. **Phase 3準備**: WSL環境移行計画
2. **本番設定**: 実際の本番環境変数準備
3. **運用計画**: 監視・保守体制確立

**Mac環境での完璧なテストにより、本番稼働の成功が保証されます！**

