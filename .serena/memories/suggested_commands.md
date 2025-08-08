# Development Commands - ソクブツMVP

## Daily Development Commands

### Start Development
```bash
npm run start:dev          # 開発モード起動
npm run start:dev:watch    # 開発モード（ファイル監視付き）
npm run start:multiuser:dev # マルチユーザーモード開発起動
npm run manual:test        # 手動テスト実行（動作確認用）
```

### Testing
```bash
npm test                   # テスト実行
npm run test:watch         # テスト監視モード
npm run test:coverage      # カバレッジ付きテスト
npm run test:ci            # CI用テスト（最大2ワーカー）
```

### Code Quality
```bash
npm run lint               # ESLint実行・自動修正
npm run lint:check         # ESLint実行（修正なし）
npm run format             # Prettier自動フォーマット
npm run format:check       # Prettierチェック（修正なし）
npm run typecheck          # TypeScript型チェック
npm run typecheck:watch    # TypeScript型チェック（監視モード）
npm run quality:check      # 総合品質チェック（lint + typecheck + test）
npm run quality:fix        # 品質自動修正（format + lint）
```

### Build & Production
```bash
npm run build              # TypeScriptビルド
npm run build:watch        # ビルド（監視モード）
npm start                  # 本番モード起動
```

### Docker Operations
```bash
npm run docker:build       # Dockerイメージビルド
npm run docker:run         # Docker Compose起動
npm run docker:stop        # Docker Compose停止
docker-compose logs -f     # ログリアルタイム確認
```

### Clean & Maintenance
```bash
npm run clean              # ビルド成果物・ログ削除
npm run prepare            # Husky設定（自動実行）
```

## Git Hooks (automatic)
- pre-commit: lint-staged (ESLint + Prettier on staged files)

## System Commands (Darwin/macOS)
```bash
ls -la                     # ファイル一覧（隠しファイル含む）
cat file.txt               # ファイル内容表示
tail -f logs/app.log       # ログファイル監視
grep -r "pattern" .        # パターン検索
find . -name "*.ts"        # ファイル検索
```

## Task Completion Checklist
When finishing a task, always run:
1. `npm run lint` - Fix linting issues
2. `npm run typecheck` - Ensure no type errors
3. `npm test` - Verify all tests pass
4. `npm run quality:check` - Final quality verification