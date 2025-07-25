# ソクブツ 開発環境構築手順書

**バージョン**: 1.0  
**作成日**: 2025年7月25日  
**作成者**: テックリード（Manus AI）  
**対象プロジェクト**: ソクブツ（sokubutsu2）

## 概要

ソクブツの開発環境を効率的に構築するための詳細な手順書です。Windows（WSL2）、macOS、Linuxでの環境構築をサポートし、チーム開発での一貫性を保証します。

### 開発環境の特徴
- **クロスプラットフォーム対応**: Windows/macOS/Linux
- **Docker統合**: 一貫した開発環境
- **ホットリロード**: 高速な開発サイクル
- **デバッグ対応**: VSCode統合デバッグ

## システム要件

### 最小要件
- **CPU**: 2コア以上
- **メモリ**: 8GB以上（推奨: 16GB）
- **ストレージ**: 10GB以上の空き容量
- **OS**: Windows 10/11（WSL2）、macOS 12+、Ubuntu 20.04+

### 推奨要件
- **CPU**: 4コア以上
- **メモリ**: 16GB以上
- **ストレージ**: SSD 20GB以上
- **ネットワーク**: 安定したインターネット接続

## 事前準備

### 1. 必要なソフトウェアのインストール

#### Windows（WSL2）環境
```powershell
# 1. WSL2の有効化
wsl --install

# 2. Ubuntu 24.04のインストール
wsl --install -d Ubuntu-24.04

# 3. WSL2の設定確認
wsl --list --verbose
```

#### macOS環境
```bash
# 1. Homebrewのインストール
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 必要なツールのインストール
brew install git curl wget
```

#### Linux（Ubuntu）環境
```bash
# 1. システムの更新
sudo apt update && sudo apt upgrade -y

# 2. 必要なパッケージのインストール
sudo apt install -y curl wget git build-essential
```

### 2. Node.js環境のセットアップ

#### Node.js 20.18.0のインストール
```bash
# 1. Node Version Manager (nvm) のインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 2. シェルの再読み込み
source ~/.bashrc

# 3. Node.js 20.18.0のインストール
nvm install 20.18.0
nvm use 20.18.0
nvm alias default 20.18.0

# 4. バージョン確認
node --version  # v20.18.0
npm --version   # 10.8.2
```

#### pnpmのインストール
```bash
# 1. pnpmのインストール
npm install -g pnpm

# 2. バージョン確認
pnpm --version

# 3. pnpm設定
pnpm config set store-dir ~/.pnpm-store
pnpm config set cache-dir ~/.pnpm-cache
```

### 3. Dockerのセットアップ

#### Windows（WSL2）でのDocker
```bash
# 1. Docker Desktop for Windowsをインストール
# https://docs.docker.com/desktop/windows/install/

# 2. WSL2統合の有効化
# Docker Desktop > Settings > Resources > WSL Integration

# 3. 動作確認
docker --version
docker-compose --version
```

#### macOSでのDocker
```bash
# 1. Docker Desktop for Macのインストール
brew install --cask docker

# 2. Docker Desktopの起動
open /Applications/Docker.app

# 3. 動作確認
docker --version
docker-compose --version
```

#### LinuxでのDocker
```bash
# 1. Dockerのインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. ユーザーをdockerグループに追加
sudo usermod -aG docker $USER

# 3. Docker Composeのインストール
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. 再ログイン後、動作確認
docker --version
docker-compose --version
```

## プロジェクトのセットアップ

### 1. リポジトリのクローン

```bash
# 1. プロジェクトディレクトリの作成
mkdir -p ~/projects
cd ~/projects

# 2. リポジトリのクローン
git clone https://github.com/denof-inc/sokubutsu2.git
cd sokubutsu2

# 3. ブランチの確認
git branch -a
git checkout main
```

### 2. 依存関係のインストール

```bash
# 1. Node.jsバージョンの確認
cat .node-version  # 20.18.0

# 2. 正しいNode.jsバージョンの使用
nvm use

# 3. 依存関係のインストール
pnpm install

# 4. インストール確認
pnpm list --depth=0
```

