# アットホーム認証ページ問題の詳細

## 問題の概要
- Docker環境でPuppeteerを使用すると認証ページが表示される
- ローカル環境では正常に動作
- 成功率：15-25%（改善なし）

## 技術的詳細
- Web Components使用: athome-csite-pc-part-rent-business-other-bukken-card
- 認証ページタイトル: "認証にご協力ください。"
- GeeTest CAPTCHA使用の可能性

## 試行済みの対策
1. puppeteer-real-browser → タイムアウト
2. Puppeteer + Stealth Plugin → Docker環境で認証ページ
3. resolveCookies無効化 → 効果なし
4. Web Componentsセレクタ対応 → 認証ページで止まる

## 解決の方向性
- HTTP-firstアプローチの改善に注力すべき
- Puppeteerは最終手段として残す
- Cookie管理とセッション維持の強化が必要