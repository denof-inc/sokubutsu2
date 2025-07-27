# ソクブツ (Sokubutsu) - 新着物件通知サービス

<p align="center">
  <strong>自宅サーバーで動作する軽量な新着物件監視システム</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram" />
</p>

## 🎯 プロジェクト概要

ソクブツは、不動産ポータルサイト（初期対応：athome.co.jp）の新着物件を自動監視し、Telegramで即座に通知するサービスです。

### 🏠 自宅サーバー特化設計
- **WSL2 + Docker環境**での軽量・安定動作
- **Bot検知回避**のため自宅サーバーからのアクセス
- **月額1,500円以内**の低コスト運用

### ⚡ 軽量・高速処理
- **HTTP-onlyスクレイピング**による2-5秒の高速処理
- **メモリ使用量30-50MB**の軽量実装
- **5分間隔監視**による即座な新着検知

## 🚀 クイックスタート

### 前提条件
- Docker & Docker Compose
- WSL2 (Windows) または Linux環境
- Telegram Bot Token

### 1分で起動
```bash
# 1. リポジトリクローン
git clone https://github.com/denof-inc/sokubutsu2.git
cd sokubutsu2

# 2. 環境変数設定
cp .env.example .env
# .envファイルを編集してTelegram設定

# 3. Docker起動
docker-compose up -d

# 4. 動作確認
docker-compose logs -f
```

### 環境変数設定
```env
# .env ファイル
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
MONITORING_URLS=https://www.athome.co.jp/chintai/tokyo/shibuya-city/list/
```

## 📋 主要機能

### 🔍 監視機能
- **athome.co.jp対応**: HTTP-onlyによる軽量スクレイピング
- **新着検知**: ハッシュ値比較による変更検知
- **5分間隔**: 設定可能な監視サイクル
- **エラー通知**: 監視失敗時の自動アラート

### 📱 通知機能
- **即座通知**: 新着物件検知時のTelegramプッシュ通知
- **システム通知**: エラー・状態変更の自動通知
- **監視開始通知**: サービス開始時の確認通知

### 🐳 Docker環境
- **軽量コンテナ**: 200MB以下のイメージサイズ
- **自動再起動**: サービス停止時の自動復旧
- **簡単デプロイ**: docker-compose.ymlによる一発起動

## 🏗️ アーキテクチャ

### MVP構成（シンプル設計）
```
src/
├── main.ts          # エントリーポイント
├── scraper.ts       # HTTP-onlyスクレイピング
├── telegram.ts      # Telegram通知
├── scheduler.ts     # cron監視スケジューラー
└── storage.ts       # JSON簡易ストレージ
```

### 技術スタック
- **Runtime**: Node.js 20 (Alpine)
- **Language**: TypeScript
- **HTTP Client**: axios
- **HTML Parser**: cheerio
- **Scheduler**: node-cron
- **Notification**: telegraf
- **Container**: Docker + Docker Compose

## 📊 パフォーマンス

| 項目 | 値 | 備考 |
|------|-----|------|
| メモリ使用量 | 30-50MB | 軽量実装 |
| 実行時間 | 2-5秒 | HTTP-only |
| 起動時間 | 1-2秒 | シンプル構成 |
| Docker容量 | 200MB以下 | Alpine基盤 |
| 監視間隔 | 5分 | 設定可能 |

## 🛠️ 開発環境

### ローカル開発
```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run start:dev

# ビルド
npm run build

# テスト実行
npm test

# Lint実行
npm run lint
```

