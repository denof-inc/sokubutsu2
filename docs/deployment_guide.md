# ソクブツ デプロイメント手順書

**バージョン**: 1.0  
**作成日**: 2025年7月25日  
**作成者**: テックリード（Manus AI）  
**対象プロジェクト**: ソクブツ（sokubutsu2）

## 概要

ソクブツの本番環境へのデプロイメント手順を詳細に説明します。自宅サーバー（WSL2）での運用を前提とし、Docker環境での安定稼働を目指します。

### デプロイメント戦略
- **段階的デプロイ**: 開発 → ステージング → 本番
- **ゼロダウンタイム**: ローリングアップデート対応
- **ロールバック対応**: 問題発生時の迅速な復旧
- **監視統合**: デプロイ後の自動監視開始

## 前提条件

### システム要件

#### 自宅サーバー環境
- **OS**: Ubuntu 24.04.2 LTS (WSL2)
- **CPU**: Intel Core i5-9400T (6コア)
- **メモリ**: 7.7GB（使用率38%以下推奨）
- **ストレージ**: 1TB（使用率10%以下推奨）

#### 必要なソフトウェア
```bash
# Docker & Docker Compose
docker --version  # 20.10.0以上
docker-compose --version  # 1.29.0以上

# Node.js & pnpm
node --version  # 20.18.0
pnpm --version  # 最新版

# Git
git --version  # 2.34.0以上
```

#### 環境変数設定
```bash
# 必須環境変数
export NODE_ENV=production
export PORT=13000
export DATABASE_PATH=/app/data/sokubutsu.sqlite
export TELEGRAM_BOT_TOKEN=your_bot_token_here
export LOG_LEVEL=info
```

## デプロイメント環境構成

### 環境別設定

#### 1. 開発環境（Development）
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    environment:
      - NODE_ENV=development
      - PORT=3000
    volumes:
      - .:/usr/src/app
      - node_modules_volume:/usr/src/app/node_modules
    ports:
      - '3000:3000'
    command: pnpm run start:dev
```

#### 2. ステージング環境（Staging）
```yaml
# docker-compose.staging.yml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=staging
      - PORT=13001
    volumes:
      - ./data:/app/data
    ports:
      - '13001:13001'
    restart: unless-stopped
```

#### 3. 本番環境（Production）
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - PORT=13000
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./backups:/app/backups
    ports:
      - '13000:13000'
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:13000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Dockerファイル最適化

#### 本番用Dockerfile
```dockerfile
# マルチステージビルドで最適化
FROM node:20-alpine AS builder

# 作業ディレクトリ設定
WORKDIR /usr/src/app

# システム依存関係のインストール
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# pnpmのインストール
RUN npm install -g pnpm

# 依存関係ファイルをコピー
COPY package.json pnpm-lock.yaml ./

# 依存関係のインストール
RUN pnpm install --frozen-lockfile

# ソースコードをコピー
COPY . .

# アプリケーションのビルド
RUN pnpm run build

# 本番用ステージ
FROM node:20-alpine AS production

# 非rootユーザーの作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# 作業ディレクトリ設定
WORKDIR /app

# システム依存関係のインストール（最小限）
RUN apk add --no-cache \
    sqlite \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

# pnpmのインストール
RUN npm install -g pnpm

# 依存関係ファイルをコピー
COPY package.json pnpm-lock.yaml ./

# 本番依存関係のみインストール
RUN pnpm install --frozen-lockfile --prod

# ビルド済みアプリケーションをコピー
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

# データディレクトリの作成
RUN mkdir -p /app/data /app/logs /app/backups
RUN chown -R nestjs:nodejs /app

# 非rootユーザーに切り替え
USER nestjs

# Playwrightの設定
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.cache/playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ポート公開
EXPOSE 13000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:13000/health || exit 1

# アプリケーション起動
CMD ["pnpm", "run", "start:prod"]
```

#### 開発用Dockerfile
```dockerfile
# Dockerfile.dev
FROM node:20-alpine

# 作業ディレクトリ設定
WORKDIR /usr/src/app

# システム依存関係のインストール
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# pnpmのインストール
RUN npm install -g pnpm

