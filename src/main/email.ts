import { getEmailAccounts, getEmailAccountPassword, updateEmailAccountLastSync } from './database';
import { saveEmailMessage as dbSaveEmailMessage } from './database';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

// Keywords to search for billing/invoice emails
const BILLING_KEYWORDS = [
  '账单',
  '发票',
  '消费',
  'bill',
  'invoice',
  'payment',
  '账单明细',
  '电子发票',
  '消费记录',
];

// Keywords to search in email subjects
const BILLING_SUBJECT_KEYWORDS = [
  '账单',
  '发票',
  'bill',
  'invoice',
  '消费',
  'payment',
];

export interface EmailSyncOptions {
  accountId: string;
  since?: Date;
  keywords?: string[];
  downloadDir?: string;
}

/**
 * Connect to IMAP server and fetch emails
 */
export async function connectToEmail(account: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: account.username,
      password: account.password,
      host: account.imap_host,
      port: account.imap_port,
      tls: true,
      connTimeout: 30000,
    });

    imap.once('ready', () => {
      resolve(imap);
    });

    imap.once('error', (err: Error) => {
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Search and fetch emails matching billing keywords
 */
export async function searchBillingEmails(
  imap: any,
  keywords: string[] = BILLING_SUBJECT_KEYWORDS
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const searchCriteria = [
      'ALL',
      ['SUBJECT', keywords.join(' OR ')],
    ];

    imap.search(searchCriteria, (err: Error, results: number[]) => {
      if (err) {
        reject(err);
        return;
      }

      if (results.length === 0) {
        resolve([]);
        return;
      }

      const fetch = imap.fetch(results, {
        bodies: '',
        struct: true,
      });

      const emails: any[] = [];

      fetch.on('message', (msg: any) => {
        let emailData: any = {
          headers: null,
          body: null,
        };

        msg.on('body', (stream: any) => {
          simpleParser(stream, (err: Error, parsed: any) => {
            if (!err) {
              emailData.body = parsed;
            }
          });
        });

        msg.once('attributes', (attrs: any) => {
          emailData.headers = attrs;
        });

        msg.once('end', () => {
          emails.push(emailData);
        });
      });

      fetch.once('error', (err: Error) => {
        reject(err);
      });

      fetch.once('end', () => {
        resolve(emails);
      });
    });
  });
}

/**
 * Download email attachments
 */
export async function downloadAttachments(
  imap: any,
  message: any,
  downloadDir: string
): Promise<Array<{ filename: string; path: string }>> {
  const attachments: Array<{ filename: string; path: string }> = [];

  if (!message.body) return attachments;

  try {
    // Process parts
    if (message.body && message.body.attachments) {
      for (const attachment of message.body.attachments) {
        if (attachment.contentType === 'application/pdf' || 
            attachment.contentType.startsWith('image/')) {
          const filename = attachment.filename || `attachment_${Date.now()}.pdf`;
          const filepath = path.join(downloadDir, filename);
          
          if (attachment.content && attachment.content.length > 0) {
            fs.writeFileSync(filepath, attachment.content);
            attachments.push({ filename, path: filepath });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error downloading attachments:', err);
  }

  return attachments;
}

/**
 * Sync emails for a specific account
 */
export async function syncEmailAccount(options: EmailSyncOptions): Promise<{
  success: boolean;
  emailsFound: number;
  attachmentsDownloaded: number;
  errors: string[];
}> {
  const { accountId, downloadDir } = options;
  const errors: string[] = [];
  let emailsFound = 0;
  let attachmentsDownloaded = 0;

  try {
    // Get account info from database
    const accounts = getEmailAccounts();
    const account = accounts.find(a => a.id === accountId);
    
    if (!account) {
      return {
        success: false,
        emailsFound: 0,
        attachmentsDownloaded: 0,
        errors: ['Account not found'],
      };
    }

    // Get real password (not the masked one)
    const password = getEmailAccountPassword(accountId);
    if (!password) {
      return {
        success: false,
        emailsFound: 0,
        attachmentsDownloaded: 0,
        errors: ['Account password not found'],
      };
    }

    // Create temp directory for downloads
    const tempDir = downloadDir || path.join(app.getPath('userData'), 'email_downloads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Connect to IMAP
    const imap = await connectToEmail({
      ...account,
      password,
    });

    // Search for billing emails
    const emails = await searchBillingEmails(imap);

    for (const emailData of emails) {
      if (!emailData.body) continue;

      emailsFound++;

      // Save email to database
      const messageId = emailData.headers?.['message-id'] || `msg_${Date.now()}_${Math.random()}`;
      const subject = emailData.body.subject || '';
      const from = emailData.body.from?.value?.[0]?.address || '';

      // Process attachments
      if (emailData.body.attachments) {
        for (const attachment of emailData.body.attachments) {
          // Only download PDFs and images
          if (attachment.contentType === 'application/pdf' || 
              attachment.contentType.startsWith('image/')) {
            try {
              const filename = attachment.filename || `attachment_${Date.now()}.pdf`;
              const filepath = path.join(tempDir, filename);
              
              if (attachment.content && attachment.content.length > 0) {
                fs.writeFileSync(filepath, attachment.content);
                attachmentsDownloaded++;
              }
            } catch (err: any) {
              errors.push(`Failed to download attachment: ${err.message}`);
            }
          }
        }
      }

      // Save email record
      try {
        dbSaveEmailMessage(
          `msg_${Date.now()}_${Math.random()}`,
          accountId,
          messageId,
          subject,
          from,
          null,
          JSON.stringify(emailData.body.attachments || []),
        );
      } catch (err: any) {
        errors.push(`Failed to save email: ${err.message}`);
      }
    }

    imap.end();

    // Update last sync time
    updateEmailAccountLastSync(accountId);

    return {
      success: true,
      emailsFound,
      attachmentsDownloaded,
      errors,
    };
  } catch (err: any) {
    return {
      success: false,
      emailsFound: 0,
      attachmentsDownloaded: 0,
      errors: [err.message],
    };
  }
}