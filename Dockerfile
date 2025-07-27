# 軽量なNode.jsイメージを使用
FROM node:20-alpine

# 作業ディレクトリ設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー（キャッシュ効率化）
COPY package*.json ./

# 本番用依存関係のみインストール
RUN npm ci --only=production && npm cache clean --force

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm install -g typescript && \
    npm run build && \
    npm uninstall -g typescript

# 不要なファイルを削除
RUN rm -rf src/ tsconfig.json

# 非rootユーザーで実行
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sokubutsu -u 1001

# データディレクトリの権限設定
RUN mkdir -p /app/data /app/logs && \
    chown -R sokubutsu:nodejs /app/data /app/logs

USER sokubutsu

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# アプリケーション起動
EXPOSE 3000
CMD ["node", "dist/main.js"]