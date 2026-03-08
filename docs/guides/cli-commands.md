# CLI Commands Documentation

## Overview

The expense tracker provides a comprehensive command-line interface (CLI) that allows you to perform all core operations without using the GUI. The CLI is installed as `expense-cli` and supports importing, querying, exporting, and managing your expense data.

## Installation

The CLI is automatically available after building the application:

```bash
npm run build:electron
```

Or install globally:

```bash
npm install -g .
```

## Available Commands

### 1. Import Command

Import transaction data from various file formats.

#### Basic Usage

```bash
# Import a single file
expense-cli import <file> --source <source>

# Supported sources: alipay, wechat, yunshanfu, bank
expense-cli import alipay-bill.csv --source alipay
```

#### File Format Support

| Format | Extension | Description |
|--------|-----------|-------------|
| CSV | `.csv` | Standard comma-separated values |
| Excel | `.xlsx` | Microsoft Excel format |
| PDF | `.pdf` | PDF bills with OCR support |
| HTML | `.html`, `.htm` | Web-based bill statements |
| Images | `.png`, `.jpg` | Receipt images with OCR |

#### Watch Directory Mode

Automatically import new files added to a directory:

```bash
# Set default watch directory
expense-cli config set watch_dir /path/to/watch/folder

# Start watching (uses configured watch_dir)
expense-cli import --watch-dir

# Or specify directory directly
expense-cli import --watch-dir /path/to/watch/folder
```

The watcher automatically detects file source from filename:
- Files containing "alipay" → Alipay parser
- Files containing "wechat" → WeChat parser  
- Files containing "yunshanfu" → Yunshanfu parser
- Files containing "bank" → Bank statement parser

### 2. Configuration Commands

Manage CLI configuration settings.

#### Get Configuration

```bash
# Get specific setting
expense-cli config get watch_dir

# List all settings
expense-cli config list
```

#### Set Configuration

```bash
# Set watch directory
expense-cli config set watch_dir /path/to/watch/folder

# Set other settings as needed
expense-cli config set <key> <value>
```

#### Delete Configuration

```bash
# Remove a setting
expense-cli config delete watch_dir
```

### 3. List Transactions

Query and filter transactions from the database.

#### Basic Usage

```bash
# List latest 20 transactions
expense-cli list

# Limit results
expense-cli list --limit 50
```

#### Filtering Options

```bash
# Filter by category
expense-cli list --category 餐饮

# Filter by source
expense-cli list --source alipay

# Filter by month (YYYY-MM format)
expense-cli list --month 2026-02

# Filter by duplicate type
expense-cli list --duplicate-type exact
expense-cli list --duplicate-type same_period  
expense-cli list --duplicate-type cross_platform

# Show only refund transactions
expense-cli list --refund-only
```

### 4. Export Data

Export transactions to various formats.

#### CSV Export

```bash
# Export all transactions to CSV
expense-cli export --csv --output expenses.csv

# Export with date range
expense-cli export --csv --output expenses-2026.csv --start-date 2026-01-01 --end-date 2026-12-31
```

#### Excel Export

```bash
# Export to Excel (.xlsx)
expense-cli export --excel --output expenses.xlsx

# Export with date range
expense-cli export --excel --output expenses-2026.xlsx --start-date 2026-01-01 --end-date 2026-12-31
```

### 5. Summary Reports

Generate financial summaries and reports.

#### Monthly Summary

```bash
# Get current month summary
expense-cli summary --month 2026-02

# Output format:
# {
#   "month": "2026-02",
#   "expense": 1234.56,
#   "income": 5000.00,
#   "balance": 3765.44
# }
```

#### Annual Summary

```bash
# Get annual summary (current year)
expense-cli summary

# Get specific year summary
expense-cli summary --year 2026

# Output includes monthly breakdown
# {
#   "year": 2026,
#   "expense": 15000.00,
#   "income": 60000.00,
#   "balance": 45000.00,
#   "monthly": [
#     { "month": "2026-01", "expense": 1200.00, "income": 5000.00 },
#     { "month": "2026-02", "expense": 1300.00, "income": 5000.00 },
#     // ... more months
#   ]
# }
```

### 6. Recurring Expenses Analysis

Identify potential recurring expenses based on transaction patterns.

