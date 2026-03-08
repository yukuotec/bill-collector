# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**记账小助手 (Expense Assistant)** - A local-first Electron desktop application for tracking personal expenses from multiple sources (Alipay, WeChat Pay, Yunshanfu, Bank statements). Features include automatic deduplication, family member assignment, budget management, and dashboard analytics.

## Build & Development Commands

```bash
# Development (runs Vite dev server + Electron)
npm run dev

# Build for production
npm run build              # Builds both Vite renderer and Electron main
npm run build:vite         # Build renderer only
npm run build:electron     # Build main process only (tsc)

# Testing
npm test                   # Run all tests
npm run test:parsers       # Run parser tests (requires build:electron first)
npm run test:react         # Run React component tests
npm run test:database      # Run database tests
node --test tests/<specific>.test.js   # Run single test file

# Distribution
npm run dist               # Build and package with electron-builder
npm start                  # Run production build
```

## Architecture

### Electron Process Model

**Main Process** (`src/main/`)
- `index.ts` - Entry point, window creation, app lifecycle
- `ipc.ts` - IPC handlers for all renderer-to-main communication
- `database.ts` - SQLite database operations using sql.js
- `preload.ts` - Context bridge exposing `window.electronAPI`

**Renderer Process** (`src/renderer/`)
- `App.tsx` - Main React component with navigation state
- `pages/*.tsx` - Page components (Dashboard, Transactions, Import, etc.)
- `main.tsx` - React entry point

**Shared** (`src/shared/`)
- `types.ts` - TypeScript interfaces used by both main and renderer
- `constants.ts` - Category keywords, triage rules
- `drilldown.ts` - URL hash-based navigation utilities

**Parsers** (`src/parsers/`)
- `alipay.ts`, `wechat.ts`, `yunshanfu.ts`, `bank.ts` - CSV parsers
- `pdf.ts`, `html.ts`, `ocr.ts` - Alternative import formats

### Database Architecture

SQLite via sql.js (embedded, file-based):
- **Location**: `~/Library/Application Support/expense-tracker/expenses.db` (macOS)
- **Schema**: See `src/main/database.ts:ensureSchema()` for table definitions
- **Key tables**: `transactions`, `members`, `accounts`, `budgets`, `email_accounts`, `assignment_patterns`

### IPC Communication Pattern

All main-renderer communication goes through `window.electronAPI`:
- Preload script exposes methods that call `ipcRenderer.invoke()`
- Main process handlers registered in `ipc.ts` via `ipcMain.handle()`
- Browser fallback API in `preload.ts` for web-only development

### TypeScript Configuration

- **Renderer**: `tsconfig.json` - ES2020, React JSX, path alias `@/*`
- **Main**: `tsconfig.main.json` - Node.js target, separate from renderer
- Both configs reference shared types but compile independently

## Key Implementation Details

### Import Pipeline

1. File selected → `selectFile` IPC → Electron dialog
2. Parser chosen by source type (`alipay` | `wechat` | `yunshanfu` | `bank`)
3. CSV parsed with PapaParse (handles various encodings)
4. Deduplication: exact matches auto-merged, fuzzy matches flagged
5. Triage rules applied for member assignment
6. Transactions inserted with `import_id` for traceability

### Deduplication Strategy

- **Exact**: Same date, amount, counterparty → auto-merge
- **Same Period**: ±1 day, same amount, similar description → flag for review
- **Cross Platform**: ±3 days, different source, similar merchant → flag for review

### Navigation

Uses URL hash routing (not React Router):
- `location.hash` changes trigger page switches in `App.tsx`
- Drilldown navigation uses query params: `#transactions?category=餐饮&year=2025`
- Utility functions in `drilldown.ts` for building/parsing URLs

### Testing Strategy

- **Parser tests**: Run against compiled JS in `dist/`, test real-world CSV formats
- **Database tests**: Use actual SQLite instance, clean up test data after
- **React tests**: JSDOM environment, Testing Library, minimal component tests

## Development Notes

- **Hot reload**: Vite HMR on port 5173, Electron loads from dev server
- **PWA**: vite-plugin-pwa configured but disabled in development
- **CLI**: `expense-cli` command available after build, defined in `src/cli.ts`
- **sql.js**: Must unpack ASAR for sql.js to work (see `electron-builder.json`)

## Documentation Structure

- `SPEC.md` - Product specification
- `PLAN.md` - Development phases and roadmap
- `docs/plans/` - Phase-specific design documents
- `docs/features/` - Feature documentation
- `docs/guides/` - CLI and usage guides