# 依存関係ファイルをコピー
COPY package.json pnpm-lock.yaml ./

# 依存関係のインストール
RUN pnpm install

# Playwrightブラウザのインストール
RUN pnpm exec playwright install chromium

# ポート公開
EXPOSE 3000

# 開発サーバー起動
CMD ["pnpm", "run", "start:dev"]
```

## デプロイメント手順

### 1. 事前準備

#### リポジトリの準備
```bash
# 1. 最新コードの取得
git fetch origin
git checkout main
git pull origin main

# 2. 依存関係の更新確認
pnpm audit
pnpm update

# 3. テストの実行
pnpm run test
pnpm run test:e2e

# 4. ビルドテスト
pnpm run build
```

#### 環境設定ファイルの準備
```bash
# .env.production
NODE_ENV=production
PORT=13000
DATABASE_PATH=/app/data/sokubutsu.sqlite
TELEGRAM_BOT_TOKEN=your_production_bot_token
LOG_LEVEL=info
CORS_ORIGIN=https://your-domain.com
```

### 2. ステージング環境でのテスト

#### ステージング環境の起動
```bash
# 1. ステージング環境の構築
docker-compose -f docker-compose.staging.yml build

# 2. ステージング環境の起動
docker-compose -f docker-compose.staging.yml up -d

# 3. ヘルスチェック
curl -f http://localhost:13001/health

# 4. 基本機能テスト
curl -X GET http://localhost:13001/urls
```

#### 統合テストの実行
```bash
# 1. Telegram Bot接続テスト
curl -X POST http://localhost:13001/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"message": {"text": "/start", "from": {"id": "test_user"}}}'

# 2. スクレイピング機能テスト
curl -X POST http://localhost:13001/urls \
  -H "Content-Type: application/json" \
  -d '{
    "name": "テスト物件",
    "url": "https://example.com",
    "selector": ".test-selector"
  }'

# 3. 監視機能テスト
docker-compose -f docker-compose.staging.yml logs -f app
```

### 3. 本番環境デプロイ

#### Blue-Green デプロイメント

##### Phase 1: Green環境の準備
```bash
# 1. 現在の本番環境をバックアップ
docker-compose -f docker-compose.prod.yml exec app \
  sqlite3 /app/data/sokubutsu.sqlite .dump > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Green環境用の設定
cp docker-compose.prod.yml docker-compose.green.yml
sed -i 's/13000:13000/13002:13000/g' docker-compose.green.yml

# 3. Green環境の構築
docker-compose -f docker-compose.green.yml build

# 4. Green環境の起動
docker-compose -f docker-compose.green.yml up -d
```

##### Phase 2: Green環境の検証
```bash
# 1. ヘルスチェック
curl -f http://localhost:13002/health

# 2. データベース接続確認
docker-compose -f docker-compose.green.yml exec app \
  sqlite3 /app/data/sokubutsu.sqlite "SELECT COUNT(*) FROM urls;"

# 3. Telegram Bot機能確認
# Telegram Botの設定を一時的にGreen環境に向ける
```

##### Phase 3: トラフィック切り替え
```bash
# 1. Nginx設定更新（リバースプロキシ使用時）
# upstream backend {
#   server localhost:13002;  # Green環境に切り替え
# }

# 2. 直接ポート切り替えの場合
docker-compose -f docker-compose.prod.yml stop
docker-compose -f docker-compose.green.yml stop

# ポート番号を本番用に変更
sed -i 's/13002:13000/13000:13000/g' docker-compose.green.yml
docker-compose -f docker-compose.green.yml up -d

# 3. 旧環境のクリーンアップ
docker-compose -f docker-compose.prod.yml down
```

#### ローリングアップデート（シンプル版）
```bash
# 1. 新しいイメージのビルド
docker-compose -f docker-compose.prod.yml build

# 2. 段階的な再起動
docker-compose -f docker-compose.prod.yml up -d --no-deps app

# 3. ヘルスチェック待機
while ! curl -f http://localhost:13000/health; do
  echo "Waiting for health check..."
  sleep 5
done

