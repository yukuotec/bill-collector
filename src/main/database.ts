import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import type { App } from 'electron';
import { Budget, Member, Transaction, AssignmentHistory, AssignmentPattern, SmartAssignmentResult, EmailAccount, EmailMessage, Account, AccountSummary } from '../shared/types';
import { TRIAGE_RULES, matchTriageRule } from '../shared/constants';

let db: any = null;
let dbPath: string = '';
let electronApp: App | null = null;

function getElectronApp(): App | null {
  if (electronApp) return electronApp;
  try {
    const { app } = require('electron');
    electronApp = app;
    return app;
  } catch {
    // Electron not available (e.g., in tests)
    return null;
  }
}

export function getDatabasePath(): string {
  if (!dbPath) {
    throw new Error('Database path not initialized');
  }
  return dbPath;
}

export function getDatabase(): any {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function ensureSchema(): void {
  const database = getDatabase();

  database.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      import_id TEXT,
      original_source TEXT,
      original_id TEXT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      counterparty TEXT,
      description TEXT,
      bank_name TEXT,
      category TEXT DEFAULT '其他',
      notes TEXT,
      tags TEXT,
      currency TEXT DEFAULT 'CNY',
      is_refund INTEGER DEFAULT 0,
      refund_of TEXT,
      is_duplicate INTEGER DEFAULT 0,
      duplicate_source TEXT,
      duplicate_type TEXT,
      merged_with TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      year_month TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(year_month, category)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      file_name TEXT,
      record_count INTEGER,
      imported_at TEXT NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const columnsStmt = database.prepare("PRAGMA table_info('transactions')");
  const existingColumns = new Set<string>();
  while (columnsStmt.step()) {
    const row = columnsStmt.getAsObject() as { name?: string };
    if (typeof row.name === 'string') {
      existingColumns.add(row.name);
    }
  }
  columnsStmt.free();

  const ensureColumn = (name: string, sqlType: string): void => {
    if (!existingColumns.has(name)) {
      database.run(`ALTER TABLE transactions ADD COLUMN ${name} ${sqlType}`);
    }
  };

  ensureColumn('import_id', 'TEXT');
  ensureColumn('original_source', 'TEXT');
  ensureColumn('original_id', 'TEXT');
  ensureColumn('bank_name', 'TEXT');
  ensureColumn('is_refund', 'INTEGER DEFAULT 0');
  ensureColumn('refund_of', 'TEXT');
  ensureColumn('duplicate_source', 'TEXT');
  ensureColumn('duplicate_type', 'TEXT');
  ensureColumn('merged_with', 'TEXT');
  ensureColumn('tags', 'TEXT');
  ensureColumn('currency', 'TEXT DEFAULT "CNY"');
  ensureColumn('member_id', 'TEXT');
  ensureColumn('account_id', 'TEXT');

  database.run('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)');
  database.run('CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)');
  database.run('CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source)');
  database.run('CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_type ON transactions(duplicate_type)');

  // Smart Assignment tables
  database.run(`
    CREATE TABLE IF NOT EXISTS assignment_history (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      feature_key TEXT NOT NULL,
      feature_value TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS assignment_patterns (
      id TEXT PRIMARY KEY,
      feature_key TEXT NOT NULL,
      feature_value TEXT NOT NULL,
      member_id TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      confidence REAL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(feature_key, feature_value, member_id)
    )
  `);

  database.run('CREATE INDEX IF NOT EXISTS idx_assignment_history_transaction ON assignment_history(transaction_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_assignment_patterns_key_value ON assignment_patterns(feature_key, feature_value)');

  // Email accounts table
  database.run(`
    CREATE TABLE IF NOT EXISTS email_accounts (
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
    )
  `);

  // Email messages table
  database.run(`
    CREATE TABLE IF NOT EXISTS email_messages (
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
    )
  `);

  database.run('CREATE INDEX IF NOT EXISTS idx_email_messages_account ON email_messages(account_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_email_messages_processed ON email_messages(processed)');

  // Accounts table
  database.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL DEFAULT 0,
      color TEXT DEFAULT '#3B82F6',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  database.run('CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)');

  const now = new Date().toISOString();
  database.run(
    `
    UPDATE transactions
    SET type = 'income', updated_at = ?
    WHERE source = 'alipay'
      AND type = 'transfer'
      AND (
        description LIKE '%退款%'
        OR description LIKE '%退回%'
        OR description LIKE '%返还%'
        OR description LIKE '%返款%'
        OR description LIKE '%退费%'
        OR notes LIKE '%退款%'
        OR notes LIKE '%退回%'
        OR notes LIKE '%返还%'
        OR notes LIKE '%返款%'
        OR notes LIKE '%退费%'
      )
  `,
    [now]
  );
}

export async function initDatabase(): Promise<void> {
  // Allow overriding database path via environment variable (for tests)
  const userDataPath = process.env.EXPENSE_DB_PATH
    ? path.dirname(process.env.EXPENSE_DB_PATH)
    : getElectronApp()?.getPath('userData') || process.cwd();
  const dbFileName = process.env.EXPENSE_DB_PATH
    ? path.basename(process.env.EXPENSE_DB_PATH)
    : 'expenses.db';
  dbPath = path.join(userDataPath, dbFileName);

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  ensureSchema();
  saveDatabase();
}

export function insertTransactions(transactions: Transaction[]): number {
  if (transactions.length === 0) {
    return 0;
  }

  const database = getDatabase();
  const stmt = database.prepare(
    `INSERT INTO transactions
      (id, source, import_id, original_source, original_id, date, amount, type, counterparty, description, bank_name, category, notes, is_refund, refund_of, is_duplicate, duplicate_source, duplicate_type, merged_with, tags, currency, member_id, account_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let inserted = 0;
  try {
    for (const txn of transactions) {
      stmt.run([
        txn.id,
        txn.source,
        txn.import_id ?? null,
        txn.original_source ?? null,
        txn.original_id || null,
        txn.date,
        txn.amount,
        txn.type,
        txn.counterparty || null,
        txn.description || null,
        txn.bank_name || null,
        txn.category || '其他',
        txn.notes || null,
        Number(txn.is_refund ?? 0),
        txn.refund_of ?? null,
        Number(txn.is_duplicate ?? 0),
        txn.duplicate_source ?? null,
        txn.duplicate_type ?? null,
        txn.merged_with ?? null,
        txn.tags ?? null,
        txn.currency ?? 'CNY',
        txn.member_id ?? null,
        txn.account_id ?? null,
        txn.created_at,
        txn.updated_at,
      ]);
      inserted += 1;
    }
  } finally {
    stmt.free();
  }

  return inserted;
}

export function saveDatabase(): void {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export function getBudgets(): Budget[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM budgets ORDER BY year_month DESC, category ASC');
  const results: Budget[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as Budget);
  }
  stmt.free();
  return results;
}

export function setBudget(id: string, yearMonth: string, amount: number, category: string | null): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  
  // Check if budget exists for this year_month and category
  const existingStmt = database.prepare('SELECT id FROM budgets WHERE year_month = ? AND (category = ? OR (category IS NULL AND ? IS NULL))');
  existingStmt.bind([yearMonth, category, category]);
  
  if (existingStmt.step()) {
    // Update existing
    existingStmt.free();
    database.run('UPDATE budgets SET amount = ?, created_at = ? WHERE year_month = ? AND (category = ? OR (category IS NULL AND ? IS NULL))', 
      [amount, now, yearMonth, category, category]);
  } else {
    // Insert new
    existingStmt.free();
    database.run('INSERT INTO budgets (id, year_month, amount, category, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, yearMonth, amount, category, now]);
  }
  saveDatabase();
}

export function deleteBudget(id: string): void {
  const database = getDatabase();
  database.run('DELETE FROM budgets WHERE id = ?', [id]);
  saveDatabase();
}

export function getBudgetSpending(yearMonth: string, category: string | null): number {
  const database = getDatabase();
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-01`; // Will be handled by strftime
  
  let sql: string;
  let params: (string | null)[];
  
  if (category) {
    sql = `SELECT SUM(amount) as total FROM transactions WHERE type = 'expense' AND strftime('%Y-%m', date) = ? AND category = ?`;
    params = [yearMonth, category];
  } else {
    sql = `SELECT SUM(amount) as total FROM transactions WHERE type = 'expense' AND strftime('%Y-%m', date) = ?`;
    params = [yearMonth];
  }
  
  const stmt = database.prepare(sql);
  stmt.bind(params);
  let total = 0;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { total?: number };
    total = Number(row.total ?? 0);
  }
  stmt.free();
  return total;
}

export function getTransactionTags(id: string): string[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT tags FROM transactions WHERE id = ?');
  stmt.bind([id]);
  let tags: string[] = [];
  if (stmt.step()) {
    const row = stmt.getAsObject() as { tags?: string | null };
    const tagsStr = row.tags;
    if (tagsStr) {
      try {
        tags = JSON.parse(tagsStr);
        if (!Array.isArray(tags)) {
          tags = [];
        }
      } catch {
        tags = [];
      }
    }
  }
  stmt.free();
  return tags;
}

export function addTransactionTag(id: string, tag: string): boolean {
  const database = getDatabase();
  const now = new Date().toISOString();
  
  // Get current tags
  const stmt = database.prepare('SELECT tags FROM transactions WHERE id = ?');
  stmt.bind([id]);
  let currentTags: string[] = [];
  if (stmt.step()) {
    const row = stmt.getAsObject() as { tags?: string | null };
    const tagsStr = row.tags;
    if (tagsStr) {
      try {
        currentTags = JSON.parse(tagsStr);
        if (!Array.isArray(currentTags)) {
          currentTags = [];
        }
      } catch {
        currentTags = [];
      }
    }
  }
  stmt.free();
  
  // Add the new tag if it doesn't exist
  const trimmedTag = tag.trim();
  if (!trimmedTag) {
    return false;
  }
  
  if (!currentTags.includes(trimmedTag)) {
    currentTags.push(trimmedTag);
  }
  
  // Save back to database
  database.run(
    'UPDATE transactions SET tags = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(currentTags), now, id]
  );
  saveDatabase();
  return true;
}

export function removeTransactionTag(id: string, tag: string): boolean {
  const database = getDatabase();
  const now = new Date().toISOString();
  
  // Get current tags
  const stmt = database.prepare('SELECT tags FROM transactions WHERE id = ?');
  stmt.bind([id]);
  let currentTags: string[] = [];
  if (stmt.step()) {
    const row = stmt.getAsObject() as { tags?: string | null };
    const tagsStr = row.tags;
    if (tagsStr) {
      try {
        currentTags = JSON.parse(tagsStr);
        if (!Array.isArray(currentTags)) {
          currentTags = [];
        }
      } catch {
        currentTags = [];
      }
    }
  }
  stmt.free();
  
  // Remove the tag
  const trimmedTag = tag.trim();
  currentTags = currentTags.filter((t) => t !== trimmedTag);
  
  // Save back to database
  database.run(
    'UPDATE transactions SET tags = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(currentTags), now, id]
  );
  saveDatabase();
  return true;
}

export function updateTransactionCurrency(id: string, currency: string): boolean {
  const database = getDatabase();
  const now = new Date().toISOString();
  
  // Validate currency
  const validCurrencies = ['CNY', 'USD', 'EUR', 'JPY', 'HKD'];
  if (!validCurrencies.includes(currency)) {
    return false;
  }
  
  database.run(
    'UPDATE transactions SET currency = ?, updated_at = ? WHERE id = ?',
    [currency, now, id]
  );
  saveDatabase();
  return true;
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

// Settings functions
export function getSetting(key: string): string | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT value FROM settings WHERE key = ?');
  stmt.bind([key]);
  let value: string | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { value?: string | null };
    value = row.value ?? null;
  }
  stmt.free();
  return value;
}

