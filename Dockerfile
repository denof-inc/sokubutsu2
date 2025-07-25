# 必要なものが全て揃っているフルバージョンのNode.jsイメージを使用
FROM node:20

# アプリケーションの作業ディレクトリを作成
WORKDIR /usr/src/app

# package.json と package-lock.json (あれば) をコピー
# これでキャッシュが効き、毎回全ライブラリをインストールするのを防ぐ
COPY package.json* ./

# npm を使って依存関係をインストール
# これで sqlite3 がLinux環境で正しくビルドされる
RUN npm install

# アプリケーションのソースコードをコピー
COPY . .

# アプリケーションをビルド
RUN npm run build

# アプリケーションがリッスンするポートを公開
EXPOSE 3000

# コンテナ起動時に実行するコマンド
CMD ["npm", "run", "start:prod"]