echo "Deployment completed successfully!"
```

### 4. デプロイ後の確認

#### 基本機能確認
```bash
# 1. API エンドポイント確認
curl -f http://localhost:13000/health
curl -f http://localhost:13000/urls

# 2. Telegram Bot確認
# /start コマンドをBotに送信して応答確認

# 3. ログ確認
docker-compose -f docker-compose.prod.yml logs -f app | head -50
```

#### 監視機能確認
```bash
# 1. 監視タスクの動作確認
docker-compose -f docker-compose.prod.yml exec app \
  pnpm run cli:test-monitoring

# 2. データベース状態確認
docker-compose -f docker-compose.prod.yml exec app \
  sqlite3 /app/data/sokubutsu.sqlite "SELECT * FROM urls WHERE is_active = 1;"

# 3. 通知機能確認
# テスト用URLを登録して新着通知が正常に送信されることを確認
```

## 自動デプロイメント

### GitHub Actions設定

#### .github/workflows/deploy.yml
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: latest
        
    - name: Install dependencies
      run: pnpm install
      
    - name: Run tests
      run: |
        pnpm run test
        pnpm run test:e2e
        
    - name: Build application
      run: pnpm run build

  deploy:
    needs: test
    runs-on: self-hosted  # 自宅サーバーでの実行
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Create backup
      run: |
        if [ -f sokubutsu.sqlite ]; then
          cp sokubutsu.sqlite backup_$(date +%Y%m%d_%H%M%S).sqlite
        fi
        
    - name: Deploy application
      run: |
        docker-compose -f docker-compose.prod.yml build
        docker-compose -f docker-compose.prod.yml up -d
        
    - name: Health check
      run: |
        sleep 30
        curl -f http://localhost:13000/health
        
    - name: Notify deployment
      if: success()
      run: |
        curl -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
          -d "chat_id=${{ secrets.ADMIN_CHAT_ID }}" \
          -d "text=✅ ソクブツのデプロイが完了しました"
```

### デプロイスクリプト

#### deploy.sh
```bash
#!/bin/bash

set -e  # エラー時に停止

# 設定
PROJECT_DIR="/home/ubuntu/sokubutsu2"
BACKUP_DIR="/home/ubuntu/backups"
LOG_FILE="/home/ubuntu/logs/deploy.log"

# ログ関数
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

# エラーハンドリング
error_exit() {
    log "ERROR: $1"
    exit 1
}

# メイン処理
main() {
    log "=== ソクブツ デプロイ開始 ==="
    
    # 1. 事前チェック
    log "事前チェック実行中..."
    cd $PROJECT_DIR || error_exit "プロジェクトディレクトリが見つかりません"
    
    # Git状態確認
    if [ -n "$(git status --porcelain)" ]; then
        error_exit "未コミットの変更があります"
    fi
    
    # 2. バックアップ作成
    log "バックアップ作成中..."
    if [ -f "sokubutsu.sqlite" ]; then
        cp sokubutsu.sqlite $BACKUP_DIR/sokubutsu_$(date +%Y%m%d_%H%M%S).sqlite
        log "データベースバックアップ完了"
    fi
    
    # 3. 最新コード取得
    log "最新コード取得中..."
    git fetch origin
    git pull origin main
    
    # 4. 依存関係更新
    log "依存関係更新中..."
    pnpm install --frozen-lockfile
    
    # 5. テスト実行
    log "テスト実行中..."
    pnpm run test || error_exit "テストが失敗しました"
    
    # 6. ビルド
    log "アプリケーションビルド中..."
    pnpm run build || error_exit "ビルドが失敗しました"
    
    # 7. Docker イメージビルド
    log "Dockerイメージビルド中..."
    docker-compose -f docker-compose.prod.yml build || error_exit "Dockerビルドが失敗しました"
    
    # 8. アプリケーション停止
    log "現在のアプリケーション停止中..."
    docker-compose -f docker-compose.prod.yml down
    
    # 9. アプリケーション起動
    log "新しいアプリケーション起動中..."
    docker-compose -f docker-compose.prod.yml up -d || error_exit "アプリケーション起動が失敗しました"
    
    # 10. ヘルスチェック
    log "ヘルスチェック実行中..."
    sleep 30
    
    for i in {1..10}; do
        if curl -f http://localhost:13000/health > /dev/null 2>&1; then
            log "ヘルスチェック成功"
            break
        fi
        
        if [ $i -eq 10 ]; then
            error_exit "ヘルスチェックが失敗しました"
        fi
        
        log "ヘルスチェック待機中... ($i/10)"
        sleep 10
    done
    
    # 11. 完了通知
    log "=== デプロイ完了 ==="
    
    # Telegram通知（オプション）
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$ADMIN_CHAT_ID" ]; then
        curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$ADMIN_CHAT_ID" \
            -d "text=✅ ソクブツのデプロイが完了しました $(date '+%Y-%m-%d %H:%M:%S')" \
            > /dev/null 2>&1
    fi
}

# スクリプト実行
main "$@"
```

