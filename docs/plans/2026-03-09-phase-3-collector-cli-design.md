# Phase 3: Collector Helper CLI

**Status**: 设计中
**Created**: 2026-03-09
**Goal**: Reduce friction of collecting data from multiple sources

---

## Overview

The Collector Helper is a lightweight CLI tool that works alongside the main Expense Tracker to streamline data collection. It tracks source freshness, opens export pages, shows instructions, and manages the import workflow.

---

## Architecture

```
bill-collector-cli/
├── src/
│   ├── index.ts              # CLI entry point (commander.js)
│   ├── config.ts             # Configuration management
│   ├── db.ts                 # Read expense-tracker database
│   ├── sources/
│   │   ├── index.ts          # Source registry
│   │   ├── alipay.ts         # Alipay-specific logic
│   │   ├── wechat.ts         # WeChat-specific logic
│   │   ├── yunshanfu.ts      # Yunshanfu-specific logic
│   │   └── bank.ts           # Generic bank guidance
│   ├── commands/
│   │   ├── status.ts         # collector status
│   │   ├── open.ts           # collector open <source>
│   │   ├── guide.ts          # collector guide <source>
│   │   ├── watch.ts          # collector watch
│   │   └── remind.ts         # collector remind
│   └── utils/
│       ├── browser.ts        # Open browser URLs
│       ├── watcher.ts        # File system watcher
│       └── notifier.ts       # macOS notifications
├── package.json
└── README.md
```

---

## Commands

### `collector status`

Show freshness status for all sources.

```
$ collector status

📊 数据源收集状态

来源           最后导入      状态      天数
──────────────────────────────────────────
支付宝账单     2026-03-08    ✅ 新鲜    1天前
微信账单       2026-03-01    ⚠️ 陈旧   8天前
云闪付账单     2026-02-15    🔴 缺失   22天前
银行账单       从未导入      🔴 缺失    -
手工录入       2026-03-05    ✅ 新鲜    4天前

💡 提示: 运行 `collector open <source>` 打开导出页面
```

### `collector open <source>`

Open the export page for a source in the default browser.

```
$ collector open alipay
🌐 正在打开支付宝账单导出页面...
   https://consumeprod.alipay.com/record/standard.htm

$ collector open wechat
🌐 正在打开微信支付账单页面...
   https://pay.weixin.qq.com/index.php/public/auth_login
```

### `collector guide <source>`

Show step-by-step export instructions.

```
$ collector guide wechat

📱 微信账单导出步骤

1. 打开微信 → 我 → 服务 → 钱包
2. 点击右上角 "账单"
3. 点击右上角 "常见问题"
4. 选择 "下载账单"
5. 选择 "用于个人对账"
6. 选择时间范围（建议选整月）
7. 输入邮箱地址
8. 收到邮件后下载解压
9. 将 CSV 文件拖入记账小助手

💡 提示: 运行 `collector open wechat` 快速打开微信
```

### `collector watch`

Watch the dropbox folder and auto-archive imported files.

```
$ collector watch

👀 正在监视文件夹: ~/expense-dropbox/
   自动归档到: ~/expense-dropbox/archive/

[2026-03-09 10:30:15] 检测到新文件: alipay_20260301_20260331.csv
[2026-03-09 10:30:15] 已归档到: archive/2026-03/alipay_20260301_20260331.csv
```

### `collector remind`

Check if any sources are stale. Returns exit code 1 if action needed (for cron).

```
$ collector remind

⚠️ 需要关注的数据源:
   - 云闪付账单: 22天未更新
   - 银行账单: 从未导入

$ echo $?  # Returns 1 if stale sources exist
1
```

---

## Configuration

Stored in `~/.config/collector/config.json`:

```json
{
  "dropboxPath": "~/expense-dropbox",
  "archivePath": "~/expense-dropbox/archive",
  "dbPath": "~/Library/Application Support/expense-tracker/expenses.db",
  "sources": {
    "alipay": {
      "exportUrl": "https://consumeprod.alipay.com/record/standard.htm",
      "autoOpen": true
    },
    "wechat": {
      "exportUrl": "https://pay.weixin.qq.com/index.php/public/auth_login",
      "autoOpen": true
    }
  },
  "remindThresholdDays": 7
}
```

---

## Source URLs

| Source | Export URL | Notes |
|--------|------------|-------|
| Alipay | https://consumeprod.alipay.com/record/standard.htm | Web export, CSV |
| WeChat | https://pay.weixin.qq.com/index.php/public/auth_login | Web login, then navigate |
| Yunshanfu | (in-app only) | Show guide only |
| Bank | Various | Generic guidance |

---

## Integration with Expense Tracker

### Reading Database

```typescript
// src/db.ts
import Database from 'better-sqlite3';

export function getLastImportBySource() {
  const db = new Database(config.dbPath);
  const rows = db.prepare(`
    SELECT source, MAX(date) as lastDate
    FROM transactions
    GROUP BY source
  `).all();
  return rows;
}
```

### Dropbox Convention

```
~/expense-dropbox/
├── 2026-03/
│   ├── alipay_20260301_20260331.csv    # New files here
│   └── wechat_20260301_20260331.csv
└── archive/
    └── 2026-03/                        # Auto-move after import
        └── alipay_20260301_20260331.csv
```

---

## Implementation Plan

### Week 1: Core
- [ ] Project setup (TypeScript, commander.js)
- [ ] `collector status` command
- [ ] `collector open` command
- [ ] `collector guide` command
- [ ] Read expense-tracker DB

### Week 2: Automation
- [ ] `collector watch` command
- [ ] File watcher with chokidar
- [ ] Auto-archive functionality
- [ ] `collector remind` command
- [ ] Cron integration docs

### Week 3: Polish
- [ ] macOS notifications
- [ ] Configuration file support
- [ ] README and usage docs
- [ ] npm publish (optional)

---

## Acceptance Criteria

- [ ] Can check all source freshness with one command
- [ ] Can open any source export page with one command
- [ ] Can view export instructions for any source
- [ ] Watcher auto-archives imported files
- [ ] Remind command suitable for cron scheduling
- [ ] Zero configuration (sensible defaults)

---

## Related Documents

- Phase 2 Design: 2026-03-08-phase-2-design.md
- Expense Tracker SPEC.md
