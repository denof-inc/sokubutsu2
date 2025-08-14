# 軽量Node.jsイメージを使用
FROM node:24-alpine

# Puppeteer/Chromiumの依存関係をインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Puppeteerに実行可能なChromiumのパスを設定
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 作業ディレクトリ設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー（キャッシュ分離）
COPY package*.json ./

# 依存関係インストール（本番用のみ、prepareスクリプトをスキップ）
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

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

# 不要なファイル削除
RUN rm -rf src/ tsconfig.json node_modules/typescript node_modules/@types

# データディレクトリ作成
RUN mkdir -p data logs

# 非rootユーザー作成・切り替え
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sokubutsu -u 1001 -G nodejs
USER sokubutsu

# ポート公開
EXPOSE 3000 3001

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# アプリケーション起動
CMD ["node", "dist/main.js"]