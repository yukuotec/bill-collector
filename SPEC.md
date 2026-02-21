# 记账软件 (Expense Tracker) - SPEC.md

## Project Overview

**Project Name:** 记账小助手 (Expense Assistant)  
**Type:** Desktop Application (Local-First)  
**Core Functionality:** Collect, consolidate, and analyze personal expenses from multiple sources (Alipay, WeChat Pay, Yunshanfu) with automatic deduplication.  
**Target Users:** Individual users who want unified visibility into their spending across payment platforms.

---

## Core Features

### 1. Data Import

| Source | Format | Parser |
|--------|--------|--------|
| Alipay | CSV (支付宝账单) | alipay-parser |
| WeChat Pay | CSV (微信支付账单) | wechat-parser |
| Yunshanfu | CSV (云闪付账单) | yunshanfu-parser |

- Manual CSV file selection via file dialog
- Drag-and-drop support
- Parse and validate CSV structure

### 2. Deduplication Engine

**Exact Match:**
- Same date (±0 days)
- Same amount
- Same counterparty/description

**Fuzzy Match:**
- Same date (±1 day)
- Same amount
- Similar description (Levenshtein distance ≤ 3)

**Conflict Resolution:**
- Auto-merge for exact matches
- Flag fuzzy matches for manual review
- User can choose "keep both" or "merge"

### 3. Categorization

**Auto-tagging rules** (keyword-based):
- 餐饮 (Food): 饿了么, 美团, 肯德基, 麦当劳, 火锅, 烧烤...
- 交通 (Transport): 滴滴, 地铁, 公交, 出租车, 高铁...
- 购物 (Shopping): 淘宝, 京东, 拼多多, 天猫...
- 住房 (Housing): 房租, 物业, 水电...
- 医疗 (Healthcare): 药店, 医院, 门诊...
- 娱乐 (Entertainment): 电影, KTV, 游戏, 演出...
- 通讯 (Communication): 话费, 流量...
- 其他 (Other): fallback category

**Manual override:** User can reassign category per transaction.

### 4. Dashboard

- **Monthly Summary:** Total spending by month
- **Category Breakdown:** Pie chart of spending by category
- **Top Merchants:** Most frequent counterparties
- **Trend Chart:** Monthly spending over time (line chart)

### 5. Data Management

- **SQLite** local database (no cloud sync)
- **Export:** Excel (.xlsx), CSV
- **Backup:** Manual database export
- **Search:** Full-text search on description/notes

---

## Data Schema

### Transaction Table

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,           -- 'alipay' | 'wechat' | 'yunshanfu'
  original_id TEXT,               -- Original ID from source
  date TEXT NOT NULL,              -- ISO date (YYYY-MM-DD)
  amount REAL NOT NULL,            -- Positive for income, negative for expense
  type TEXT NOT NULL,              -- 'expense' | 'income' | 'transfer'
  counterparty TEXT,               -- Merchant/name
  description TEXT,                -- Original description
  category TEXT DEFAULT '其他',     -- Auto-tagged category
  notes TEXT,                      -- User notes
  is_duplicate INTEGER DEFAULT 0, -- 1 if marked as duplicate
  merged_with TEXT,               -- ID of merged transaction
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Import History Table

```sql
CREATE TABLE imports (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  file_name TEXT,
  record_count INTEGER,
  imported_at TEXT NOT NULL
);
```

---

## Tech Stack

- **Framework:** Electron + React + TypeScript
- **Database:** SQLite (better-sqlite3)
- **CSV Parsing:** papaparse
- **Charts:** Recharts
- **Build Tool:** Vite + electron-builder

---

## File Structure

```
expense-tracker/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts
│   │   ├── database.ts
│   │   └── ipc.ts
│   ├── renderer/      # React frontend
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   └── styles/
│   ├── shared/        # Shared types & utilities
│   │   ├── types.ts
│   │   └── constants.ts
│   └── parsers/       # CSV parsers for each source
│       ├── alipay.ts
│       ├── wechat.ts
│       └── yunshanfu.ts
├── resources/         # App icons
├── package.json
├── electron-builder.json
├── vite.config.ts
└── tsconfig.json
```

---

## Milestones

### MVP (Week 1)
- [x] Project scaffolding
- [x] CSV import parsers (支付宝/微信/云闪付) - 增强支持真实账单格式
- [x] CSV import UI + IPC (file dialog, drag-drop, parse, save to DB, preview, dry-run)
- [x] Basic deduplication (exact match) + fuzzy match flagging
- [x] Transaction list view (with filtering/pagination, sorting, search)
- [x] Monthly summary (Dashboard with charts, year filter, top merchants)

### Phase 2 (Week 2)
- [x] Fuzzy deduplication (review UI in Transactions page)
- [x] Auto-categorization (keyword-based)
- [x] Category filtering (in Transactions page)

### Phase 3 (Week 3)
- [x] Dashboard charts (trend, pie chart, top merchants)
- [x] Export functionality (CSV + Excel .xlsx)
- [x] Manual category override (dropdown in transaction list)

### Phase 4 (Enhanced)
- [x] CLI tool (import/list/export/summary/backup)
- [x] Enhanced deduplication (exact/same_period/cross_platform)
- [x] Data traceability (import_id, original_source, duplicate_source)
- [x] Refund detection and linking
- [x] Bank statement parser
- [x] S3 backup support

### Future (Post-MVP)
- [ ] Auto-collection (web scraping / notification capture)
- [ ] Budget alerts
- [ ] Multi-currency support

---

## CLI Commands

```bash
# 安装后使用
expense-cli import <file> --source alipay|wechat|yunshanfu|bank
expense-cli list --category --source --month --duplicate-type --refund-only --limit
expense-cli export --csv|--excel --output <file> --start-date --end-date
expense-cli summary --year --month
expense-cli backup --output <file>                    # 本地备份
expense-cli backup --target s3 --s3-uri s3://bucket/path  # S3备份
```
