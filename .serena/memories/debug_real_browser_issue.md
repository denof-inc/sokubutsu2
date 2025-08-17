# Real Browser呼び出し問題の調査結果（2025-08-17）

## 問題の詳細
1. 認証ページは検出されている（"認証ページが検出されました"のログが出力）
2. しかしReal Browserにフォールバックせず、セレクター検索に進んでいる
3. これはresolveCookies()が何か値を返していることを示唆

## 現在のフロー
1. HTTP-firstで認証ページ検出 ✓
2. config.auth.resolveEnabled = true（デフォルト）
3. resolveCookies()を呼び出し
4. resolveCookies()がcookie文字列を返す（nullではない）
5. 結果、Real Browserが呼ばれない

## 修正内容
- ローカル: resolveCookies()をnull返却に修正済み
- Dockerイメージ: 最新ビルドには修正が含まれている
- 実行コンテナ: 最新イメージで再起動済み

## 次の確認ポイント
1. resolveCookies()が実際にnullを返しているか
2. config.auth.resolveEnabledの設定値
3. Real Browser初期化時のエラー有無