### 3. 環境設定ファイルの作成

#### .env.development
```bash
# 開発環境用設定ファイルの作成
cp .env.example .env.development

# 内容の編集
cat > .env.development << 'EOF'
# 開発環境設定
NODE_ENV=development
PORT=3000

# データベース設定
DATABASE_PATH=./sokubutsu_dev.sqlite

# Telegram Bot設定（開発用）
TELEGRAM_BOT_TOKEN=your_development_bot_token_here

# ログ設定
LOG_LEVEL=debug

# CORS設定
CORS_ORIGIN=http://localhost:3000

# Playwright設定
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/playwright
EOF
```

#### .env.test
```bash
# テスト環境用設定ファイルの作成
cat > .env.test << 'EOF'
# テスト環境設定
NODE_ENV=test
PORT=3001

# データベース設定（インメモリ）
DATABASE_PATH=:memory:

# Telegram Bot設定（モック）
TELEGRAM_BOT_TOKEN=test_bot_token

# ログ設定
LOG_LEVEL=error

# テスト設定
TEST_TIMEOUT=30000
EOF
```

### 4. データベースの初期化

```bash
# 1. SQLite3の確認
which sqlite3 || sudo apt install sqlite3  # Linux
which sqlite3 || brew install sqlite3      # macOS

# 2. 開発用データベースの作成
pnpm run db:create

# 3. マイグレーションの実行
pnpm run db:migrate

# 4. 初期データの投入（オプション）
pnpm run db:seed
```

## 開発環境の起動

### 1. ネイティブ環境での起動

```bash
# 1. 開発サーバーの起動
pnpm run start:dev

# 2. 別ターミナルでログ確認
tail -f logs/development.log

# 3. API動作確認
curl http://localhost:3000/health
```

### 2. Docker環境での起動

```bash
# 1. 開発用Dockerイメージのビルド
docker-compose -f docker-compose.dev.yml build

# 2. 開発環境の起動
docker-compose -f docker-compose.dev.yml up -d

# 3. ログ確認
docker-compose -f docker-compose.dev.yml logs -f app

# 4. コンテナ内でのコマンド実行
docker-compose -f docker-compose.dev.yml exec app pnpm run test
```

### 3. ホットリロードの確認

```bash
# 1. ファイル変更の監視確認
echo "console.log('Hot reload test');" >> src/app.service.ts

# 2. 自動再起動の確認（ログで確認）
# [Nest] Application successfully started

# 3. 変更の取り消し
git checkout -- src/app.service.ts
```

## 開発ツールの設定

### 1. VSCode設定

#### .vscode/settings.json
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true,
    "**/coverage": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "eslint.workingDirectories": ["./"],
  "prettier.configPath": "./.prettierrc"
}
```

#### .vscode/launch.json
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/main.js",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "envFile": "${workspaceFolder}/.env.development",
      "console": "integratedTerminal",
      "restart": true,
      "runtimeArgs": ["--nolazy"],
      "sourceMaps": true
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "envFile": "${workspaceFolder}/.env.test",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

#### .vscode/tasks.json
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "npm: build",
      "type": "npm",
      "script": "build",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "silent",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": "$tsc"
    },
    {
      "label": "npm: start:dev",
      "type": "npm",
      "script": "start:dev",
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      }
    }
  ]
}
```

#### .vscode/extensions.json
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-json",
    "bradlc.vscode-tailwindcss",
    "ms-vscode-remote.remote-containers",
    "ms-vscode-remote.remote-wsl"
  ]
}
```

### 2. Git設定

#### .gitignore（追加設定）
```gitignore
# 開発環境固有
.env.development
.env.local
*.sqlite
*.sqlite-journal

# IDE設定
.vscode/settings.json
.idea/

# ログファイル
logs/
*.log

# テスト関連
coverage/
.nyc_output/

# OS固有
.DS_Store
Thumbs.db

