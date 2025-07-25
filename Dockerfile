# ---- 1. ビルダー・ステージ ----
# Node.jsの公式イメージをベースにする。'alpine'タグは軽量
FROM node:20-alpine AS builder

# pnpmを有効化
RUN corepack enable

# 作業ディレクトリを設定
WORKDIR /usr/src/app

# 依存関係の定義ファイルをコピー
COPY package.json pnpm-lock.yaml ./

# 開発依存関係も含めて、すべての依存関係をインストール
# --frozen-lockfile は pnpm-lock.yaml との整合性を保証する
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

# ビルダー・ステージから必要なファイルのみをコピー
# - package.json: 実行に必要
# - dist: トランスパイルされたJSコード
# - node_modules: 本番用の依存関係
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

# アプリケーションを実行するユーザーを作成し、権限を制限（セキュリティ向上）
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# アプリケーションがリッスンするポートを公開
EXPOSE 3000

# アプリケーションの起動コマンド
CMD [ "node", "dist/main.js" ]