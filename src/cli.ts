#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { TextDecoder } from 'util';
import initSqlJs from 'sql.js';
import Papa from 'papaparse';
import { Command } from 'commander';
import { parseAlipay } from './parsers/alipay';
import { parseBank } from './parsers/bank';
import { parseWechat } from './parsers/wechat';
import { parseYunshanfu } from './parsers/yunshanfu';
import { type DuplicateType, type Transaction, type TransactionSource } from './shared/types';

type DbRow = Record<string, unknown>;

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'expenses.db');

let SQL: any = null;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getDbPath(): string {
  return process.env.EXPENSE_DB_PATH || DEFAULT_DB_PATH;
}

async function getSqlJs(): Promise<any> {
  if (SQL) return SQL;
  SQL = await initSqlJs();
  return SQL;
}

async function openDatabase(): Promise<{ db: any; dbPath: string }> {
  const sql = await getSqlJs();
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const db = fs.existsSync(dbPath) ? new sql.Database(fs.readFileSync(dbPath)) : new sql.Database();

  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      file_name TEXT,
      record_count INTEGER,
      imported_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_type ON transactions(duplicate_type)');

  const tableInfoStmt = db.prepare("PRAGMA table_info('transactions')");
  const columns = new Set<string>();
  while (tableInfoStmt.step()) {
    const row = tableInfoStmt.getAsObject() as { name?: string };
    if (typeof row.name === 'string') {
      columns.add(row.name);
    }
  }
  tableInfoStmt.free();

  const ensureColumn = (name: string, sqlType: string): void => {
    if (!columns.has(name)) {
      db.run(`ALTER TABLE transactions ADD COLUMN ${name} ${sqlType}`);
    }
  };

  ensureColumn('import_id', 'TEXT');
  ensureColumn('original_source', 'TEXT');
  ensureColumn('duplicate_source', 'TEXT');
  ensureColumn('duplicate_type', 'TEXT');
  ensureColumn('is_refund', 'INTEGER DEFAULT 0');
  ensureColumn('refund_of', 'TEXT');
  ensureColumn('bank_name', 'TEXT');

  return { db, dbPath };
}

