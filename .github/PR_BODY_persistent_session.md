## 目的

監視の成功率と安定性を高めるため、突破済みブラウザを維持して5分ごとに軽量に再確認できる「持続セッション方式」の下地を追加します。再認証が発生しやすい環境でも、突破後のセッションを活かして安定運用することを狙いとします。

## 変更概要

- 新規: 持続セッション管理 `SessionManager` を追加（src/utils/session-manager.ts）
  - 同一 Browser/Context/Page を維持
  - TTL（既定120分）超過で再生成
  - 認証ページ検出の連続回数（既定2回）で再生成
  - 画像/動画/フォントのブロックで軽量化
  - 軽い自然化（スクロール＋短待機）とウォームアップ（Google→対象）
- Scraper配線（フラグON時のみ）
  - `SimpleScraper` がまず持続セッションで `reload` 取得→cheerioで軽量抽出
  - 失敗/認証検出時は `PuppeteerScraper` にフォールバック
- 設定フラグ（.env.example へ追記、既定OFF）
  - `PERSISTENT_BROWSER_ENABLED=false`
  - `PERSISTENT_BROWSER_TTL_MINUTES=120`
  - `AUTH_CONSECUTIVE_MAX=2`
  - `BLOCK_MEDIA_RESOURCES=true`
- リソース前提
  - `docker-compose.yml` のメモリ上限を 512MB に引き上げ（1タブ運用を想定）

## 挙動と互換性

- 既定はOFFのため、従来の挙動・CIともに非影響（完全後方互換）
- フラグON時のみ持続セッション経由の軽量確認→失敗時に既存Puppeteerへフォールバック

## 有効化方法（開発/本番）

1) `.env` / `.env.production` に以下を追加
```
PERSISTENT_BROWSER_ENABLED=true
PERSISTENT_BROWSER_TTL_MINUTES=120
AUTH_CONSECUTIVE_MAX=2
BLOCK_MEDIA_RESOURCES=true
```
2) Dockerメモリ上限（512MB）で起動
```
docker compose up -d sokubutsu-mvp
```

## 検証観点

- ログで以下を確認
  - `session.created`: セッション生成
  - `scraping.success.persistent`: 持続セッションでの抽出成功
  - `session.auth_detected`: 認証ページ検出（連続数）
  - `session.recreate`: 連続認証に伴う再生成
- Telegram `/check` が応答し、失敗が続く際にもフォールバックで監視継続

## リスク/留意点

- メモリ: 1タブあたり 150–250MB 目安（遮断込み）。複数URLは段階導入
- 長寿命セッションの“毒化”に対し、TTL/連続認証の再生成ルールで自動回復
- 監視対象が増える場合はタブプール/レート制御が必要（次段で対応）

## 今後（段階導入計画）

- フェーズ2: 複数URL向けタブプール（上限2–3）と負荷調整
- フェーズ3: 連続失敗時のみ Real Browser フォールバック（重いため常用は避ける）
- 運用補助: `/session reset` コマンド追加（手動で再生成）

## 変更ファイル（主なもの）

- `src/utils/session-manager.ts`: 新規（持続セッション）
- `src/scraper.ts`: フラグON時のセッション利用→抽出→フォールバック
- `.env.example`: フラグ群追加
- `docker-compose.yml`: メモリ上限 512MB

