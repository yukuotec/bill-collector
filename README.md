# 记账小助手 (Expense Assistant)

A local-first desktop application for tracking personal expenses from multiple sources (Alipay, WeChat Pay, Yunshanfu, Bank statements).

## Overview

This repository contains a complete expense tracking solution with three components:

1. **Desktop App** (`/`) - Electron-based GUI application
2. **Collector CLI** (`/collector`) - Command-line tool for streamlining data collection
3. **Documentation** (`/docs`) - Architecture decisions, feature specs, and plans

## Quick Start

### Desktop App

```bash
# Install dependencies
npm install

# Development (runs Vite + Electron)
npm run dev

# Build for production
npm run build
npm run dist  # Package with electron-builder
```

### Collector CLI

```bash
cd collector
npm install
npm run build
npm link  # Optional: makes `collector` command available globally

# Check data source freshness
collector status

# Open export page
collector open alipay
collector open wechat

# Watch dropbox folder for auto-archive
collector watch
```

## Features

### Phase 1: Core Expense Tracking ✅
- Multi-source import (Alipay, WeChat, Yunshanfu, Bank CSV/PDF)
- Smart deduplication (exact, same-period, cross-platform)
- Auto-categorization with keyword rules
- Family member management and assignment
- Dashboard with charts and drill-down
- Budget management with alerts
- Email auto-capture (IMAP)
- Multi-account support
- CLI tool for batch operations

### Phase 2: Data Collection Enhancement ✅
- Source Coverage page - monthly grid showing import status
- Dashboard widget - at-a-glance freshness indicators
- Import hints - step-by-step export instructions
- Click-through to filtered transactions

### Phase 3: Collector CLI ✅
- `collector status` - Show freshness for all sources
- `collector open <source>` - Open export pages
- `collector guide <source>` - Export instructions
- `collector watch` - Auto-archive imported files
- `collector remind` - Cron-friendly stale checks

## Project Structure

```
expense-tracker/
├── src/
│   ├── main/           # Electron main process (database, IPC)
│   ├── renderer/       # React frontend (pages, components)
│   ├── parsers/        # CSV/PDF parsers for each source
│   ├── shared/         # Types, constants, utilities
│   └── cli.ts          # CLI entry point
├── collector/          # Phase 3 - Collection helper CLI
│   ├── src/commands/   # CLI command implementations
│   ├── src/config.ts   # Source configurations
│   └── README.md       # Collector-specific docs
├── docs/               # Documentation
│   ├── plans/          # Phase designs
│   ├── features/       # Feature specs
│   └── guides/         # Usage guides
├── tests/              # Test files
└── dist/               # Build output
```

## Architecture

- **Framework**: Electron + React + TypeScript
- **Database**: SQLite via sql.js (embedded, local-first)
- **Build**: Vite (renderer) + tsc (main)
- **Testing**: Node.js built-in test runner

## Commands Reference

### Development

```bash
npm run dev           # Start dev server + Electron
npm run build         # Build production
npm run test          # Run all tests
npm run test:parsers  # Run parser tests
npm run dist          # Package app
```

### CLI

```bash
# From project root
node dist/cli.js import <file> --source alipay
node dist/cli.js list --month 2025-03
node dist/cli.js export --excel --output backup.xlsx

# From collector/
collector status
collector open alipay
collector watch
```

## Documentation

- [Development Plan](PLAN.md) - Phase-based roadmap
- [SPEC.md](SPEC.md) - Detailed product specification
- [CLAUDE.md](CLAUDE.md) - Guidance for Claude Code
- [docs/README.md](docs/README.md) - Documentation index

## License

MIT
