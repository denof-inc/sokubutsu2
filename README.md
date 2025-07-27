# ソクブツMVP - 新着物件通知サービス

**完全リセット戦略準拠実装版**

## 🎯 概要

ソクブツMVPは、athome.co.jpの新着物件を監視し、Telegramで即座に通知する軽量なサービスです。

### 戦略準拠の特徴

- ✅ **HTTP-first戦略**: 軽量・高速処理（2-5秒）
- ✅ **最小限依存関係**: 12パッケージのみ
- ✅ **Docker対応**: 自宅サーバー最適化
- ✅ **完全テスト環境**: Lint/Jest/CI/CD完備
- ✅ **今日中稼働**: コピペで即座起動

## 🚀 クイックスタート（5分で起動）

### 1. プロジェクトセットアップ
```bash
git clone <repository-url>
cd sokubutsu-mvp
npm install
```

### 2. 環境変数設定
```bash
cp .env.example .env
# .envファイルを編集して以下を設定:
# TELEGRAM_BOT_TOKEN=your_bot_token_here
# TELEGRAM_CHAT_ID=your_chat_id_here
# MONITORING_URLS=https://www.athome.co.jp/chintai/tokyo/list/
```

### 3. 動作確認
```bash
# 手動テスト実行
npm run manual:test

# 開発モードで起動
npm run start:dev
```

### 4. 本番稼働
```bash
# Docker環境で起動
npm run docker:run

# または直接起動
npm run build
npm start
```

## 📋 環境変数設定

| 変数名 | 必須 | 説明 | 例 |
|--------|------|------|-----|
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram BotのToken | `123456:ABC-DEF...` |
| `TELEGRAM_CHAT_ID` | ✅ | 通知先のChat ID | `123456789` |
| `MONITORING_URLS` | ✅ | 監視するURL（カンマ区切り） | `https://www.athome.co.jp/...` |
| `MONITORING_INTERVAL` | ❌ | 監視間隔（cron形式） | `*/5 * * * *` (5分間隔) |
| `PORT` | ❌ | ポート番号 | `3000` |
| `NODE_ENV` | ❌ | 実行環境 | `production` |
| `DATA_DIR` | ❌ | データディレクトリ | `./data` |
| `LOG_LEVEL` | ❌ | ログレベル | `info` |

## 🛠️ 開発コマンド

```bash
# 開発
npm run start:dev          # 開発モード起動
npm run manual:test        # 手動テスト実行

# テスト・品質チェック
npm run test               # テスト実行
npm run test:watch         # テスト監視モード
npm run test:coverage      # カバレッジ付きテスト
npm run lint               # ESLint実行・自動修正
npm run lint:check         # ESLint実行（修正なし）
npm run quality:check      # 品質チェック（lint+test+build）

# ビルド・起動
npm run build              # TypeScriptビルド
npm start                  # 本番モード起動

# Docker
npm run docker:build       # Dockerイメージビルド
npm run docker:run         # Docker Compose起動
npm run docker:stop        # Docker Compose停止
```

## 📊 パフォーマンス目標

| 指標 | 目標値 | 実測値確認方法 |
|------|--------|----------------|
| 起動時間 | 1-2秒 | `npm run manual:test` |
| メモリ使用量 | 30-50MB | `npm run manual:test` |
| 実行時間 | 2-5秒 | ログ出力で確認 |
| 依存関係数 | 12パッケージ | `package.json`で確認 |

## 🏗️ アーキテクチャ

```
src/
├── main.ts              # メインエントリーポイント
├── config.ts            # 設定管理
├── types.ts             # 型定義
├── logger.ts            # ログ管理
├── performance.ts       # パフォーマンス監視
├── scraper.ts           # スクレイピング（HTTP-first）
├── telegram.ts          # Telegram通知
├── storage.ts           # データ保存（JSON）
├── scheduler.ts         # 監視スケジューラー
├── manual-test.ts       # 手動テスト
├── test-setup.ts        # テスト設定
└── __tests__/           # テストファイル
    ├── scraper.test.ts
    └── storage.test.ts
```

## 🐳 Docker運用

### 基本的な使用方法
```bash
# 起動
docker-compose up -d

# ログ確認
docker-compose logs -f

# 停止
docker-compose down

# 再起動
docker-compose restart
```

### リソース制限
- メモリ制限: 256MB
- CPU制限: 0.5コア
- ログローテーション: 10MB × 3ファイル

## 📱 Telegram Bot設定

### 1. Bot作成
1. [@BotFather](https://t.me/BotFather) にアクセス
2. `/newbot` コマンドでBot作成
3. Bot Tokenを取得

### 2. Chat ID取得
1. 作成したBotに何かメッセージを送信
2. `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` にアクセス
3. `chat.id` を確認

## 🔧 トラブルシューティング

### よくある問題

#### 1. Telegram接続エラー
```
❌ Telegram接続に失敗しました
```
**解決方法:**
- Bot Tokenが正しいか確認
- Chat IDが正しいか確認
- ネットワーク接続を確認

#### 2. スクレイピングエラー
```
❌ 物件要素が見つかりませんでした
```
**解決方法:**
- URLが正しいか確認
- athome.co.jpのサイト構造変更の可能性
- ネットワーク接続を確認

#### 3. パフォーマンス目標未達成
```
⚠️ 実行時間が目標を超過: 6000ms > 5000ms
```
**解決方法:**
- ネットワーク速度を確認
- 監視URL数を減らす
- サーバースペックを確認

### ログ確認方法

```bash
# リアルタイムログ
docker-compose logs -f sokubutsu-mvp

# ログファイル確認
ls -la logs/
cat logs/sokubutsu-$(date +%Y-%m-%d).log
```

## 📈 監視・運用

### 統計情報
- 1時間ごとにTelegramで統計レポート送信
- `data/statistics.json` で詳細確認可能

### バックアップ
- データは自動的に `data/` ディレクトリに保存
- バックアップは `data/backups/` に作成

### アップデート
```bash
# 最新版取得
git pull origin main

# 依存関係更新
npm install

# 再ビルド・再起動
npm run build
docker-compose restart
```

## 🤝 開発参加

### 開発環境セットアップ
```bash
# リポジトリクローン
git clone <repository-url>
cd sokubutsu-mvp

# 依存関係インストール
npm install

# 開発モード起動
npm run start:dev
```

### コード品質基準
- ESLint: エラー0件必須
- テストカバレッジ: 70%以上
- TypeScript: strict mode
- 全テスト成功必須

### Pull Request
1. 機能ブランチ作成
2. `npm run quality:check` 成功確認
3. テスト追加・更新
4. Pull Request作成

## 📄 ライセンス

MIT License

## 🙋‍♂️ サポート

問題が発生した場合:
1. `npm run manual:test` で診断実行
2. ログファイル確認
3. Issue作成（ログ添付）

---

**🎉 ソクブツMVPで理想の物件との出会いをお手伝いします！**