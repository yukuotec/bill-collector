# Email Auto-Capture Documentation

## Overview

The email auto-capture feature automatically monitors configured email accounts for billing and invoice emails, downloads relevant attachments (PDFs, images), and processes them for import into the expense tracker.

## Features

### Email Account Management
- Add multiple email accounts with IMAP/SMTP configuration
- Secure password storage in local database
- Track last sync time for each account

### Automatic Email Processing
- Search for billing-related keywords in email subjects
- Automatically download PDF and image attachments
- Store email metadata and attachment information in database
- Mark processed emails to avoid reprocessing

### Supported Email Providers
- Gmail (IMAP enabled)
- Outlook/Hotmail (IMAP enabled)  
- Yahoo Mail (IMAP enabled)
- Any email provider with IMAP support

### Attachment Processing
- PDF bill processing (Alipay, WeChat, bank statements)
- Image receipt processing with OCR support
- Automatic categorization based on attachment content

## Configuration

### Email Account Setup
1. Navigate to **邮箱设置** (Email Settings) page
2. Click **添加邮箱账户** (Add Email Account)
3. Enter email credentials:
   - Email address
   - Username (usually same as email)
   - Password (app password recommended for Gmail)
   - IMAP server settings (host, port)
   - SMTP server settings (optional, for future features)

### Default IMAP Settings
| Provider | IMAP Host | IMAP Port |
|----------|-----------|-----------|
| Gmail | imap.gmail.com | 993 |
| Outlook | outlook.office365.com | 993 |
| Yahoo | imap.mail.yahoo.com | 993 |

## Usage

### Manual Sync
1. Go to **邮箱设置** page
2. Click **同步邮件** (Sync Emails) button next to configured account
3. System will:
   - Connect to email server
   - Search for billing/invoice emails
   - Download relevant attachments
   - Store email records in database
   - Display sync results

### Automatic Processing
Currently implemented as manual sync only. Future versions may include automatic background sync.

## Technical Implementation

### Email Search Criteria
The system searches for emails containing these keywords in the subject:

**Chinese Keywords:**
- 账单 (bill)
- 发票 (invoice) 
- 消费 (consumption)
- 账单明细 (bill details)
- 电子发票 (electronic invoice)
- 消费记录 (consumption records)

**English Keywords:**
- bill
- invoice
- payment
- consumption

### Attachment Filtering
Only processes attachments with these content types:
- `application/pdf` (PDF files)
- `image/*` (all image formats)

### Database Schema
Email data is stored in two tables:

**email_accounts table:**
```sql
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
```

**email_messages table:**
```sql
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

## Security Considerations

### Password Storage
- Email passwords are stored encrypted in the local SQLite database
- Passwords are never transmitted to external servers
- Local-first architecture ensures data privacy

### IMAP Connection
- All IMAP connections use TLS encryption
- App passwords recommended instead of main account passwords
- Connection timeouts prevent hanging operations

## Limitations

### Current Limitations
- Manual sync only (no automatic background sync)
- Limited to IMAP protocol (no POP3 support)
- Attachment processing requires manual import step
- No email template recognition for different bill formats

### Future Improvements
- Automatic background email monitoring
- Smart email template detection and parsing
- Direct import of processed attachments
- Support for more email providers and protocols
- Enhanced security with OAuth2 authentication

## Troubleshooting

### Common Issues

**Connection Failed**
- Verify IMAP settings are correct
- Ensure IMAP is enabled in email provider settings
- For Gmail, enable "Less secure app access" or use app password

**No Emails Found**
- Check that billing keywords appear in email subjects
- Verify email account contains relevant billing emails
- Ensure email dates are within expected range

**Attachment Download Failed**
- Check available disk space
- Verify file permissions in download directory
- Ensure attachments are PDF or image format

### Debugging
- Check application logs for detailed error messages
- Test email connection with external IMAP client first
- Verify network connectivity and firewall settings