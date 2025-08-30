# ソクブツMVP - 新着物件通知サービス

**完全リセット戦略準拠実装版**

## 🎯 概要

ソクブツMVPは、athome.co.jpの新着物件を監視し、Telegramで即座に通知する軽量なサービスです。

### 主な特徴（現行仕様）

- ✅ **ESMモジュールシステム**: 完全ESM対応
- ✅ **Puppeteer-first戦略**: 認証回避・指紋対策込み（実測: 約5秒/回）
- ✅ **Telegram通知（grammy + Webhook）**: Tailscale Funnel推奨（Cloudflare Tunnelも可）
- ✅ **TypeScript**: 型安全・Jestテスト完備
- ✅ **Docker対応**: 自宅サーバ向け最適化

## 🚀 クイックスタート（5分で起動）

### 必要要件
- Node.js 18.0.0以上（ESMサポートのため）
- npm 8.0.0以上

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

### 4. 本番稼働（Dockerのみ）
```bash
# Docker Compose で起動（本番想定）
npm run docker:run
```
注: 本番は Docker 前提です。`npm start` による直接起動はサポートしません（開発用途のみ）。

## 📋 環境変数設定（主要）

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
| `ADMIN_PUBLIC_URL` | ✅(Webhook) | 公開URL（HTTPS） | `https://bot.example.com` |

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

# ビルド（開発用途）
npm run build              # TypeScriptビルド（ローカル検証用）
# 本番起動は Docker を使用

# Docker
npm run docker:build       # Dockerイメージビルド
npm run docker:run         # Docker Compose起動
npm run docker:stop        # Docker Compose停止
```

### 運用スクリプト（自動復旧・一括デプロイ）

```
# 一括デプロイ（ビルド→起動→Tailscale公開→Webhook設定→検証）
bash scripts/ops/deploy-all.sh

# Tailscale Serve/Funnel を 3002 に有効化し、公開URLを .env* に同期
bash scripts/ops/ensure-funnel.sh

# コンテナ内の環境で Webhook を登録（pending破棄込み）
bash scripts/ops/ensure-webhook.sh

# Health / WebhookInfo / Webhook入出力ログをまとめて確認
bash scripts/ops/verify.sh
```

## 📊 パフォーマンス目標

| 指標 | 目標値 | 実測値確認方法 |
|------|--------|----------------|
| 起動時間 | 1-2秒 | `npm run manual:test` |
| メモリ使用量 | 30-50MB | `npm run manual:test` |
| 実行時間 | 2-5秒 | ログ出力で確認 |
| 依存関係数 | 12パッケージ | `package.json`で確認 |

## 🏗️ アーキテクチャ

### モジュールシステム
- **完全ESM対応**: すべてのモジュールはESM形式で記述
- **拡張子付きインポート**: `.js`拡張子を明示的に指定
- **TypeScript設定**: `"module": "ES2022"` で最新仕様に対応

### ディレクトリ構造
```
src/
├── main.ts              # メインエントリーポイント
├── config.ts            # 設定管理
├── types.ts             # 型定義
├── logger.ts            # ログ管理（vibelogger使用）
├── performance.ts       # パフォーマンス監視
├── scraper.ts           # スクレイピング（HTTP-first戦略）
├── telegram.ts          # Telegram通知（grammy使用・Webhook）
├── storage.ts           # データ保存（JSON/SQLite）
├── scheduler.ts         # 監視スケジューラー
├── property-monitor.ts  # 新着物件検知ロジック
├── circuit-breaker.ts   # サーキットブレーカーパターン
├── entities/            # TypeORM エンティティ
│   ├── User.ts         # ユーザーエンティティ
│   └── UserUrl.ts      # URL管理エンティティ
├── __tests__/           # テストファイル（Jest + ESM）
│   ├── setup.ts        # テスト共通設定
│   └── *.test.ts       # 各種テストファイル
└── __mocks__/           # モックファイル
    ├── vibelogger.js   # ESM形式のモック
    └── *.ts            # TypeScriptモック
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

## 📱 Telegram Bot設定（Webhook）

### 1. Bot作成
1. [@BotFather](https://t.me/BotFather) にアクセス
2. `/newbot` コマンドでBot作成
3. Bot Tokenを取得

### 2. Chat ID取得
1. 作成したBotに何かメッセージを送信
2. `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` にアクセス
3. `chat.id` を確認

### 3. Webhook用公開URLを設定

`.env` に以下を追加します（HTTPS必須）。

```
ADMIN_PUBLIC_URL=https://your-domain.example.com
```

本リポジトリは管理画面サーバー（Express）に `/telegram/webhook` を自動登録し、起動時に Telegram API へ Webhook URL を設定します。

Webhook URL 例: `https://your-domain.example.com/telegram/webhook`

Docker では `3002:3002` を公開しているため、リバースプロキシ等で上記URLにルーティングしてください。

補足: Cloudflareでゾーン管理ができない／DNSを変更できない場合は、Tailscale Funnel（無料）で安定HTTPSの公開URL（例: `https://<host>.<tailnet>.ts.net`）を取得できます。詳細手順は「docs/運用・デプロイガイド.md > Webhook公開（ゾーン未委譲時の代替：Tailscale Funnel）」を参照してください。

### Tailscale Funnel（推奨）クイック手順
- Tailscaleをインストールしてログイン
- Funnelを有効化: `tailscale funnel --bg 3002`
- 発行URLを `ADMIN_PUBLIC_URL` に設定（例: `https://<host>.<tailnet>.ts.net`）
- コンテナ起動: `docker-compose up -d`
- Webhook確認: `curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"`

### Webhook自己修復ガード（安定運用のための自動復旧）
- 機能: TelegramのWebHook URLを定期検証し、不一致や解除を検知したら自動で再設定します。
- 設定:
  - `.env` / `.env.production` に以下（デフォルト有効）
    - `WEBHOOK_GUARDIAN_ENABLED=true`
    - `WEBHOOK_GUARDIAN_INTERVAL=10`（分）
- 期待効果: 起動直後の一時的な失敗や外部要因でWebHookが外れても、自動で復旧し通知断を最小化します。

注意: 旧ロングポーリング実装（`bot.start()`）は使用しません。

### 表示整形（HTML）とリンク方針
- `parse_mode: 'HTML'` を使用
- 改行は全て `\n` で結合（バックスラッシュ表示になる `\\n` を使わない）
- 監視名は「監視URL」へリンク（青字タップで対象URLへ遷移）

### Webhook入出力ログ（可観測性）
- 受信: `admin.webhook.request`
- 応答: `admin.webhook.response`
→ 届いていないのか、返せていないのかを即時に判別可能

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

# 依存関係更新（ビルドはDockerで実行）
npm install

# Dockerイメージ再ビルド＆再起動
npm run docker:build
docker-compose up -d
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
- **ESLint**: エラー0件必須（警告は段階的に改善）
- **テストカバレッジ**: 80%以上
- **TypeScript**: strict mode 有効
- **全テスト成功必須**: CI/CDで自動チェック
- **ESMモジュール**: CommonJSの混在禁止

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