#### 使用方法
```bash
# 実行権限付与
chmod +x deploy.sh

# デプロイ実行
./deploy.sh

# ログ確認
tail -f /home/ubuntu/logs/deploy.log
```

## ロールバック手順

### 緊急ロールバック

#### 1. 即座のロールバック
```bash
# 1. 現在のコンテナ停止
docker-compose -f docker-compose.prod.yml down

# 2. 前回のイメージに戻す
docker images | grep sokubutsu2
docker tag sokubutsu2:previous sokubutsu2:latest

# 3. アプリケーション再起動
docker-compose -f docker-compose.prod.yml up -d

# 4. ヘルスチェック
curl -f http://localhost:13000/health
```

#### 2. データベースロールバック
```bash
# 1. アプリケーション停止
docker-compose -f docker-compose.prod.yml down

# 2. データベースファイル復元
cp /home/ubuntu/backups/sokubutsu_20250725_120000.sqlite sokubutsu.sqlite

# 3. アプリケーション再起動
docker-compose -f docker-compose.prod.yml up -d
```

### 段階的ロールバック

#### rollback.sh
```bash
#!/bin/bash

set -e

BACKUP_DIR="/home/ubuntu/backups"
LOG_FILE="/home/ubuntu/logs/rollback.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

rollback() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        echo "使用方法: ./rollback.sh <backup_file>"
        echo "利用可能なバックアップ:"
        ls -la $BACKUP_DIR/sokubutsu_*.sqlite
        exit 1
    fi
    
    if [ ! -f "$BACKUP_DIR/$backup_file" ]; then
        log "ERROR: バックアップファイルが見つかりません: $backup_file"
        exit 1
    fi
    
    log "=== ロールバック開始 ==="
    log "バックアップファイル: $backup_file"
    
    # 1. 現在の状態をバックアップ
    log "現在の状態をバックアップ中..."
    cp sokubutsu.sqlite $BACKUP_DIR/sokubutsu_before_rollback_$(date +%Y%m%d_%H%M%S).sqlite
    
    # 2. アプリケーション停止
    log "アプリケーション停止中..."
    docker-compose -f docker-compose.prod.yml down
    
    # 3. データベース復元
    log "データベース復元中..."
    cp $BACKUP_DIR/$backup_file sokubutsu.sqlite
    
    # 4. アプリケーション起動
    log "アプリケーション起動中..."
    docker-compose -f docker-compose.prod.yml up -d
    
    # 5. ヘルスチェック
    log "ヘルスチェック実行中..."
    sleep 30
    curl -f http://localhost:13000/health || {
        log "ERROR: ヘルスチェックが失敗しました"
        exit 1
    }
    
    log "=== ロールバック完了 ==="
}

rollback "$1"
```

## 監視・ログ管理

### ログ設定

#### ログローテーション設定
```bash
# /etc/logrotate.d/sokubutsu
/home/ubuntu/sokubutsu2/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        docker-compose -f /home/ubuntu/sokubutsu2/docker-compose.prod.yml restart app
    endscript
}
```

#### Docker ログ設定
```yaml
# docker-compose.prod.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 監視設定

#### ヘルスチェック監視
```bash
#!/bin/bash
# health-monitor.sh

