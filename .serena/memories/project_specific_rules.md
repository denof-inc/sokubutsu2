# Project-Specific Rules & Guidelines - ソクブツMVP

## CLAUDE.md Rules (AI Operation)

### AI運用5原則
1. ファイル生成・更新・プログラム実行前に必ず作業計画を報告し、y/n確認を取る
2. 迂回や別アプローチを勝手に行わず、失敗時は次の計画の確認を取る
3. AIはツールであり決定権は常にユーザーにある
4. ルールの歪曲・解釈変更は禁止
5. 全チャットの冒頭に5原則を逐語的に出力

### Quality Standards
- Test coverage: 80%以上を維持
- ESLint errors: 0件
- TypeScript any型: 使用禁止
- 主要クラスの冒頭に設計ドキュメントへの参照を記載

### Logging Requirements
- Use vibelogger for all logging
- Structure logs for AI readability
- Include step, process, context, TODO information
- Debug outputs go to ./logs directory

## Scraping Strategy Rules

### HTTP-first Strategy (STRICT)
1. **Stage 1**: HTTP-only (axios + cheerio) - 2-5秒、30-50MB
2. **Stage 2**: jsdom - 5-10秒、80-120MB (if needed)
3. **Stage 3**: Playwright - 15-25秒、200-300MB (last resort)

### athome.co.jp Special Rules
- **Google経由処理禁止**: 過剰最適化として扱う
- **HTTP-only優先**: サーバーサイドレンダリング済み
- **処理時間目標**: 2-5秒（17.1秒からの改善必須）

### New Property Monitoring
- **最新3件固定**: 効率性とのバランス
- **署名生成ロジック変更禁止**: 互換性維持
- **ハッシュ方式**: タイトル+価格+所在地

## Development Workflow

### Standard Task Execution
1. Create branch: `feature/name` or `fix/name`
2. Make changes following rules
3. Run quality checks
4. Create commit
5. Create Pull Request

### Issue-related PRs
Must include auto-close keywords:
- `Closes #XX` - General issues
- `Fixes #XX` - Bug fixes
- `Resolves #XX` - Feature implementations

## Code Duplication Monitoring
- Tool: similarity-ts (requires Rust)
- Frequency: Monthly minimum
- Command: `similarity-ts .`
- Threshold: 90% similarity requires review

## Performance Requirements

### Metrics
- Startup time: 1-2 seconds
- Memory usage: 30-50MB (runtime)
- Execution time: 2-5 seconds (scraping)
- Dependencies: 12 packages maximum

### Docker Limits
- Memory: 256MB
- CPU: 0.5 cores
- Log rotation: 10MB × 3 files

## Multi-User Mode
- Environment variable: `MULTI_USER_MODE=true`
- Separate database per user
- User management via admin interface
- Telegram bot handles multiple chats

## Testing Requirements
- Jest with ESM support
- NODE_OPTIONS='--experimental-vm-modules'
- Test files: `*.test.ts` or `*.spec.ts`
- Mock carefully for ESM environment

## Security Rules
- No hardcoded secrets
- Use environment variables
- No logging of sensitive data
- Validate all user inputs
- Sanitize scraping outputs

## Important Files
- `.env`: Environment configuration (never commit)
- `CLAUDE.md`: AI operation rules
- `docs/`: Design documents and guides
- `logs/`: Application logs (gitignored)
- `data/`: Persistent data storage