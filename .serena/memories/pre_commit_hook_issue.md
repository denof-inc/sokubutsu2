# Pre-commit Hook問題の解決策

## 問題
- huskyのpre-commitが全ソースファイルをlint/typecheckしている
- addされていないunstaged changesのせいでコミットが失敗
- --no-verifyは品質劣化防止ルールで禁止

## 現在の設定状況
- package.jsonにlint-stagedが正しく設定済み
- precommitスクリプト: "lint-staged"
- lint-staged設定: staged filesのみをチェック

## 解決策
huskyのpre-commitをlint-stagedを使うように修正:

```bash
# 現在の.husky/pre-commit (問題)
npm run lint:check  # 全ファイルをチェック
npm run typecheck   # 全ファイルをチェック

# 修正後の.husky/pre-commit (正解)
npm run precommit   # lint-stagedでstaged filesのみチェック
```

## 実装手順
1. .husky/pre-commitを修正してlint-stagedを使用
2. staged filesのみの品質チェックを実現
3. unstaged changesは影響しない正常なコミットフローに修正