# 一時ファイル
tmp/
temp/
```

#### Git Hooks設定
```bash
# 1. pre-commit hookの設定
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Pre-commit hook

echo "Running pre-commit checks..."

# ESLint チェック
pnpm run lint
if [ $? -ne 0 ]; then
  echo "ESLint failed. Please fix the errors before committing."
  exit 1
fi

# テスト実行
pnpm run test
if [ $? -ne 0 ]; then
  echo "Tests failed. Please fix the tests before committing."
  exit 1
fi

echo "Pre-commit checks passed!"
EOF

# 2. 実行権限付与
chmod +x .git/hooks/pre-commit
```

## テスト環境の設定

### 1. 単体テストの実行

```bash
# 1. 全テストの実行
pnpm run test

# 2. 特定ファイルのテスト
pnpm run test -- url.service.spec.ts

# 3. ウォッチモードでのテスト
pnpm run test:watch

# 4. カバレッジ付きテスト
pnpm run test:cov
```

### 2. E2Eテストの実行

```bash
# 1. E2Eテスト環境の準備
pnpm run test:e2e:setup

# 2. E2Eテストの実行
pnpm run test:e2e

# 3. 特定のE2Eテスト
pnpm run test:e2e -- --testNamePattern="URL management"
```

### 3. テストデータベースの管理

```bash
# 1. テスト用データベースの初期化
NODE_ENV=test pnpm run db:create

# 2. テスト用マイグレーション
NODE_ENV=test pnpm run db:migrate

# 3. テストデータの投入
NODE_ENV=test pnpm run db:seed:test
```

## デバッグ環境の設定

### 1. VSCodeデバッグ

```bash
# 1. アプリケーションのビルド
pnpm run build

# 2. VSCodeでF5キーを押してデバッグ開始
# または、Debug > Start Debugging

# 3. ブレークポイントの設定
# エディタの行番号左をクリック
```

### 2. Chrome DevToolsデバッグ

```bash
# 1. デバッグモードでの起動
node --inspect-brk dist/main.js

# 2. Chromeで以下にアクセス
# chrome://inspect

# 3. "Open dedicated DevTools for Node"をクリック
```

### 3. ログベースデバッグ

```bash
# 1. デバッグレベルでの起動
LOG_LEVEL=debug pnpm run start:dev

# 2. 特定モジュールのログ確認
DEBUG=sokubutsu:* pnpm run start:dev

# 3. ログファイルの監視
tail -f logs/development.log | grep ERROR
```

## 開発ワークフロー

### 1. 機能開発の流れ

```bash
# 1. 新機能ブランチの作成
git checkout -b feature/new-monitoring-feature

# 2. 開発環境の起動
pnpm run start:dev

# 3. 開発・テストサイクル
# - コード変更
# - 自動テスト実行
# - 手動テスト

# 4. コミット前チェック
pnpm run lint
pnpm run test
pnpm run build

# 5. コミット・プッシュ
git add .
git commit -m "feat: add new monitoring feature"
git push origin feature/new-monitoring-feature
```

### 2. コード品質チェック

```bash
# 1. ESLintによる静的解析
pnpm run lint

# 2. Prettierによるフォーマット
pnpm run format

# 3. 型チェック
pnpm run type-check

# 4. 全品質チェック
pnpm run quality-check
```

### 3. パフォーマンステスト

```bash
# 1. 負荷テストの実行
pnpm run test:load

# 2. メモリリークテスト
pnpm run test:memory

# 3. パフォーマンス計測
pnpm run benchmark
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. pnpm install エラー
```bash
# 問題: 依存関係のインストールエラー
# 解決方法:

# 1. キャッシュクリア
pnpm store prune

# 2. node_modulesの削除
rm -rf node_modules pnpm-lock.yaml

# 3. 再インストール
pnpm install

# 4. Node.jsバージョン確認
nvm use 20.18.0
```