```bash
# Find recurring expenses (default: min 3 occurrences)
expense-cli recurring

# Custom minimum occurrences
expense-cli recurring --min-occurrences 5

# Output format:
# {
#   "items": [
#     {
#       "counterparty": "Netflix",
#       "count": 12,
#       "averageIntervalDays": 30.42,
#       "cadence": "monthly",
#       "totalExpense": 119.88
#     },
#     // ... more items
#   ]
# }
```

### 7. Database Backup

Backup your expense database locally or to cloud storage.

#### Local Backup

```bash
# Create local backup
expense-cli backup --output ~/backups/expenses-2026.db
```

#### S3 Backup

```bash
# Backup to AWS S3
expense-cli backup --target s3 --s3-uri s3://my-bucket/expenses.db

# With custom profile and endpoint
expense-cli backup --target s3 --s3-uri s3://my-bucket/expenses.db --profile my-profile --endpoint-url https://s3.amazonaws.com
```

**Requirements for S3 backup:**
- AWS CLI must be installed and configured
- Appropriate IAM permissions for the target S3 bucket

### 8. Email Import (Advanced)

Import bills directly from email using the himalaya email client.

```bash
# Import from email (requires himalaya CLI)
expense-cli email-import

# Specify sources to check
expense-cli email-import --source alipay wechat

# Dry run mode
expense-cli email-import --dry-run
```

**Requirements:**
- himalaya CLI must be installed: `cargo install himalaya`
- Email account must be configured in the application

## Advanced Features

### Smart Source Detection

When importing files without specifying a source, the CLI attempts to auto-detect the source based on:
- Filename patterns (contains "alipay", "wechat", etc.)
- File content analysis (CSV headers, data structure)

### Encoding Handling

The CLI automatically handles different text encodings:
- UTF-8 (standard)
- GB18030 (Chinese encoding commonly used in Chinese CSV files)

### Duplicate Detection

During import, the CLI performs duplicate detection:
- **Exact matches**: Same date, amount, and counterparty → auto-merged
- **Fuzzy matches**: Similar transactions flagged for manual review

### Refund Detection

Automatic refund detection and linking:
- Identifies refund transactions based on keywords
- Links refunds to original transactions when possible

## Error Handling

The CLI provides detailed error messages for common issues:

- **File not found**: Verify the file path exists
- **Unsupported format**: Check if the file extension is supported
- **Invalid source**: Ensure source is one of: alipay, wechat, yunshanfu, bank
- **Database errors**: Usually indicates database corruption (rare)

## Best Practices

1. **Regular backups**: Use the backup command regularly to prevent data loss
2. **Consistent naming**: Use consistent filename patterns for automatic source detection
3. **Date ranges**: Always specify date ranges for large exports to avoid memory issues
4. **Watch directory**: Set up a watch directory for automated imports from email downloads

## Integration Examples

### Automated Email Processing Script

```bash
#!/bin/bash
# Download emails with himalaya
himalaya download --folder INBOX --output ./downloads

# Import all downloaded files
expense-cli import --watch-dir ./downloads

# Clean up
rm -rf ./downloads
```

### Monthly Report Generation

```bash
#!/bin/bash
YEAR_MONTH=$(date +%Y-%m)
expense-cli summary --month $YEAR_MONTH > monthly-report-$YEAR_MONTH.json
expense-cli export --csv --output expenses-$YEAR_MONTH.csv --start-date ${YEAR_MONTH}-01 --end-date ${YEAR_MONTH}-31
```

## Troubleshooting

### Common Issues

**Q: CSV import fails with garbled text**
A: The file may be encoded in GB18030. The CLI should auto-detect this, but if it doesn't work, try converting the file to UTF-8 first.

**Q: S3 backup fails**
A: Ensure AWS CLI is properly configured with `aws configure` and you have write permissions to the S3 bucket.

**Q: Excel files not parsing correctly**
A: Some Excel files may have complex formatting. Try exporting as CSV from Excel first, then import the CSV.

**Q: Email import not finding attachments**
A: Ensure himalaya is properly configured and the email contains actual bill attachments (not just links).

## Version Information

Check CLI version:

```bash
expense-cli --version
```

The CLI version matches the main application version.