export function setSetting(key: string, value: string): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
    [key, value, now, value, now]
  );
  saveDatabase();
}

export function getAllSettings(): Record<string, string> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT key, value FROM settings');
  const settings: Record<string, string> = {};
  while (stmt.step()) {
    const row = stmt.getAsObject() as { key: string; value: string };
    settings[row.key] = row.value;
  }
  stmt.free();
  return settings;
}

// Member functions
export function getMembers(): Member[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM members ORDER BY name ASC');
  const results: Member[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as Member);
  }
  stmt.free();
  return results;
}

export function addMember(id: string, name: string, color: string): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.run(
    'INSERT INTO members (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, color || '#3B82F6', now, now]
  );
  saveDatabase();
}

export function updateMember(id: string, name: string, color: string): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.run(
    'UPDATE members SET name = ?, color = ?, updated_at = ? WHERE id = ?',
    [name, color || '#3B82F6', now, id]
  );
  saveDatabase();
}

export function deleteMember(id: string): void {
  const database = getDatabase();
  // First, update transactions to remove member_id reference
  database.run('UPDATE transactions SET member_id = NULL WHERE member_id = ?', [id]);
  // Then delete the member
  database.run('DELETE FROM members WHERE id = ?', [id]);
  saveDatabase();
}

export function setTransactionMember(transactionId: string, memberId: string | null): void {
  const database = getDatabase();
  const now = new Date().toISOString();

  if (memberId === null) {
    database.run('UPDATE transactions SET member_id = NULL, updated_at = ? WHERE id = ?', [now, transactionId]);
  } else {
    database.run('UPDATE transactions SET member_id = ?, updated_at = ? WHERE id = ?', [memberId, now, transactionId]);
  }

  saveDatabase();
}

