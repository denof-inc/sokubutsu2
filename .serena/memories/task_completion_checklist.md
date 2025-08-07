# Task Completion Checklist - ソクブツMVP

## Required Steps When Completing a Task

### 1. Code Quality Verification
**Always run these commands before considering a task complete:**

```bash
# Step 1: Auto-fix formatting and linting issues
npm run format          # Prettier formatting
npm run lint            # ESLint auto-fix

# Step 2: Verify no remaining issues
npm run typecheck       # TypeScript type checking
npm run lint:check      # ESLint check (no fix)

# Step 3: Run tests
npm test                # Run all tests

# Step 4: Final quality check
npm run quality:check   # Comprehensive check (lint + typecheck + test)
```

### 2. Test Coverage
- Ensure test coverage remains above 70%
- Run `npm run test:coverage` to check
- Add tests for new features/bug fixes

### 3. Performance Validation
For scraping-related changes:
- Run `npm run manual:test` to verify performance
- Check execution time: Should be 2-5 seconds
- Check memory usage: Should be 30-50MB

### 4. Documentation Updates
If applicable:
- Update README.md for user-facing changes
- Update code comments for complex logic
- Update CLAUDE.md for AI operation rules

### 5. Git Workflow
```bash
# Create feature branch
git checkout -b feature/description

# Stage changes
git add .

# Commit (will trigger pre-commit hooks)
git commit -m "feat: description of change"

# Push to remote
git push origin feature/description
```

### 6. CI/CD Verification
After pushing:
- Check GitHub Actions pass
- Verify all quality checks succeed
- Ensure Docker build succeeds (if applicable)

## Common Issues to Check

### Before Committing
- [ ] No ESLint errors
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] No console.log statements (use vibelogger instead)
- [ ] No hardcoded secrets or API keys
- [ ] Imports use .js extension

### Quality Standards
- [ ] Test coverage ≥ 70%
- [ ] ESLint errors: 0
- [ ] TypeScript any usage: 0 (except tests)
- [ ] Execution time: 2-5 seconds (for scraping)
- [ ] Memory usage: 30-50MB (for scraping)

## Quick Verification Command
Run this single command for complete verification:
```bash
npm run quality:check && npm run manual:test
```

If both commands succeed, the task is likely complete and ready for review.