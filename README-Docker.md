# Docker環境での実行方法

## 🚀 概要
このプロジェクトはDocker環境で開発・本番運用ができるように最適化されています。

## 📋 利用可能な構成

### 1. 開発環境
```bash
# 開発環境での起動（ホットリロード有効）
docker-compose up

# またはバックグラウンド実行
docker-compose up -d
```

### 2. 本番環境
```bash
# 本番環境での起動
docker-compose -f docker-compose.prod.yml up

# またはバックグラウンド実行
docker-compose -f docker-compose.prod.yml up -d
```

## ⚙️ 環境設定

### 開発環境
1. `.env.example`を`.env`にコピー
2. 必要に応じて設定値を編集

```bash
cp .env.example .env
```

### 本番環境
1. `.env.production.example`を`.env.production`にコピー
2. 本番用の設定値を設定

```bash
cp .env.production.example .env.production
# 環境変数を適切に設定してください
```

## 📊 パフォーマンス最適化

### イメージサイズ最適化
- **マルチステージビルド**: 開発依存関係を本番イメージから除外
- **Alpine Linux**: 軽量なベースイメージを使用
- **Playwright分離**: ビルド時にブラウザダウンロードをスキップし、本番時のみ必要なブラウザをインストール

### リソース制限（本番環境）
- **メモリ制限**: 512MB（予約256MB）
- **CPU制限**: 1.0コア（予約0.5コア）
- **ログローテーション**: 10MB x 3ファイル

## 🛠️ メンテナンス

### ヘルスチェック
本番環境では自動的にヘルスチェックが実行されます。

### ログ確認
```bash
# 開発環境
docker-compose logs -f

# 本番環境
docker-compose -f docker-compose.prod.yml logs -f
```

### コンテナの停止・削除
```bash
# 開発環境
docker-compose down

# 本番環境
docker-compose -f docker-compose.prod.yml down
```