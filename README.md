# ソクブツ MVP - 新着物件通知サービス

不動産サイトの新着物件を5分間隔で監視し、Telegramに即座通知するサービスです。

## 特徴

- 🚀 **軽量実装**: 依存関係を最小限（12パッケージ）に抑えたMVP
- 🔍 **HTTP-first戦略**: axios + cheerioによる高速スクレイピング
- 📱 **Telegram通知**: 新着検知時に即座通知
- 🐳 **Docker対応**: 自宅サーバー（WSL2）での安定運用
- 💾 **メモリ効率**: 30-50MBの軽量動作

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd sokubutsu-mvp
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env`ファイルを編集:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
MONITORING_URLS=https://www.athome.co.jp/chintai/tokyo/list/
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. 起動

開発環境:
```bash
npm run start:dev
```

本番環境（Docker）:
```bash
docker-compose up -d
```

## 設定項目

| 環境変数 | 説明 | 例 |
|---------|------|-----|
| TELEGRAM_BOT_TOKEN | BotFatherから取得したトークン | 123456:ABC-DEF... |
| TELEGRAM_CHAT_ID | 通知先のチャットID | -1001234567890 |
| MONITORING_URLS | 監視するURL（カンマ区切り） | https://example.com |

## アーキテクチャ

```
src/
├── main.ts          # エントリーポイント
├── scraper.ts       # HTTPスクレイピング
├── telegram.ts      # Telegram通知
├── scheduler.ts     # cron監視
├── storage.ts       # JSONストレージ
└── config.ts        # 環境設定
```

## 動作確認

ログ確認:
```bash
docker-compose logs -f
```

停止:
```bash
docker-compose down
```

## トラブルシューティング

### Telegram接続エラー
- BOT_TOKENが正しいか確認
- CHAT_IDが正しいか確認（@userinfobot で取得）

### スクレイピングエラー
- 対象サイトの構造が変更されていないか確認
- ネットワーク接続を確認

## ライセンス

MIT