function saveDatabase(db: any, dbPath: string): void {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function closeDatabase(db: any, dbPath: string): void {
  saveDatabase(db, dbPath);
  db.close();
}

function queryAll(db: any, sql: string, params: (string | number)[] = []): DbRow[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: DbRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function decodeCsvContent(buffer: Buffer): string {
  const utf8 = buffer.toString('utf-8');
  if (!utf8.includes('\ufffd')) return utf8;

  try {
    const gb18030 = new TextDecoder('gb18030').decode(buffer);
    return gb18030 || utf8;
  } catch {
    return utf8;
  }
}

function parseTransactionsBySource(content: string, source: TransactionSource): Transaction[] {
  switch (source) {
    case 'alipay':
      return parseAlipay(content);
    case 'bank':
      return parseBank(content);
    case 'wechat':
      return parseWechat(content);
    case 'yunshanfu':
      return parseYunshanfu(content);
  }
}

function normalizeText(value?: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

function transactionSignature(txn: Pick<Transaction, 'counterparty' | 'description'>): string {
  return `${normalizeText(txn.counterparty)}|${normalizeText(txn.description)}`;
}

function hasTextSignature(txn: Pick<Transaction, 'counterparty' | 'description'>): boolean {
  return normalizeText(txn.counterparty).length > 0 || normalizeText(txn.description).length > 0;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp: number[] = Array.from({ length: b.length + 1 }, (_, idx) => idx);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[b.length];
}

function normalizedSimilarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;

  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

function isTextSimilar(a: string, b: string, threshold = 0.72): boolean {
  return normalizedSimilarity(a, b) >= threshold;
}

function normalizeMerchantName(value?: string): string {
  const cleaned = (value || '')
    .toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, ' ')
    .replace(/\+?\d[\d\s-]{6,}\d/g, ' ')
    .replace(/(?:地址|addr|address)[:：]?\s*[^\s,，;；]*/gi, ' ')
    .replace(/[0-9一二三四五六七八九十百千]+(?:号|栋|幢|单元|室|楼|层)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim();

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  return tokens.filter((token) => !/(省|市|区|县|镇|乡|村|路|街|巷|道)$/.test(token)).join('');
}

function merchantSignature(txn: Pick<Transaction, 'counterparty' | 'description'>): string {
  return normalizeMerchantName(txn.counterparty || txn.description || '');
}

function findDuplicateCandidate(
  db: any,
  txn: Transaction
): { exactId?: string; pending?: { targetId: string; duplicateType: Exclude<DuplicateType, 'exact'>; duplicateSource: string } } {
  const stmt = db.prepare(
    `SELECT id, source, date, counterparty, description
     FROM transactions
     WHERE ABS(amount - ?) < 0.005
       AND date BETWEEN date(?, '-3 day') AND date(?, '+3 day')
     LIMIT 100`
  );
  stmt.bind([txn.amount, txn.date, txn.date]);

  const inputSig = transactionSignature(txn);
  const inputHasSignature = hasTextSignature(txn);
  const inputMerchantSig = merchantSignature(txn);
  let samePeriodBest: { id: string; score: number; source: string } | null = null;
  let crossPlatformBest: { id: string; score: number; source: string } | null = null;

  while (stmt.step()) {
    const row = stmt.getAsObject() as { id?: string; source?: string; date?: string; counterparty?: string; description?: string };
    const rowSig = transactionSignature(row);
    const sameSource = row.source === txn.source;
    const sameDay = row.date === txn.date;
    const rowHasSignature = hasTextSignature(row);

    if (sameDay && inputHasSignature && rowHasSignature && rowSig === inputSig) {
      stmt.free();
      return row.id ? { exactId: row.id } : {};
    }

    if (sameSource && inputHasSignature && rowHasSignature) {
      const score = normalizedSimilarity(inputSig, rowSig);
      if (isTextSimilar(inputSig, rowSig) && (!samePeriodBest || score > samePeriodBest.score)) {
        samePeriodBest = { id: row.id || '', score, source: row.source || '' };
      }
      continue;
    }

    if (!sameSource && inputMerchantSig.length > 0) {
      const rowMerchant = merchantSignature(row);
      if (!rowMerchant.length) {
        continue;
      }
      const score = normalizedSimilarity(inputMerchantSig, rowMerchant);
      if (isTextSimilar(inputMerchantSig, rowMerchant, 0.7) && (!crossPlatformBest || score > crossPlatformBest.score)) {
        crossPlatformBest = { id: row.id || '', score, source: row.source || '' };
      }
    }
  }

  stmt.free();
  if (samePeriodBest?.id) {
    return {
      pending: {
        targetId: samePeriodBest.id,
        duplicateType: 'same_period',
        duplicateSource: samePeriodBest.source,
      },
    };
  }
  if (crossPlatformBest?.id) {
    return {
      pending: {
        targetId: crossPlatformBest.id,
        duplicateType: 'cross_platform',
        duplicateSource: crossPlatformBest.source,
      },
    };
  }

  return {};
}

interface RefundCandidate {
  id?: string;
  date?: string;
  counterparty?: string;
  description?: string;
}

function isRefundTransaction(txn: Pick<Transaction, 'type' | 'is_refund'>): boolean {
  return txn.is_refund === 1 || txn.is_refund === true;
}

function findRefundOriginalCandidate(db: any, txn: Transaction): string | null {
  if (!isRefundTransaction(txn)) {
    return null;
  }

  const stmt = db.prepare(
    `SELECT id, date, counterparty, description
     FROM transactions
     WHERE type = 'expense'
       AND COALESCE(is_refund, 0) = 0
       AND ABS(amount - ?) < 0.005
       AND date < ?
       AND date >= date(?, '-30 day')
     ORDER BY date DESC
     LIMIT 200`
  );
  stmt.bind([txn.amount, txn.date, txn.date]);

  const refundMerchant = merchantSignature(txn);
  const refundSig = transactionSignature(txn);
  let best: { id: string; score: number; date: string } | null = null;

  while (stmt.step()) {
    const row = stmt.getAsObject() as RefundCandidate;
    if (!row.id || !row.date) {
      continue;
    }

    const candidateMerchant = merchantSignature(row);
    let score = 0;
    if (refundMerchant && candidateMerchant) {
      score = normalizedSimilarity(refundMerchant, candidateMerchant);
      if (!isTextSimilar(refundMerchant, candidateMerchant, 0.6)) {
        continue;
      }
    } else {
      const candidateSig = transactionSignature(row);
      score = normalizedSimilarity(refundSig, candidateSig);
      if (!isTextSimilar(refundSig, candidateSig, 0.6)) {
        continue;
      }
    }

    if (!best || score > best.score || (score === best.score && row.date > best.date)) {
      best = { id: row.id, score, date: row.date };
    }
  }
  stmt.free();

  return best?.id || null;
}

function linkRefundTransactions(db: any, importId: string): void {
  const refundRows = queryAll(
    db,
    `SELECT id, date, amount, type, counterparty, description, is_refund
     FROM transactions
     WHERE import_id = ?
       AND COALESCE(is_refund, 0) = 1
       AND refund_of IS NULL
     ORDER BY date ASC, created_at ASC`,
    [importId]
  ) as unknown as Transaction[];

  const now = new Date().toISOString();
  const updateStmt = db.prepare('UPDATE transactions SET refund_of = ?, updated_at = ? WHERE id = ?');
  try {
    for (const refundTxn of refundRows) {
      const targetId = findRefundOriginalCandidate(db, refundTxn);
      if (!targetId) continue;
      updateStmt.run([targetId, now, refundTxn.id]);
    }
  } finally {
    updateStmt.free();
  }
}

function insertTransactions(
  db: any,
  source: TransactionSource,
  filePath: string,
  transactions: Transaction[]
): { inserted: number; exactMerged: number; samePeriodFlagged: number; crossPlatformFlagged: number } {
  const now = new Date().toISOString();
  const importId = generateId();
  const stmt = db.prepare(
    `INSERT INTO transactions
      (id, source, import_id, original_source, original_id, date, amount, type, counterparty, description, bank_name, category, notes, is_refund, refund_of, is_duplicate, duplicate_source, duplicate_type, merged_with, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let inserted = 0;
  let exactMerged = 0;
  let samePeriodFlagged = 0;
  let crossPlatformFlagged = 0;

  for (const txn of transactions) {
    const duplicate = findDuplicateCandidate(db, txn);
    if (duplicate.exactId) {
      exactMerged += 1;
      continue;
    }

    if (duplicate.pending?.duplicateType === 'same_period') {
      samePeriodFlagged += 1;
    }
    if (duplicate.pending?.duplicateType === 'cross_platform') {
      crossPlatformFlagged += 1;
    }

    const id = txn.id || generateId();
    stmt.run([
      id,
      txn.source,
      importId,
      txn.original_source || txn.source,
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
      Number(duplicate.pending ? 1 : 0),
      duplicate.pending?.duplicateSource || null,
      duplicate.pending?.duplicateType || null,
      duplicate.pending?.targetId || null,
      now,
      now,
    ]);
    inserted += 1;
  }

  stmt.free();

  db.run(`INSERT INTO imports (id, source, file_name, record_count, imported_at) VALUES (?, ?, ?, ?, ?)`, [
    importId,
    source,
    path.basename(filePath),
    inserted,
    now,
  ]);

  linkRefundTransactions(db, importId);

  return { inserted, exactMerged, samePeriodFlagged, crossPlatformFlagged };
}

function toRows(sqlRows: DbRow[]): Record<string, unknown>[] {
  return sqlRows.map((row) => ({ ...row }));
}

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toColumnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function toSheetXml(headers: string[], rows: Record<string, unknown>[]): string {
  const allRows: Array<Record<string, unknown>> = [{}, ...rows];
  const xmlRows = allRows
    .map((row, rowIndex) => {
      const cells = headers
        .map((header, colIndex) => {
          const ref = `${toColumnName(colIndex)}${rowIndex + 1}`;
          const value = rowIndex === 0 ? header : row[header];
          if (typeof value === 'number' && Number.isFinite(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  const endRef = `${toColumnName(Math.max(0, headers.length - 1))}${Math.max(1, rows.length + 1)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${endRef}"/>
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
}

function writeXlsx(filePath: string, rows: Record<string, unknown>[]): void {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ['date', 'type', 'amount', 'source', 'counterparty', 'description', 'category'];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expense-cli-xlsx-'));

  try {
    fs.mkdirSync(path.join(tempDir, '_rels'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'xl', '_rels'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'xl', 'worksheets'), { recursive: true });

    fs.writeFileSync(
      path.join(tempDir, '[Content_Types].xml'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, '_rels', '.rels'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'xl', 'workbook.xml'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Transactions" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'xl', '_rels', 'workbook.xml.rels'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'xl', 'styles.xml'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="1"><xf xfId="0"/></cellXfs>
</styleSheet>`,
      'utf-8'
    );

    fs.writeFileSync(path.join(tempDir, 'xl', 'worksheets', 'sheet1.xml'), toSheetXml(headers, rows), 'utf-8');
    execFileSync('zip', ['-q', '-X', '-r', filePath, '.'], { cwd: tempDir });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function parseSource(source: string): TransactionSource {
  if (source !== 'alipay' && source !== 'wechat' && source !== 'yunshanfu' && source !== 'bank') {
    throw new Error('source 必须是 alipay|wechat|yunshanfu|bank');
  }
  return source;
}

const program = new Command();

program
  .name('expense-cli')
  .description('记账小助手 CLI')
  .version('1.0.0');

program
  .command('import <file>')
  .description('导入账单文件')
  .requiredOption('--source <source>', '来源: alipay|wechat|yunshanfu|bank')
  .action(async (file: string, options: { source: string }) => {
    const source = parseSource(options.source);
    const filePath = path.resolve(file);

    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const { db, dbPath } = await openDatabase();
    try {
      const content = decodeCsvContent(fs.readFileSync(filePath));
      const transactions = parseTransactionsBySource(content, source);
      const result = insertTransactions(db, source, filePath, transactions);
      saveDatabase(db, dbPath);
      console.log(
        `imported=${result.inserted} exact=${result.exactMerged} same_period=${result.samePeriodFlagged} cross_platform=${result.crossPlatformFlagged} parsed=${transactions.length} db=${dbPath}`
      );
    } finally {
      db.close();
    }
  });

program
  .command('list')
  .description('查询交易记录')
  .option('--category <category>', '按分类过滤')
  .option('--source <source>', '按来源过滤: alipay|wechat|yunshanfu|bank')
  .option('--month <month>', '按月份过滤，格式 YYYY-MM')
  .option('--duplicate-type <type>', '按重复类型过滤: exact|same_period|cross_platform')
  .option('--refund-only', '仅显示退款记录')
  .option('--limit <n>', '结果条数', '20')
  .action(async (options: { category?: string; source?: string; month?: string; duplicateType?: string; refundOnly?: boolean; limit: string }) => {
    const limit = Number.parseInt(options.limit, 10);
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error('limit 必须是正整数');
    }

    const where: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (options.category) {
      where.push('category = ?');
      params.push(options.category);
    }
    if (options.source) {
      const source = parseSource(options.source);
      where.push('source = ?');
      params.push(source);
    }
    if (options.month) {
      if (!/^\d{4}-\d{2}$/.test(options.month)) {
        throw new Error('month 格式必须是 YYYY-MM');
      }
      where.push("strftime('%Y-%m', date) = ?");
      params.push(options.month);
    }
    if (options.duplicateType) {
      const allowed: DuplicateType[] = ['exact', 'same_period', 'cross_platform'];
      if (!allowed.includes(options.duplicateType as DuplicateType)) {
        throw new Error('duplicate-type 必须是 exact|same_period|cross_platform');
      }
      where.push('duplicate_type = ?');
      params.push(options.duplicateType);
    }
    if (options.refundOnly) {
      where.push('COALESCE(is_refund, 0) = 1');
    }

    const { db } = await openDatabase();
    try {
      const rows = queryAll(
        db,
        `SELECT date, type, amount, source, original_source, counterparty, description, category, is_refund, refund_of, duplicate_source, duplicate_type
         FROM transactions
         WHERE ${where.join(' AND ')}
         ORDER BY date DESC, created_at DESC
         LIMIT ?`,
        [...params, limit]
      );
      console.table(rows);
      console.log(`count=${rows.length}`);
    } finally {
      db.close();
    }
  });

program
  .command('export')
  .description('导出交易')
  .option('--csv', '导出 CSV')
  .option('--excel', '导出 Excel(.xlsx)')
  .option('--start-date <date>', '开始日期，格式 YYYY-MM-DD')
  .option('--end-date <date>', '结束日期，格式 YYYY-MM-DD')
  .requiredOption('--output <file>', '输出文件路径')
  .action(async (options: { csv?: boolean; excel?: boolean; output: string; startDate?: string; endDate?: string }) => {
    if (Boolean(options.csv) === Boolean(options.excel)) {
      throw new Error('请二选一：--csv 或 --excel');
    }

    const where: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (options.startDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(options.startDate)) {
        throw new Error('start-date 格式必须是 YYYY-MM-DD');
      }
      where.push('date >= ?');
      params.push(options.startDate);
    }

    if (options.endDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(options.endDate)) {
        throw new Error('end-date 格式必须是 YYYY-MM-DD');
      }
      where.push('date <= ?');
      params.push(options.endDate);
    }

    if (options.startDate && options.endDate && options.startDate > options.endDate) {
      throw new Error('start-date 不能晚于 end-date');
    }

    const { db } = await openDatabase();
    try {
      const rows = toRows(queryAll(db, `SELECT * FROM transactions WHERE ${where.join(' AND ')} ORDER BY date DESC, created_at DESC`, params));
      const outPath = path.resolve(options.output);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });

      if (options.csv) {
        const csv = Papa.unparse(rows);
        fs.writeFileSync(outPath, '\ufeff' + csv, 'utf-8');
      } else {
        writeXlsx(outPath, rows);
      }

      console.log(`exported=${rows.length} output=${outPath}`);
    } finally {
      db.close();
    }
  });

program
  .command('summary')
  .description('查看汇总')
  .option('--year <year>', '年份，例如 2026')
  .option('--month <month>', '月份，例如 2026-02')
  .action(async (options: { year?: string; month?: string }) => {
    const { db } = await openDatabase();

    try {
      if (options.month) {
        if (!/^\d{4}-\d{2}$/.test(options.month)) {
          throw new Error('month 格式必须是 YYYY-MM');
        }

        const rows = queryAll(
          db,
          `SELECT
             SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense,
             SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income
           FROM transactions
           WHERE strftime('%Y-%m', date) = ?`,
          [options.month]
        );

        const expense = Number(rows[0]?.expense ?? 0);
        const income = Number(rows[0]?.income ?? 0);
        console.log(JSON.stringify({ month: options.month, expense, income, balance: income - expense }, null, 2));
        return;
      }

      const year = options.year ? Number.parseInt(options.year, 10) : new Date().getFullYear();
      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        throw new Error('year 必须是有效年份');
      }

      const yearlyRows = queryAll(
        db,
        `SELECT
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense,
           SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income
         FROM transactions
         WHERE strftime('%Y', date) = ?`,
        [String(year)]
      );

      const byMonth = queryAll(
        db,
        `SELECT strftime('%Y-%m', date) AS month,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income
         FROM transactions
         WHERE strftime('%Y', date) = ?
         GROUP BY month
         ORDER BY month ASC`,
        [String(year)]
      ).map((row) => ({
        month: String(row.month || ''),
        expense: Number(row.expense ?? 0),
        income: Number(row.income ?? 0),
      }));

      const expense = Number(yearlyRows[0]?.expense ?? 0);
      const income = Number(yearlyRows[0]?.income ?? 0);
      console.log(
        JSON.stringify(
          {
            year,
            expense,
            income,
            balance: income - expense,
            monthly: byMonth,
          },
          null,
          2
        )
      );
    } finally {
      db.close();
    }
  });

program
  .command('backup')
  .description('备份数据库文件')
  .option('--target <target>', '备份目标: local|s3', 'local')
  .option('--output <file>', '本地备份输出文件 (target=local 时必填)')
  .option('--s3-uri <uri>', 'S3 目标路径，例如 s3://my-bucket/backups/expenses.db')
  .option('--profile <name>', 'AWS profile 名称')
  .option('--endpoint-url <url>', 'S3 兼容服务 endpoint，例如 https://s3.amazonaws.com')
  .action(async (options: { target: string; output?: string; s3Uri?: string; profile?: string; endpointUrl?: string }) => {
    if (options.target !== 'local' && options.target !== 's3') {
      throw new Error('target 必须是 local|s3');
    }

    const { db, dbPath } = await openDatabase();
    try {
      saveDatabase(db, dbPath);

      if (options.target === 'local') {
        if (!options.output) {
          throw new Error('target=local 时必须提供 --output');
        }
        const outPath = path.resolve(options.output);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.copyFileSync(dbPath, outPath);
        console.log(`backup=${outPath}`);
        return;
      }

      if (!options.s3Uri || !/^s3:\/\//.test(options.s3Uri)) {
        throw new Error('target=s3 时必须提供合法的 --s3-uri (s3://...)');
      }

      const args = ['s3', 'cp', dbPath, options.s3Uri];
      if (options.profile) {
        args.push('--profile', options.profile);
      }
      if (options.endpointUrl) {
        args.push('--endpoint-url', options.endpointUrl);
      }

      try {
        execFileSync('aws', args, { stdio: 'pipe' });
      } catch {
        throw new Error('S3 备份失败：请确认已安装并配置 aws cli，且具备目标桶写入权限');
      }
      console.log(`backup=${options.s3Uri}`);
    } finally {
      db.close();
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
