import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { Budget, Member, Transaction } from '../shared/types';

let db: any = null;
let dbPath: string = '';

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

  database.run('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)');
  database.run('CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)');
  database.run('CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source)');
  database.run('CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_type ON transactions(duplicate_type)');

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
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'expenses.db');

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
      (id, source, import_id, original_source, original_id, date, amount, type, counterparty, description, bank_name, category, notes, is_refund, refund_of, is_duplicate, duplicate_source, duplicate_type, merged_with, tags, currency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