export function getMemberSpendingSummary(year: number, month?: number): { memberId: string; memberName: string; memberColor: string; total: number }[] {
  const database = getDatabase();
  
  let dateFilter: string;
  let params: (string | number)[];
  
  if (month !== undefined) {
    const monthStr = String(month).padStart(2, '0');
    dateFilter = `strftime('%Y-%m', date) = ?`;
    params = [`${year}-${monthStr}`];
  } else {
    dateFilter = `strftime('%Y', date) = ?`;
    params = [String(year)];
  }

  const sql = `
    SELECT 
      m.id as memberId,
      m.name as memberName,
      m.color as memberColor,
      COALESCE(SUM(t.amount), 0) as total
    FROM members m
    LEFT JOIN transactions t ON m.id = t.member_id 
      AND t.type = 'expense'
      AND ${dateFilter}
    GROUP BY m.id
    ORDER BY total DESC
  `;
  
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const results: { memberId: string; memberName: string; memberColor: string; total: number }[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { memberId: string; memberName: string; memberColor: string; total: number };
    results.push({
      memberId: row.memberId,
      memberName: row.memberName,
      memberColor: row.memberColor,
      total: Number(row.total),
    });
  }
  stmt.free();
  return results;
}

// ============== Smart Assignment Functions ==============

