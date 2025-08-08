# Project Overview - ソクブツMVP

## Purpose
新着物件通知サービス - 不動産サイト(athome.co.jp)の新着物件を監視し、Telegramで即座に通知するMVPサービス

## Tech Stack
- **Language**: TypeScript (ES2022, strict mode)
- **Runtime**: Node.js (>=18.0.0)
- **Module System**: ESM (ES Modules)
- **Database**: SQLite (better-sqlite3) + TypeORM
- **Web Framework**: Express v5
- **Scraping**: axios + cheerio (HTTP-first strategy)
- **Notification**: Telegraf (Telegram Bot API)
- **Scheduler**: node-cron
- **Logging**: vibelogger (AI-friendly structured logging)
- **Testing**: Jest (v30) with ts-jest
- **Linting**: ESLint + @typescript-eslint
- **Formatting**: Prettier
- **Container**: Docker + docker-compose
- **Process Management**: tsx for development

## Architecture Overview
```
src/
├── main.ts              # メインエントリーポイント
├── main-multiuser.ts    # マルチユーザーモード
├── config.ts            # 設定管理
├── types.ts             # 型定義
├── logger.ts            # ログ管理 (vibelogger)
├── performance.ts       # パフォーマンス監視
├── scraper.ts           # スクレイピング (SimpleScraper class)
├── telegram.ts          # Telegram通知
├── storage.ts           # データ保存
├── scheduler.ts         # 監視スケジューラー
├── manual-test.ts       # 手動テスト
├── property-monitor.ts  # 物件監視
├── admin/               # 管理画面機能
├── database/            # DB設定・マイグレーション
├── entities/            # TypeORMエンティティ
├── services/            # ビジネスロジック層
├── telegram/            # Telegram関連
├── types/               # 型定義拡張
├── utils/               # ユーティリティ
└── __tests__/           # テストファイル
```

## Key Features
- HTTP-first戦略によるスクレイピング（2-5秒、30-50MB）
- 最新3件固定の新着物件監視
- マルチユーザー対応モード
- パフォーマンス監視機能
- 統計レポート機能（1時間ごと）
- Docker対応（メモリ256MB、CPU 0.5コア制限）