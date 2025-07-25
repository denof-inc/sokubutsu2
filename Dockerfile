# ---- 1. ビルダー・ステージ ----
# Node.jsの公式イメージをベースにする。'alpine'タグは軽量
FROM node:20-alpine AS builder

# Playwrightのブラウザダウンロードをスキップしてビルド効率化
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# pnpmを有効化
RUN corepack enable

# 作業ディレクトリを設定
WORKDIR /usr/src/app

# 依存関係の定義ファイルをコピー
COPY package.json pnpm-lock.yaml ./

# 開発依存関係も含めて、すべての依存関係をインストール
# --frozen-lockfile は pnpm-lock.yaml との整合性を保証する
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 によりブラウザエンジンはダウンロードされない
RUN pnpm install --frozen-lockfile

# ソースコードをコピー
COPY . .

# TypeScriptをJavaScriptにトランスパイル
RUN pnpm run build

# 本番用の依存関係のみを再インストール
# これにより、devDependenciesが最終イメージから除外される
RUN pnpm prune --prod


# ---- 2. 本番ステージ ----
# 再び軽量なAlpineイメージから開始
FROM node:20-alpine AS production

# 作業ディレクトリを設定
WORKDIR /usr/src/app

# pnpmを有効化
RUN corepack enable

# ビルダー・ステージから必要なファイルのみをコピー
# - package.json, pnpm-lock.yaml: 依存関係情報
# - dist: トランスパイルされたJSコード
COPY --from=builder /usr/src/app/package.json /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/dist ./dist

# 本番用の依存関係のみをインストール
RUN pnpm install --frozen-lockfile --prod

# Playwrightのブラウザエンジン(chromium)とOS依存関係をインストール
# Alpine LinuxでPlaywrightを動作させるために必要な依存関係も同時にインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont && \
    rm -rf /var/cache/apk/*

# Playwrightにchromiumの場所を教える
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# アプリケーションを実行するユーザーを作成し、権限を制限（セキュリティ向上）
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /usr/src/app
USER appuser

# アプリケーションがリッスンするポートを公開
EXPOSE 3000

# アプリケーションの起動コマンド
CMD [ "node", "dist/main.js" ]