#### 2. SQLite3 ビルドエラー
```bash
# 問題: sqlite3モジュールのビルドエラー
# 解決方法:

# 1. better-sqlite3への移行
pnpm remove sqlite3
pnpm add better-sqlite3

# 2. TypeORM設定更新
# src/database/database.config.ts
# type: 'sqlite' → type: 'better-sqlite3'
```

#### 3. Playwright ブラウザエラー
```bash
# 問題: Playwrightでブラウザが起動しない
# 解決方法:

# 1. ブラウザの手動インストール
pnpm exec playwright install chromium

# 2. システム依存関係のインストール
# Ubuntu/WSL2
sudo apt install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2

# macOS
brew install --cask chromium
```

#### 4. ポート競合エラー
```bash
# 問題: ポート3000が既に使用中
# 解決方法:

# 1. 使用中プロセスの確認
lsof -i :3000

# 2. プロセスの停止
kill -9 <PID>

# 3. 別ポートでの起動
PORT=3001 pnpm run start:dev
```

#### 5. Docker関連エラー
```bash
# 問題: Docker コンテナが起動しない
# 解決方法:

# 1. Docker Desktopの再起動
# Windows/macOS: Docker Desktopを再起動

# 2. イメージの再ビルド
docker-compose -f docker-compose.dev.yml build --no-cache

# 3. ボリュームのクリア
docker-compose -f docker-compose.dev.yml down -v
docker system prune -f
```

### パフォーマンス問題

#### 1. 起動時間の最適化
```bash
# 1. TypeScriptコンパイルの高速化
# tsconfig.json に追加
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}

# 2. SWCコンパイラの使用
pnpm add -D @swc/core @swc/cli
```

#### 2. メモリ使用量の最適化
```bash
# 1. Node.jsメモリ制限
node --max-old-space-size=4096 dist/main.js

# 2. 開発時のメモリ監視
NODE_OPTIONS="--max-old-space-size=4096" pnpm run start:dev
```

## 開発環境のメンテナンス

### 1. 定期的な更新

```bash
# 1. 依存関係の更新確認
pnpm outdated

# 2. セキュリティ監査
pnpm audit

# 3. 依存関係の更新
pnpm update

# 4. 脆弱性の修正
pnpm audit --fix
```

### 2. 開発環境のクリーンアップ

```bash
# 1. 不要なnode_modulesの削除
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +

# 2. Dockerイメージのクリーンアップ
docker system prune -a

# 3. pnpmキャッシュのクリア
pnpm store prune

# 4. ログファイルのクリーンアップ
rm -rf logs/*.log
```

### 3. バックアップとリストア

```bash
# 1. 開発環境のバックアップ
tar -czf sokubutsu-dev-backup-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  .

# 2. データベースのバックアップ
cp sokubutsu_dev.sqlite backups/sokubutsu_dev_$(date +%Y%m%d).sqlite

# 3. 設定ファイルのバックアップ
cp .env.development backups/env.development.$(date +%Y%m%d)
```

## チーム開発のベストプラクティス

### 1. 開発環境の統一

```bash
# 1. .nvmrcファイルの使用
echo "20.18.0" > .nvmrc

# 2. package.jsonでのengines指定
{
  "engines": {
    "node": ">=20.18.0",
    "pnpm": ">=8.0.0"
  }
}

# 3. Dockerでの環境統一
# 全開発者が同じDocker環境を使用
```

### 2. コード品質の統一

```bash
# 1. ESLint設定の共有
# .eslintrc.js で統一ルール

# 2. Prettier設定の共有
# .prettierrc で統一フォーマット

# 3. Git Hooksの共有
# Huskyを使用した自動チェック
pnpm add -D husky
pnpm exec husky install
```

### 3. ドキュメントの維持

```bash
# 1. README.mdの更新
# 新機能追加時は必ずREADMEを更新

# 2. API仕様書の更新
# エンドポイント変更時は docs/API.md を更新

# 3. 変更ログの記録
# CHANGELOG.md で変更履歴を管理
```

---

**注意**: この手順書は継続的に更新されます。新しいツールや手法が導入された際は、チーム全体で共有し、ドキュメントを更新してください。

