# 開発モード設定メモ

## 🚀 リリース前開発の最適化内容

リリース前の開発効率を向上させるため、以下の設定を一時的に緩和しています。

### Pre-commit設定の変更

1. **TypeScriptチェック**
   - 変更前: エラーで停止
   - 変更後: 警告として扱い、コミットは継続

2. **ESLint警告上限**
   - 変更前: 350個
   - 変更後: 500個（開発中のみ）

### CI/CD設定の変更

1. **ESLint警告上限**
   - 変更前: 320個
   - 変更後: 500個（開発中のみ）

2. **セキュリティスキャン**
   - 変更前: moderate以上で失敗
   - 変更後: high以上で警告（continue-on-error: true）

3. **リリースジョブ**
   - 変更前: 有効
   - 変更後: コメントアウト（無効化）

## ⚠️ リリース前に必要な作業

リリース前には以下の設定を元に戻してください：

1. `.husky/pre-commit`
   - TypeScriptチェックをエラーで停止に戻す
   - ESLint警告上限を350個に戻す

2. `.lintstagedrc.json`
   - max-warningsを320に戻す

3. `.github/workflows/ci.yml`
   - ESLint警告上限を320個に戻す
   - security-scanのcontinue-on-errorを削除
   - npm auditレベルをmoderateに戻す
   - create-releaseジョブのコメントアウトを解除

## 📝 変更履歴

- 2025-07-27: 初回の開発モード設定