/**
 * Extract features from a transaction for learning/prediction
 */
function extractTransactionFeatures(txn: Transaction): Array<{ key: string; value: string }> {
  const features: Array<{ key: string; value: string }> = [];

  // Counterparty feature
  if (txn.counterparty && txn.counterparty.trim()) {
    features.push({ key: 'counterparty', value: txn.counterparty.trim().toLowerCase() });
  }

  // Category feature
  if (txn.category && txn.category.trim()) {
    features.push({ key: 'category', value: txn.category.trim().toLowerCase() });
  }

  // Description feature
  if (txn.description && txn.description.trim()) {
    features.push({ key: 'description', value: txn.description.trim().toLowerCase() });
  }

  // Merchant keyword - extract meaningful keywords from counterparty + description
  const merchantText = [txn.counterparty, txn.description].filter(Boolean).join(' ').toLowerCase();
  if (merchantText) {
    // Extract first 2-3 significant words as merchant keyword
    const words = merchantText
      .replace(/[\s\p{P}\p{S}]+/gu, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .slice(0, 3);
    if (words.length > 0) {
      features.push({ key: 'merchant_keyword', value: words.join(' ') });
    }
  }

  return features;
}

/**
 * Learn from a transaction assignment (when user manually assigns a transaction to a member)
 */
export function learnAssignment(transactionId: string, memberId: string, transaction: Transaction): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  const features = extractTransactionFeatures(transaction);

  // Record each feature in assignment_history
  for (const feature of features) {
    const historyId = `${transactionId}_${feature.key}_${Date.now()}`;
    database.run(
      `INSERT INTO assignment_history (id, transaction_id, member_id, feature_key, feature_value, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [historyId, transactionId, memberId, feature.key, feature.value, now]
    );
  }

  // Update or insert patterns for each feature
  for (const feature of features) {
    // Check if pattern exists
    const existingStmt = database.prepare(
      `SELECT id, count FROM assignment_patterns WHERE feature_key = ? AND feature_value = ? AND member_id = ?`
    );
    existingStmt.bind([feature.key, feature.value, memberId]);

    let existingCount = 0;
    let existingId = '';
    if (existingStmt.step()) {
      const row = existingStmt.getAsObject() as { id: string; count: number };
      existingId = row.id;
      existingCount = row.count;
    }
    existingStmt.free();

    if (existingId) {
      // Update existing pattern
      const newCount = existingCount + 1;
      database.run(
        `UPDATE assignment_patterns SET count = ?, updated_at = ? WHERE id = ?`,
        [newCount, now, existingId]
      );
    } else {
      // Insert new pattern
      const patternId = `${feature.key}_${feature.value}_${memberId}_${Date.now()}`;
      database.run(
        `INSERT INTO assignment_patterns (id, feature_key, feature_value, member_id, count, confidence, updated_at)
         VALUES (?, ?, ?, ?, 1, 0, ?)`,
        [patternId, feature.key, feature.value, memberId, now]
      );
    }
  }

  // Recalculate confidence for all patterns with the same feature_key and feature_value
  for (const feature of features) {
    // Get total count for this feature combination
    const totalStmt = database.prepare(
      `SELECT SUM(count) as total FROM assignment_patterns WHERE feature_key = ? AND feature_value = ?`
    );
    totalStmt.bind([feature.key, feature.value]);
    let totalCount = 0;
    if (totalStmt.step()) {
      const row = totalStmt.getAsObject() as { total?: number };
      totalCount = Number(row.total ?? 0);
    }
    totalStmt.free();

    if (totalCount > 0) {
      // Update confidence for all patterns with this feature
      const patternsStmt = database.prepare(
        `SELECT id, count FROM assignment_patterns WHERE feature_key = ? AND feature_value = ?`
      );
      patternsStmt.bind([feature.key, feature.value]);

      while (patternsStmt.step()) {
        const row = patternsStmt.getAsObject() as { id: string; count: number };
        const confidence = row.count / totalCount;
        database.run(
          `UPDATE assignment_patterns SET confidence = ?, updated_at = ? WHERE id = ?`,
          [confidence, now, row.id]
        );
      }
      patternsStmt.free();
    }
  }

  saveDatabase();
}

/**
 * Predict the most likely member for a transaction based on learned patterns
 */
export function predictMember(transaction: Transaction): SmartAssignmentResult {
  const features = extractTransactionFeatures(transaction);
  
  if (features.length === 0) {
    return {
      transactionId: transaction.id,
      predictedMemberId: null,
      confidence: 0,
      action: 'none',
    };
  }

  const database = getDatabase();
  const memberScores: Map<string, { score: number; weight: number }> = new Map();

  // Query patterns that match any of the transaction features
  // Priority: counterparty > category > description > merchant_keyword
  const featurePriority: Record<string, number> = {
    counterparty: 4,
    category: 2,
    description: 1,
    merchant_keyword: 3,
  };

  for (const feature of features) {
    const priority = featurePriority[feature.key] || 1;

    const stmt = database.prepare(
      `SELECT member_id, confidence FROM assignment_patterns 
       WHERE feature_key = ? AND feature_value = ?`
    );
    stmt.bind([feature.key, feature.value]);

    while (stmt.step()) {
      const row = stmt.getAsObject() as { member_id: string; confidence: number };
      const current = memberScores.get(row.member_id) || { score: 0, weight: 0 };
      memberScores.set(row.member_id, {
        score: current.score + row.confidence * priority,
        weight: current.weight + priority,
      });
    }
    stmt.free();
  }

  // Find the member with highest weighted score
  let bestMemberId: string | null = null;
  let bestScore = 0;
  let bestWeight = 0;

  for (const [memberId, data] of memberScores) {
    if (data.weight > bestWeight || (data.weight === bestWeight && data.score > bestScore)) {
      bestMemberId = memberId;
      bestScore = data.score;
      bestWeight = data.weight;
    }
  }

  if (!bestMemberId) {
    return {
      transactionId: transaction.id,
      predictedMemberId: null,
      confidence: 0,
      action: 'none',
    };
  }

  // Get the highest confidence for the predicted member
  const confidenceStmt = database.prepare(
    `SELECT MAX(confidence) as max_confidence FROM assignment_patterns 
     WHERE member_id = ? AND feature_key IN (${features.map(() => '?').join(',')})`
  );
  const featureKeys = features.map(f => f.key);
  confidenceStmt.bind([bestMemberId, ...featureKeys]);
  
  let maxConfidence = 0;
  if (confidenceStmt.step()) {
    const row = confidenceStmt.getAsObject() as { max_confidence?: number };
    maxConfidence = Number(row.max_confidence ?? 0);
  }
  confidenceStmt.free();

  // Determine action based on confidence
  let action: 'auto' | 'suggest' | 'none';
  if (maxConfidence >= 0.7) {
    action = 'auto';
  } else if (maxConfidence >= 0.3) {
    action = 'suggest';
  } else {
    action = 'none';
  }

  return {
    transactionId: transaction.id,
    predictedMemberId: bestMemberId,
    confidence: maxConfidence,
    action,
  };
}

/**
 * Get all learned assignment patterns
 */
export function getPatterns(): AssignmentPattern[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM assignment_patterns ORDER BY confidence DESC, count DESC');
  const results: AssignmentPattern[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as AssignmentPattern);
  }
  stmt.free();
  return results;
}

/**
 * Delete a specific pattern
 */
export function deletePattern(id: string): boolean {
  const database = getDatabase();
  database.run('DELETE FROM assignment_patterns WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

/**
 * Clear all assignment history and patterns
 */
export function clearAllPatterns(): void {
  const database = getDatabase();
  database.run('DELETE FROM assignment_history');
  database.run('DELETE FROM assignment_patterns');
  saveDatabase();
}

// ============== Phase 1: Triage Rules Functions ==============

/**
 * Apply triage rules to a batch of transactions
 * Returns suggested member IDs for each transaction based on keyword matching
 */
export function applyTriageRules(
  transactions: Transaction[]
): Array<{ transactionId: string; suggestedMemberId: string | null; matchedKeyword: string | null }> {
  const members = getMembers();
  
  // Create a map from member name to member ID
  const memberNameToId: Record<string, string> = {};
  for (const member of members) {
    memberNameToId[member.name] = member.id;
  }

  const results: Array<{ transactionId: string; suggestedMemberId: string | null; matchedKeyword: string | null }> = [];

  for (const txn of transactions) {
    const text = [txn.counterparty, txn.description].filter(Boolean).join(' ');
    const matchedMemberName = matchTriageRule(text);
    
    let suggestedMemberId: string | null = null;
    let matchedKeyword: string | null = null;

    if (matchedMemberName && memberNameToId[matchedMemberName]) {
      suggestedMemberId = memberNameToId[matchedMemberName];
      
      // Find the matched keyword for reference
      for (const rule of TRIAGE_RULES) {
        if (rule.memberName === matchedMemberName) {
          const lowerText = text.toLowerCase();
          for (const keyword of rule.keywords) {
            if (lowerText.includes(keyword)) {
              matchedKeyword = keyword;
              break;
            }
          }
          break;
        }
      }
    }

    results.push({
      transactionId: txn.id,
      suggestedMemberId,
      matchedKeyword,
    });
  }

  return results;
}

/**
 * Apply triage rules and automatically assign members to transactions
 * Returns the count of auto-assigned transactions
 */
export function autoApplyTriageRules(
  transactions: Transaction[]
): { assigned: number; results: Array<{ transactionId: string; suggestedMemberId: string | null; matchedKeyword: string | null }> } {
  const results = applyTriageRules(transactions);
  let assigned = 0;

  // Only auto-assign when we have a confident match
  for (const result of results) {
    if (result.suggestedMemberId) {
      setTransactionMember(result.transactionId, result.suggestedMemberId);
      assigned += 1;
    }
  }

  return { assigned, results };
}

// ============== Batch Assignment Prompt Functions ==============

interface SimilarAssignmentResult {
  similarCount: number;
  memberId: string;
  memberName: string;
  shouldPrompt: boolean;
  similarTransactions: Array<{
    id: string;
    counterparty: string | null;
    description: string | null;
    category: string | null;
    date: string;
    amount: number;
  }>;
}

/**
 * Extract keywords from description (first 3 significant words)
 */
function extractKeywords(text: string | null | undefined): string[] {
  if (!text) return [];
  
  const words = text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 3);
  
  return words;
}

/**
 * Check for similar transactions that have been assigned to the same member
 * Returns information about similar assignments and whether to prompt the user
 */
export function checkSimilarAssignments(
  transaction: Transaction,
  memberId: string,
  threshold: number = 2
): SimilarAssignmentResult {
  const database = getDatabase();
  const member = getMembers().find(m => m.id === memberId);
  
  if (!member) {
    return {
      similarCount: 0,
      memberId,
      memberName: '',
      shouldPrompt: false,
      similarTransactions: [],
    };
  }

  // Extract features from the current transaction
  const counterparty = transaction.counterparty?.trim().toLowerCase() || '';
  const category = transaction.category?.trim().toLowerCase() || '';
  const descriptionKeywords = extractKeywords(transaction.description);
  
  // Query for existing transactions assigned to this member
  const stmt = database.prepare(`
    SELECT id, counterparty, description, category, date, amount
    FROM transactions
    WHERE member_id = ?
      AND id != ?
      AND (
        (counterparty IS NOT NULL AND LOWER(TRIM(counterparty)) = ?)
        OR (category IS NOT NULL AND LOWER(TRIM(category)) = ?)
      )
  `);
  stmt.bind([memberId, transaction.id, counterparty, category]);

  const similarTransactions: SimilarAssignmentResult['similarTransactions'] = [];
  
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      counterparty: string | null;
      description: string | null;
      category: string | null;
      date: string;
      amount: number;
    };
    
    let isSimilar = false;
    
    // Check counterparty match
    if (counterparty && row.counterparty) {
      if (row.counterparty.trim().toLowerCase() === counterparty) {
        isSimilar = true;
      }
    }
    
    // Check category match
    if (!isSimilar && category && row.category) {
      if (row.category.trim().toLowerCase() === category) {
        isSimilar = true;
      }
    }
    
    // Check description keywords match (at least 2 keywords match)
    if (!isSimilar && descriptionKeywords.length >= 2 && row.description) {
      const rowKeywords = extractKeywords(row.description);
      const matchingKeywords = descriptionKeywords.filter(kw => 
        rowKeywords.some(rowKw => rowKw.includes(kw) || kw.includes(rowKw))
      );
      if (matchingKeywords.length >= 2) {
        isSimilar = true;
      }
    }
    
    if (isSimilar) {
      similarTransactions.push({
        id: row.id,
        counterparty: row.counterparty,
        description: row.description,
        category: row.category,
        date: row.date,
        amount: row.amount,
      });
    }
  }
  stmt.free();

  const similarCount = similarTransactions.length;
  
  return {
    similarCount,
    memberId,
    memberName: member.name,
    shouldPrompt: similarCount >= threshold,
    similarTransactions,
  };
}

/**
 * Batch assign similar transactions to a member based on the current transaction's features
 * Returns the number of transactions updated
 */
export function batchAssignSimilar(
  transaction: Transaction,
  memberId: string
): number {
  const database = getDatabase();
  const now = new Date().toISOString();
  
  // Extract features from the current transaction
  const counterparty = transaction.counterparty?.trim().toLowerCase() || '';
  const category = transaction.category?.trim().toLowerCase() || '';
  const descriptionKeywords = extractKeywords(transaction.description);

  // Find similar unassigned or differently assigned transactions
  // Only update transactions that are NOT already assigned to this member
  const findStmt = database.prepare(`
    SELECT id, counterparty, description, category
    FROM transactions
    WHERE member_id != ? 
      AND member_id IS NOT NULL
      AND id != ?
      AND (
        (counterparty IS NOT NULL AND LOWER(TRIM(counterparty)) = ?)
        OR (category IS NOT NULL AND LOWER(TRIM(category)) = ?)
      )
  `);
  findStmt.bind([memberId, transaction.id, counterparty, category]);

  const toUpdate: string[] = [];
  
  while (findStmt.step()) {
    const row = findStmt.getAsObject() as {
      id: string;
      counterparty: string | null;
      description: string | null;
      category: string | null;
    };
    
    let isSimilar = false;
    
    // Check counterparty match
    if (counterparty && row.counterparty) {
      if (row.counterparty.trim().toLowerCase() === counterparty) {
        isSimilar = true;
      }
    }
    
    // Check category match
    if (!isSimilar && category && row.category) {
      if (row.category.trim().toLowerCase() === category) {
        isSimilar = true;
      }
    }
    
    // Check description keywords match (at least 2 keywords match)
    if (!isSimilar && descriptionKeywords.length >= 2 && row.description) {
      const rowKeywords = extractKeywords(row.description);
      const matchingKeywords = descriptionKeywords.filter(kw => 
        rowKeywords.some(rowKw => rowKw.includes(kw) || kw.includes(rowKw))
      );
      if (matchingKeywords.length >= 2) {
        isSimilar = true;
      }
    }
    
    if (isSimilar) {
      toUpdate.push(row.id);
    }
  }
  findStmt.free();

  // Update all similar transactions
  if (toUpdate.length > 0) {
    const placeholders = toUpdate.map(() => '?').join(',');
    database.run(
      `UPDATE transactions SET member_id = ?, updated_at = ? WHERE id IN (${placeholders})`,
      [memberId, now, ...toUpdate]
    );
    saveDatabase();
  }

  return toUpdate.length;
}

// ============== Email Account Functions ==============

export function getEmailAccounts(): EmailAccount[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM email_accounts ORDER BY created_at DESC');
  const results: EmailAccount[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as EmailAccount;
    // Don't expose password in plain text
    results.push({
      ...row,
      password: '********',
    });
  }
  stmt.free();
  return results;
}

export function addEmailAccount(
  id: string,
  email: string,
  imapHost: string,
  imapPort: number,
  smtpHost: string,
  smtpPort: number,
  username: string,
  password: string
): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT INTO email_accounts (id, email, imap_host, imap_port, smtp_host, smtp_port, username, password, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, email, imapHost, imapPort, smtpHost, smtpPort, username, password, now]
  );
  saveDatabase();
}

export function deleteEmailAccount(id: string): void {
  const database = getDatabase();
  // Delete associated email messages first
  database.run('DELETE FROM email_messages WHERE account_id = ?', [id]);
  database.run('DELETE FROM email_accounts WHERE id = ?', [id]);
  saveDatabase();
}

export function updateEmailAccountLastSync(id: string): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.run('UPDATE email_accounts SET last_sync = ? WHERE id = ?', [now, id]);
  saveDatabase();
}

export function getEmailAccountById(id: string): EmailAccount | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM email_accounts WHERE id = ?');
  stmt.bind([id]);
  let account: EmailAccount | null = null;
  if (stmt.step()) {
    account = stmt.getAsObject() as unknown as EmailAccount;
  }
  stmt.free();
  return account;
}

export function getEmailAccountPassword(id: string): string | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT password FROM email_accounts WHERE id = ?');
  stmt.bind([id]);
  let password: string | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { password: string };
    password = row.password;
  }
  stmt.free();
  return password;
}

// ============== Email Message Functions ==============

export function saveEmailMessage(
  id: string,
  accountId: string,
  messageId: string,
  subject: string | null,
  fromAddress: string | null,
  date: string | null,
  attachments: string | null
): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT OR REPLACE INTO email_messages (id, account_id, message_id, subject, from_address, date, attachments, processed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, accountId, messageId, subject, fromAddress, date, attachments, now]
  );
  saveDatabase();
}

export function getUnprocessedEmails(accountId: string): EmailMessage[] {
  const database = getDatabase();
  const stmt = database.prepare(
    'SELECT * FROM email_messages WHERE account_id = ? AND processed = 0 ORDER BY date DESC'
  );
  stmt.bind([accountId]);
  const results: EmailMessage[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as EmailMessage);
  }
  stmt.free();
  return results;
}

export function markEmailAsProcessed(id: string): void {
  const database = getDatabase();
  database.run('UPDATE email_messages SET processed = 1 WHERE id = ?', [id]);
  saveDatabase();
}

export function getEmailMessages(accountId: string, limit = 50): EmailMessage[] {
  const database = getDatabase();
  const stmt = database.prepare(
    'SELECT * FROM email_messages WHERE account_id = ? ORDER BY date DESC LIMIT ?'
  );
  stmt.bind([accountId, limit]);
  const results: EmailMessage[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as EmailMessage);
  }
  stmt.free();
  return results;
}

// ============== Account Functions ==============

export function getAccounts(): Account[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM accounts ORDER BY name ASC');
  const results: Account[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as Account);
  }
  stmt.free();
  return results;
}

export function addAccount(id: string, name: string, type: Account['type'], balance: number, color: string): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.run(
    'INSERT INTO accounts (id, name, type, balance, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, type, balance || 0, color || '#3B82F6', now, now]
  );
  saveDatabase();
}

export function updateAccount(id: string, name: string, type: Account['type'], balance: number, color: string): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.run(
    'UPDATE accounts SET name = ?, type = ?, balance = ?, color = ?, updated_at = ? WHERE id = ?',
    [name, type, balance || 0, color || '#3B82F6', now, id]
  );
  saveDatabase();
}

export function deleteAccount(id: string): void {
  const database = getDatabase();
  // First, update transactions to remove account_id reference
  database.run('UPDATE transactions SET account_id = NULL WHERE account_id = ?', [id]);
  // Then delete the account
  database.run('DELETE FROM accounts WHERE id = ?', [id]);
  saveDatabase();
}

export function setTransactionAccount(transactionId: string, accountId: string | null): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  if (accountId === null) {
    database.run('UPDATE transactions SET account_id = NULL, updated_at = ? WHERE id = ?', [now, transactionId]);
  } else {
    database.run('UPDATE transactions SET account_id = ?, updated_at = ? WHERE id = ?', [accountId, now, transactionId]);
  }
  saveDatabase();
}

export function getAccountSpendingSummary(year: number, month?: number): AccountSummary[] {
  const database = getDatabase();

  let dateFilter: string;
  let params: (string | number)[];

  if (month !== undefined) {
    const monthStr = String(month).padStart(2, '0');
    dateFilter = `strftime('%Y-%m', date) = ?`;
    params = [`${year}-${monthStr}`];
  } else {
    dateFilter = `strftime('%Y', date) = ?`;
    params = [String(year)];
  }

  const sql = `
    SELECT
      a.id as accountId,
      a.name as accountName,
      a.type as accountType,
      a.color as accountColor,
      COALESCE(SUM(t.amount), 0) as total
    FROM accounts a
    LEFT JOIN transactions t ON a.id = t.account_id
      AND t.type = 'expense'
      AND ${dateFilter}
    GROUP BY a.id
    ORDER BY total DESC
  `;

  const stmt = database.prepare(sql);
  stmt.bind(params);
  const results: AccountSummary[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { accountId: string; accountName: string; accountType: Account['type']; accountColor: string; total: number };
    results.push({
      accountId: row.accountId,
      accountName: row.accountName,
      accountType: row.accountType,
      accountColor: row.accountColor,
      total: Number(row.total),
    });
  }
  stmt.free();
  return results;
}

export function updateAccountBalance(id: string, balance: number): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.run(
    'UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?',
    [balance, now, id]
  );
  saveDatabase();
}

// ============== Source Coverage Functions ==============

export interface SourceCoverageItem {
  source: string;
  month: string;
  count: number;
}

/**
 * Get transaction counts per source per month for coverage tracking
 */
export function getSourceCoverage(year: number): SourceCoverageItem[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT
      source,
      strftime('%Y-%m', date) as month,
      COUNT(*) as count
    FROM transactions
    WHERE strftime('%Y', date) = ?
      AND source IN ('alipay', 'wechat', 'yunshanfu', 'bank', 'manual')
    GROUP BY source, month
    ORDER BY month DESC, source
  `);
  stmt.bind([String(year)]);

  const results: SourceCoverageItem[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { source: string; month: string; count: number };
    results.push({
      source: row.source,
      month: row.month,
      count: Number(row.count),
    });
  }
  stmt.free();
  return results;
}

/**
 * Get the most recent import date for each source
 */
export function getLastImportBySource(): Array<{ source: string; lastDate: string | null }> {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT
      source,
      MAX(date) as lastDate
    FROM transactions
    WHERE source IN ('alipay', 'wechat', 'yunshanfu', 'bank', 'manual')
    GROUP BY source
  `);

  const results: Array<{ source: string; lastDate: string | null }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { source: string; lastDate: string | null };
    results.push({
      source: row.source,
      lastDate: row.lastDate,
    });
  }
  stmt.free();
  return results;
}