while true; do
    if ! curl -f http://localhost:13000/health > /dev/null 2>&1; then
        echo "$(date): Health check failed" >> /home/ubuntu/logs/health.log
        
        # Telegram通知
        curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$ADMIN_CHAT_ID" \
            -d "text=🚨 ソクブツのヘルスチェックが失敗しました $(date)"
    fi
    
    sleep 60
done
```

#### システムリソース監視
```bash
#!/bin/bash
# resource-monitor.sh

# メモリ使用率チェック
memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
if (( $(echo "$memory_usage > 80" | bc -l) )); then
    echo "$(date): High memory usage: $memory_usage%" >> /home/ubuntu/logs/resource.log
fi

# ディスク使用率チェック
disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $disk_usage -gt 80 ]; then
    echo "$(date): High disk usage: $disk_usage%" >> /home/ubuntu/logs/resource.log
fi

# Docker コンテナ状態チェック
if ! docker-compose -f /home/ubuntu/sokubutsu2/docker-compose.prod.yml ps | grep -q "Up"; then
    echo "$(date): Container is not running" >> /home/ubuntu/logs/resource.log
fi
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. SQLite3 ビルドエラー
```bash
# 問題: sqlite3 モジュールのビルドエラー
# 解決: better-sqlite3 への移行

# 1. sqlite3 を削除
pnpm remove sqlite3

# 2. better-sqlite3 をインストール
pnpm add better-sqlite3

# 3. TypeORM設定を更新
# type: 'sqlite' → type: 'better-sqlite3'
```

#### 2. Docker メモリ不足
```bash
# 問題: Docker コンテナのメモリ不足
# 解決: メモリ制限の調整

# docker-compose.prod.yml に追加
services:
  app:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

#### 3. Playwright ブラウザエラー
```bash
# 問題: Playwright でブラウザが起動しない
# 解決: 依存関係の追加

# Dockerfile に追加
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 環境変数設定
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

#### 4. ポート競合
```bash
# 問題: ポート13000が既に使用中
# 解決: プロセス確認と停止

# 使用中のプロセス確認
sudo netstat -tlnp | grep :13000

# プロセス停止
sudo kill -9 <PID>

# または Docker コンテナ停止
docker-compose -f docker-compose.prod.yml down
```

### ログ分析

#### エラーログの確認
```bash
# アプリケーションログ
docker-compose -f docker-compose.prod.yml logs app | grep ERROR

# システムログ
journalctl -u docker | grep sokubutsu

# ファイルログ
tail -f /home/ubuntu/logs/deploy.log
grep ERROR /home/ubuntu/logs/*.log
```

#### パフォーマンス分析
```bash
# Docker コンテナのリソース使用状況
docker stats

# システムリソース
htop
free -h
df -h

# ネットワーク接続
netstat -tlnp | grep :13000
```

## セキュリティ考慮事項

### 本番環境セキュリティ

#### 1. ファイアウォール設定
```bash
# UFW設定
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 13000/tcp # アプリケーション
sudo ufw deny 3000/tcp   # 開発ポートは拒否
```

#### 2. SSL/TLS設定（Nginx使用時）
```nginx
# /etc/nginx/sites-available/sokubutsu
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:13000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 3. 環境変数の保護
```bash
# .env ファイルの権限設定
chmod 600 .env.production

# Docker Secrets使用（推奨）
echo "your_bot_token" | docker secret create telegram_bot_token -
```

### アクセス制御

#### 1. Docker セキュリティ
```yaml
# docker-compose.prod.yml
services:
  app:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    user: "1001:1001"  # 非rootユーザー
```

#### 2. データベースセキュリティ
```bash
# データベースファイルの権限
chmod 600 sokubutsu.sqlite
chown ubuntu:ubuntu sokubutsu.sqlite

# バックアップファイルの暗号化
gpg --symmetric --cipher-algo AES256 backup.sqlite
```

---

**注意**: この手順書は自宅サーバー環境での運用を前提としており、本格的なクラウド環境での運用時は追加のセキュリティ対策が必要です。定期的な見直しと更新を行ってください。

