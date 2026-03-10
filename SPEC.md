# 记账软件 (Expense Tracker) - SPEC.md

## Project Overview

**Project Name:** 记账小助手 (Expense Assistant)  
**Type:** Desktop Application (Local-First)  
**Core Functionality:** Collect, consolidate, and analyze personal expenses from multiple sources (Alipay, WeChat Pay, Yunshanfu, Bank statements) with automatic deduplication, family member management, and smart assignment capabilities.  
**Target Users:** Individual users and families who want unified visibility into their spending across payment platforms with advanced collaboration features.

---

## Core Features

### 1. Data Import

| Source | Format | Parser |
|--------|--------|--------|
| Alipay | CSV (支付宝账单) | alipay-parser |
| WeChat Pay | CSV (微信支付账单) | wechat-parser |
| Yunshanfu | CSV (云闪付账单) | yunshanfu-parser |
| Bank Statements | CSV/PDF | bank-parser |

- Manual file selection via file dialog
- Drag-and-drop support
- Parse and validate CSV/PDF structure
- Preview before import with dry-run mode
- Column mapping detection for various CSV formats

### 2. Family Member Management

- **Member Management:** Add, edit, delete family members with custom colors
- **Transaction Assignment:** Assign transactions to specific family members
- **Smart Assignment:** Automatically suggest member assignments based on learned patterns
- **Batch Assignment:** Apply assignments to similar transactions with confirmation prompt
- **Triage Rules:** Keyword-based automatic assignment rules (e.g., "游戏" → "老公", "化妆品" → "老婆")

### 3. Deduplication Engine

**Exact Match:**
- Same date (±0 days)
- Same amount
- Same counterparty/description

**Fuzzy Match:**
- Same period (±3 days, same source): Similar counterparty/description
- Cross-platform (±3 days, different source): Similar merchant names

**Conflict Resolution:**
- Auto-merge for exact matches
- Flag fuzzy matches for manual review
- User can choose "keep both" or "merge"
- Duplicate review interface with side-by-side comparison

### 4. Categorization & Tagging

**Auto-categorization** (keyword-based):
- 餐饮 (Food): 饿了么, 美团, 肯德基, 麦当劳, 火锅, 烧烤...
- 交通 (Transport): 滴滴, 地铁, 公交, 出租车, 高铁...
- 购物 (Shopping): 淘宝, 京东, 拼多多, 天猫...
- 住房 (Housing): 房租, 物业, 水电...
- 医疗 (Healthcare): 药店, 医院, 门诊...
- 娱乐 (Entertainment): 电影, KTV, 游戏, 演出...
- 通讯 (Communication): 话费, 流量...
- 其他 (Other): fallback category

**Manual Features:**
- Manual category override per transaction
- Custom tags management (add/remove tags)
- Inline notes editing (click to edit)

### 5. Dashboard & Analytics

- **Monthly Summary:** Total spending by month with trend analysis
- **Annual Summary:** Yearly expense/income/net overview
- **Category Breakdown:** Interactive pie chart of spending by category
- **Top Merchants:** Most frequent counterparties with total amounts
- **Member Statistics:** Spending breakdown by family member
- **Budget Alerts:** Visual indicators for budget status (ok/warning/exceeded)
- **Trend Charts:** Monthly spending over time with percentage changes
- **Drill-down Analysis:** Click category/top merchant/member to jump to filtered transaction details (carries active date range with removable context chips)

### 6. Email Integration

- **Email Account Management:** Add/configure IMAP email accounts
- **Automatic Email Sync:** Fetch emails containing billing keywords
- **Attachment Processing:** Automatically download PDF/image attachments from billing emails
- **Email Message Tracking:** View processed/unprocessed email messages

### 7. Data Management

- **SQLite** local database (no cloud sync required)
- **Export:** Excel (.xlsx), CSV formats
- **Backup:** Manual database export + S3 cloud backup support
- **Search:** Full-text search on description/counterparty/notes
- **Quick Add:** Manual transaction entry with autocomplete
- **Multi-currency Support:** Track transactions in CNY, USD, EUR, JPY, HKD

### 8. Budget Management

- **Budget Creation:** Set monthly budgets by category or overall
- **Budget Tracking:** Real-time spending against budget limits
- **Visual Alerts:** Color-coded status indicators (green/yellow/red)
- **Progress Bars:** Visual representation of budget usage

---

## Data Schema

### Transaction Table

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,           -- 'alipay' | 'wechat' | 'yunshanfu' | 'bank' | 'manual'
  import_id TEXT,                 -- Import batch ID
  original_source TEXT,           -- Original source when merged/imported
  original_id TEXT,               -- Original ID from source
  date TEXT NOT NULL,              -- ISO date (YYYY-MM-DD)
  amount REAL NOT NULL,            -- Positive for income, negative for expense
  currency TEXT DEFAULT 'CNY',     -- Supported: CNY, USD, EUR, JPY, HKD
  type TEXT NOT NULL,              -- 'expense' | 'income' | 'transfer'
  counterparty TEXT,               -- Merchant/name
  description TEXT,                -- Original description
  bank_name TEXT,                  -- Bank statement source name
  category TEXT DEFAULT '其他',     -- Auto-tagged category
  notes TEXT,                      -- User notes
  tags TEXT,                       -- JSON array of custom tags
  member_id TEXT,                  -- Assigned family member ID
  account_id TEXT,                 -- Assigned account ID
  is_refund INTEGER DEFAULT 0,     -- 1 if detected as refund
  refund_of TEXT,                  -- Referenced original transaction ID
  is_duplicate INTEGER DEFAULT 0,  -- 1 if marked as duplicate
  duplicate_source TEXT,           -- exact | same_period | cross_platform
  duplicate_type TEXT,             -- duplicate type for filtering/review
  merged_with TEXT,                -- ID of merged transaction
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Additional Tables

