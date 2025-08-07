# Code Style & Conventions - ソクブツMVP

## TypeScript Conventions
- **Target**: ES2022
- **Module System**: ES Modules (ESM)
- **Strict Mode**: Enabled (all strict flags)
- **Type Safety**:
  - `noImplicitAny`: true
  - `strictNullChecks`: true
  - `noUncheckedIndexedAccess`: true
  - any型使用禁止（テストファイル除く）

## Code Style

### Formatting (Prettier)
- Semi-colons: Yes
- Single quotes: Yes
- Print width: 100 characters
- Tab width: 2 spaces
- Arrow parens: Avoid when possible
- Trailing comma: ES5 style

### Naming Conventions
- Classes: PascalCase (e.g., `SimpleScraper`, `MonitoringScheduler`)
- Functions/Methods: camelCase (e.g., `scrapeAthome`, `fetchWithRetry`)
- Constants: UPPER_SNAKE_CASE (for exports) or camelCase (local)
- Files: kebab-case for general files, PascalCase for classes
- Interfaces/Types: PascalCase with descriptive names

### Import Style
- ES Module imports only (no require)
- Use `.js` extension for local imports (even for TypeScript files)
- Example: `import { config } from './config.js';`

## ESLint Rules

### Error Level (Must Fix)
- No floating promises
- No misused promises
- Await thenable
- Require await
- No unused variables

### Warning Level (Should Fix)
- No explicit any
- No unsafe operations
- Prefer readonly
- Prefer nullish coalescing
- Prefer optional chain

### Test Files Exception
- `any` type allowed
- Unsafe operations allowed

## Project-Specific Conventions

### Logging
- Use vibelogger for structured logging
- Include context, humanNote, and aiTodo where applicable
- Log levels: error, warn, info, debug
- Example:
```typescript
vibeLogger.info('component.action', 'Description', {
  context: { key: 'value' },
  humanNote: 'Human-readable explanation',
  aiTodo: 'AI action suggestion'
});
```

### Error Handling
- Always use try-catch for async operations
- Type check errors with `instanceof Error`
- Provide meaningful error messages
- Log errors with full context

### Comments
- Japanese comments allowed (project is Japanese-focused)
- Keep comments minimal and meaningful
- Document complex business logic
- Add reference comments to design docs for main classes

### File Structure
- One main export per file
- Group related functionality
- Separate concerns (config, types, services)
- Use barrel exports sparingly