# Bill Collector CLI

A CLI tool to streamline expense data collection from multiple sources (Alipay, WeChat, Yunshanfu, Bank statements).

## Installation

```bash
cd collector
npm install
npm run build
npm link  # Makes `collector` command available globally
```

## Usage

### Check Status

```bash
collector status
```

Shows freshness status for all data sources:
- ✅ Fresh (updated within 7 days)
- ⚠️ Stale (7-30 days old)
- 🔴 Missing (never imported or >30 days)

### Open Export Page

```bash
collector open alipay    # Open Alipay export page
collector open wechat    # Open WeChat export page
```

### Show Export Guide

```bash
collector guide alipay   # Show Alipay export steps
collector guide wechat   # Show WeChat export steps
collector guide bank     # Show generic bank export steps
```

### Watch Dropbox Folder

```bash
collector watch
```

Watches `~/expense-dropbox/` and auto-archives imported files to `~/expense-dropbox/archive/YYYY-MM/`.

### Cron Reminder

```bash
collector remind
```

Returns exit code 1 if any sources are stale. Use in cron for weekly reminders:

```bash
# Add to crontab (crontab -e)
0 9 * * 1 collector remind || osascript -e 'display notification "有数据源需要更新" with title "记账小助手"'
```

## Configuration

Edit `src/config.ts` to customize:
- Dropbox folder path
- Archive folder path
- Source URLs and export guides
- Reminder threshold (default: 7 days)

## Database Integration (Optional)

If `better-sqlite3` is installed, the CLI will read from the expense-tracker database to show actual import dates. Without it, it shows "never imported" for all sources but still provides the export helpers.

To enable database reading:

```bash
npm install better-sqlite3  # Requires build tools
```

## Commands

| Command | Description |
|---------|-------------|
| `collector status` | Show data source freshness |
| `collector open <source>` | Open export page in browser |
| `collector guide <source>` | Show export instructions |
| `collector watch` | Watch and auto-archive files |
| `collector remind` | Check for stale sources (cron) |

## Sources

- `alipay` - 支付宝账单
- `wechat` - 微信账单
- `yunshanfu` - 云闪付账单
- `bank` - 银行账单
- `manual` - 手工录入

## License

MIT