```sql
-- Accounts
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,              -- bank/credit/cash/alipay/wechat/other
  balance REAL DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Family Members
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Budgets
CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  year_month TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(year_month, category)
);

-- Smart Assignment History
CREATE TABLE assignment_history (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  feature_value TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Smart Assignment Patterns
CREATE TABLE assignment_patterns (
  id TEXT PRIMARY KEY,
  feature_key TEXT NOT NULL,
  feature_value TEXT NOT NULL,
  member_id TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  confidence REAL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(feature_key, feature_value, member_id)
);

-- Email Accounts
CREATE TABLE email_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  imap_host TEXT NOT NULL,
  imap_port INTEGER DEFAULT 993,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 465,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  last_sync TEXT,
  created_at TEXT NOT NULL
);

-- Email Messages
CREATE TABLE email_messages (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  subject TEXT,
  from_address TEXT,
  date TEXT,
  attachments TEXT,
  processed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES email_accounts(id) ON DELETE CASCADE
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
- **Database:** SQLite via `sql.js` (embedded/local file)
- **CSV Parsing:** papaparse
- **PDF Processing:** pdf-parse + tesseract.js (OCR)
- **Email Processing:** imap + mailparser
- **Charts:** Recharts
- **Build Tool:** Vite + electron-builder
- **CLI:** commander.js

---

## File Structure

```
expense-tracker/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts
│   │   ├── database.ts
│   │   ├── ipc.ts
│   │   ├── ipcFilters.ts
│   │   ├── email.ts
│   │   └── preload.ts
│   ├── renderer/      # React frontend
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Accounts.tsx
│   │   │   ├── AssignTransactions.tsx
│   │   │   ├── Budgets.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── EmailSettings.tsx
│   │   │   ├── Import.tsx
│   │   │   ├── Members.tsx
│   │   │   ├── QuickAdd.tsx
│   │   │   └── Transactions.tsx
│   │   └── styles/
│   ├── shared/        # Shared types & utilities
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   └── drilldown.ts
│   ├── parsers/       # File parsers for each source
│   │   ├── alipay.ts
│   │   ├── wechat.ts
│   │   ├── yunshanfu.ts
│   │   ├── bank.ts
│   │   ├── pdf.ts
│   │   ├── html.ts
│   │   └── ocr.ts
│   └── cli.ts         # Command-line interface
├── tests/             # Test files
│   ├── parsers.test.js
│   └── drilldown.test.js
├── resources/         # App icons
├── package.json
├── electron-builder.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.main.json
└── docs/              # Design documentation
    └── plans/
        ├── 2026-02-22-dashboard-drilldown-design.md
        └── 2026-02-22-dashboard-drilldown-implementation-plan.md
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
- [x] Family member management
- [x] Transaction assignment to members

### Phase 3 (Week 3)
- [x] Dashboard charts (trend, pie chart, top merchants, member stats)
- [x] Export functionality (CSV + Excel .xlsx)
- [x] Manual category override (dropdown in transaction list)
- [x] Inline notes editing (click to edit)
- [x] Budget management with alerts
- [x] Tag management system

### Phase 4 (Enhanced)
- [x] CLI tool (import/list/export/summary/backup)
- [x] Enhanced deduplication (exact/same_period/cross_platform)
- [x] Data traceability (import_id, original_source, duplicate_source)
- [x] Refund detection and linking
- [x] Bank statement parser
- [x] S3 backup support
- [x] Dashboard drill-down to Transactions
- [x] Smart assignment with pattern learning
- [x] Triage rules for automatic assignment
- [x] Batch assignment with confirmation prompts
- [x] Email integration (IMAP sync, attachment processing)
- [x] Quick add with autocomplete
- [x] Multi-currency support
- [x] **Multi-account support** (银行卡/信用卡/现金/电子钱包管理)

### Future (Post-MVP)
- [x] **Source Coverage Dashboard** - Track data collection completeness
- [x] **Mark-as-zero Persistence** - Mark months as having no data
- [ ] Auto-collection (web scraping / notification capture)
- [ ] Mobile app companion
- [ ] Advanced analytics and forecasting
- [ ] Receipt OCR with automatic categorization

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
expense-cli recurring --min-occurrences 3            # 识别周期性支出
expense-cli config set watch_dir /path/to/watch      # 设置自动导入目录
expense-cli email-import --source alipay wechat      # 从邮箱导入账单
```

## Web Interface Navigation

- **快速记账 (Quick Add):** Manual transaction entry
- **仪表盘 (Dashboard):** Overview with drill-down capabilities
- **预算 (Budgets):** Budget management and tracking
- **账户 (Accounts):** Account management (bank/credit/cash/e-wallets)
- **成员 (Members):** Family member management
- **分配交易 (Assign Transactions):** Smart assignment interface
- **导入 (Import):** File import with preview
- **交易记录 (Transactions):** Detailed transaction list with filtering
- **邮箱设置 (Email Settings):** Email account configuration
