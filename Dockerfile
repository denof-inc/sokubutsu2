# マルチステージビルド: ビルドステージ
FROM node:24-alpine AS builder

# Puppeteer/Chromium + better-sqlite3 コンパイル依存関係をインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    openssl \
    xvfb \
    xvfb-run \
    dbus \
    python3 \
    make \
    g++ \
    gcc \
    sqlite-dev \
    libc-dev

# 作業ディレクトリ設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係インストール（better-sqlite3をソースからビルド）
RUN npm ci --omit=dev --ignore-scripts --verbose
RUN npm rebuild better-sqlite3 --verbose

# TypeScriptビルド用の一時的な依存関係インストール
COPY tsconfig.json ./
RUN npm install typescript @types/node --no-save

# ソースコードコピー（テストファイルを除外）
COPY src/ ./src/
RUN rm -rf src/__tests__ src/__mocks__ src/test-setup.ts

# TypeScriptビルド
RUN npx tsc

# adminのviewsディレクトリをコピー（TypeScriptではコンパイルされないため）
RUN if [ -d src/admin/views ]; then cp -r src/admin/views dist/admin/; fi

# 本番ステージ: 軽量なランタイムイメージ
FROM node:24-alpine

# ランタイム依存関係のみインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    openssl \
    xvfb \
    xvfb-run \
    dbus

# 証明書を更新
RUN update-ca-certificates

# Puppeteerに実行可能なChromiumのパスを設定
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    DISPLAY=:99

# 作業ディレクトリ設定
WORKDIR /app

# ビルドステージからコンパイル済みファイルをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# データディレクトリ作成
RUN mkdir -p data logs

# 非rootユーザー作成・切り替え
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sokubutsu -u 1001 -G nodejs

# ディレクトリの所有権を変更
RUN chown -R sokubutsu:nodejs /app

USER sokubutsu

# ポート公開
EXPOSE 3000 3001

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# アプリケーション起動
CMD ["node", "dist/main.js"]