### 最小限依存関係
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "cheerio": "^1.0.0-rc.12",
    "node-cron": "^3.0.3",
    "telegraf": "^4.15.0",
    "dotenv": "^16.3.0"
  }
}
```

## 📚 ドキュメント

### 新規参入者向け
- [クイックスタートガイド](#🚀-クイックスタート) - 1分で起動
- [環境構築手順](./docs/開発環境構築手順書.md) - 詳細セットアップ
- [自宅サーバー運用ガイド](./docs/自宅サーバー運用ガイド.md) - WSL2環境設定

### 開発者向け
- [システム設計書](./docs/システム設計書.md) - アーキテクチャ詳細
- [軽量実装ガイド](./docs/軽量実装ガイド.md) - パフォーマンス最適化
- [スクレイピング戦略](./docs/スクレイピング戦略.md) - HTTP-first戦略

### 運用者向け
- [デプロイメント手順書](./docs/デプロイメント手順書.md) - 本番環境構築
- [トラブルシューティングガイド](./docs/トラブルシューティングガイド.md) - 問題解決
- [テスト戦略・手順書](./docs/テスト戦略・手順書.md) - 品質保証

## 🔧 設定・カスタマイズ

### 監視URL追加
```env
# 複数URL対応（カンマ区切り）
MONITORING_URLS=https://www.athome.co.jp/chintai/tokyo/shibuya-city/list/,https://www.athome.co.jp/chintai/osaka/osaka-city/list/
```

### 監視間隔変更
```typescript
// src/scheduler.ts
// 5分間隔 → 10分間隔に変更
cron.schedule('*/10 * * * *', async () => {
  // 監視処理
});
```

### Docker設定調整
```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 100M
          cpus: '0.5'
```

## 🚨 トラブルシューティング

### よくある問題

#### 1. Telegram通知が来ない
```bash
# Bot Token確認
echo $TELEGRAM_BOT_TOKEN

# Chat ID確認
echo $TELEGRAM_CHAT_ID

# ログ確認
docker-compose logs app | grep telegram
```

#### 2. スクレイピングエラー
```bash
# ネットワーク確認
docker exec sokubutsu_app ping www.athome.co.jp

# User-Agent確認
docker-compose logs app | grep "User-Agent"
```

#### 3. メモリ不足
```bash
# メモリ使用量確認
docker stats sokubutsu_app

# メモリ制限設定
# docker-compose.ymlでmemory制限を追加
```

## 📈 監視・運用

### ヘルスチェック
```bash
# コンテナ状態確認
docker-compose ps

# ログ監視
docker-compose logs -f --tail=100

# リソース使用量
docker stats
```

### 手動実行
```bash
# 手動監視実行（テスト用）
docker exec sokubutsu_app npm run monitor:manual
```

## 🔮 将来計画

### 短期拡張（1週間）
- [ ] 複数URL対応の改善
- [ ] Web UI追加
- [ ] 詳細ログ機能

### 中期拡張（1ヶ月）
- [ ] 他サイト対応（suumo等）
- [ ] ユーザー管理機能
- [ ] データベース永続化

### 長期拡張（3ヶ月）
- [ ] 本格的なTelegram Bot機能
- [ ] 管理者ダッシュボード
- [ ] 課金システム

## 🤝 コントリビューション

### 開発参加
1. Issueを確認・作成
2. ブランチ作成 (`feature/機能名`)
3. 実装・テスト
4. Pull Request作成

### 品質基準
- ESLintエラー0件
- テストカバレッジ80%以上
- Docker環境での動作確認
- ドキュメント更新

## 📄 ライセンス

MIT License - 詳細は[LICENSE](./LICENSE)ファイルを参照

## 🙏 謝辞

- [Node.js](https://nodejs.org/) - 軽量ランタイム
- [Docker](https://www.docker.com/) - コンテナ化技術
- [Telegram Bot API](https://core.telegram.org/bots/api) - 通知システム

---

**ソクブツで、理想の物件を誰よりも早く見つけよう！** 🏠✨

### 📞 サポート

- **Issue**: [GitHub Issues](https://github.com/denof-inc/sokubutsu2/issues)
- **Discussion**: [GitHub Discussions](https://github.com/denof-inc/sokubutsu2/discussions)
- **Documentation**: [docs/](./docs/)

新規参入者の方は、まず[クイックスタートガイド](#🚀-クイックスタート)から始めることをお勧めします！

