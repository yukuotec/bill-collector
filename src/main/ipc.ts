import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { TextDecoder } from 'util';
import Papa from 'papaparse';
import { Dialog, IpcMain } from 'electron';
import { getDatabase, getDatabasePath, deleteBudget, getBudgets, getBudgetSpending, insertTransactions, saveDatabase, setBudget, getTransactionTags, addTransactionTag, removeTransactionTag, updateTransactionCurrency, getMembers, addMember, updateMember, deleteMember, setTransactionMember, getMemberSpendingSummary, learnAssignment, predictMember, getPatterns, deletePattern, applyTriageRules, autoApplyTriageRules, checkSimilarAssignments, batchAssignSimilar, getEmailAccounts, addEmailAccount, deleteEmailAccount, getEmailMessages, getAccounts, addAccount, updateAccount, deleteAccount, setTransactionAccount, getAccountSpendingSummary, updateAccountBalance, getSourceCoverage, getLastImportBySource, markAsZero, unmarkAsZero, isMarkedAsZero, getMarkedAsZero, getRecurringTransactions, getActiveRecurringTransactions, addRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction, toggleRecurringTransaction, generateRecurringTransactions, getInvestmentAccounts, addInvestmentAccount, updateInvestmentAccount, updateInvestmentPrice, deleteInvestmentAccount, getInvestmentTransactions, addInvestmentTransaction, deleteInvestmentTransaction, getInvestmentSummary, getSavingsGoals, addSavingsGoal, updateSavingsGoal, addToSavingsGoal, deleteSavingsGoal, getSavingsSummary } from './database';
import { parseAlipay } from '../parsers/alipay';
import { parseBank } from '../parsers/bank';
import { parseWechat } from '../parsers/wechat';
import { parseYunshanfu } from '../parsers/yunshanfu';
import { parsePdfBill } from '../parsers/pdf';
import { parseHtmlBill } from '../parsers/html';
import { parseImageBillWithOcr } from '../parsers/ocr';
import { generatePDFReport } from './export';
import { generateCashFlowForecast, optimizeBillPaymentDate } from './cashflow';
import { predictCategory, learnFromCorrection, getTrainingStats, batchCategorize } from './category-ml';
import { parseNaturalLanguage, formatParsedTransaction } from './nlp';
import { generateDeviceIdentity, getDeviceFingerprint, exportSyncFile, importSyncFile, getSyncStatus } from './sync';
import { createTemplateFromTransaction, getTemplates, deleteTemplate, toggleFavorite } from './templates';
import { runHealthCheck, fixIssue } from './health-check';
import { createBackup, listBackups, restoreBackup, deleteBackup } from './backup';
import { startScheduler, checkScheduledTasks } from './scheduler';
import { analyzeCategoryTrends } from './trends';
import { detectSuspiciousTransactions } from './fraud-detection';
import { generateTaxReport } from './year-end';
import { convertCurrency, getTransactionsInCurrency } from './multi-currency';
import { calculateGoalProgress } from './goal-based-budget';
import { getMerchantAnalytics } from './merchant-analytics';
import { createDebt, getDebtSummary } from './debt-tracker';
import { addToWishlist, getWishlistTotal } from './wishlist';
import { generateInsights } from './insights';
import { Budget, BudgetAlert, DuplicateReviewItem, DuplicateType, Member, Summary, SummaryQuery, Transaction, TransactionListResponse, TransactionQuery, TransactionSource, SmartAssignmentResult, SmartAssignmentApplyResult, EmailAccount, EmailMessage, Account, AccountSummary } from '../shared/types';
import { buildTransactionWhereClause } from './ipcFilters';
import {
  ValidationError,
  validateFilePath,
  validateSource,
  validateId,
  validateString,
  validateAmount,
  validateDate,
  validateYear,
  validateIdArray,
  validateCategory,
  withValidation
} from './validation';

type Source = TransactionSource;
type SupportedImportExt = '.csv' | '.xlsx' | '.pdf' | '.html' | '.htm' | '.png';

interface ImportCsvOptions {
  dryRun?: boolean;
  previewLimit?: number;
  currency?: string;
}

interface ImportCsvResult {
  importId: string | null;
  parsedCount: number;
  inserted: number;
  exactMerged: number;
  fuzzyFlagged: number;
  exactCount: number;
  samePeriodCount: number;
  crossPlatformCount: number;
  errors: string[];
  preview: Array<Pick<Transaction, 'date' | 'type' | 'amount' | 'counterparty' | 'description' | 'category'>>;
  columns?: string[];
  columnMapping?: Record<string, string>;
  triageResults?: Array<{ transactionId: string; suggestedMemberId: string | null; matchedKeyword: string | null }>;
}

interface DuplicateCandidate {
  id: string;
  source: Source;
  date: string;
  amount: number;
  counterparty?: string;
  description?: string;
}

interface DuplicateMatch {
  targetId: string;
  duplicateType: Exclude<DuplicateType, 'exact'>;
  duplicateSource: string;
}

interface RefundCandidate {
  id?: string;
  date?: string;
  counterparty?: string;
  description?: string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseTransactionsBySource(content: string, source: Source): Transaction[] {
  switch (source) {
    case 'alipay':
      return parseAlipay(content);
    case 'bank':
      return parseBank(content);
    case 'wechat':
      return parseWechat(content);
    case 'yunshanfu':
      return parseYunshanfu(content);
    default:
      throw new Error(`Unknown source: ${source}`);
  }
}

function decodeCsvCandidates(buffer: Buffer): string[] {
  const utf8 = buffer.toString('utf-8');
  const candidates = [utf8];

  const shouldTryGb18030 =
    utf8.includes('\ufffd') ||
    !/(交易时间|交易创建时间|交易日期|金额|收\/支|交易类型|支付宝|微信|云闪付|借方|贷方|balance|amount)/i.test(utf8);

  if (!shouldTryGb18030) {
    return candidates;
  }

  try {
    const gb18030 = new TextDecoder('gb18030').decode(buffer);
    if (gb18030 && gb18030 !== utf8) {
      candidates.push(gb18030);
    }
  } catch {
    // Ignore decoder availability issues and keep utf-8 fallback only.
  }

  return candidates;
}

function decodeXmlText(value: string): string {
  const decodeEntity = (num: number): string => {
    if (!Number.isInteger(num) || num < 0 || num > 0x10ffff) return '';
    try {
      return String.fromCodePoint(num);
    } catch {
      return '';
    }
  };

  return value
    .replace(/&#(\d+);/g, (_, dec) => decodeEntity(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => decodeEntity(Number.parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function columnRefToIndex(cellRef: string): number {
  const col = cellRef.replace(/\d+$/, '');
  let result = 0;
  for (let i = 0; i < col.length; i += 1) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return Math.max(0, result - 1);
}

function readZipEntry(filePath: string, entryPath: string): string {
  return execFileSync('unzip', ['-p', filePath, entryPath], { encoding: 'utf-8' });
}

function getFirstWorksheetPath(filePath: string): string {
  const entries = execFileSync('unzip', ['-Z1', filePath], { encoding: 'utf-8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const firstSheet = entries.find((entry) => /^xl\/worksheets\/.+\.xml$/i.test(entry));
  if (!firstSheet) {
    throw new Error('Excel 文件中未找到工作表');
  }
  return firstSheet;
}

function parseSharedStrings(sharedStringsXml: string): string[] {
  const siMatches = sharedStringsXml.match(/<si\b[\s\S]*?<\/si>/g) || [];
  return siMatches.map((si) => {
    const textMatches = si.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || [];
    const text = textMatches
      .map((segment) => {
        const matched = segment.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        return decodeXmlText(matched?.[1] || '');
      })
      .join('');
    return text;
  });
}

function getCellValue(cellXml: string, sharedStrings: string[]): string {
  const attrMatch = cellXml.match(/^<c\b([^>]*)/);
  const attrs = attrMatch?.[1] || '';
  const typeMatch = attrs.match(/\bt="([^"]+)"/);
  const cellType = typeMatch?.[1] || '';

  if (cellType === 'inlineStr') {
    const textMatches = cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
    return textMatches
      .map((segment) => {
        const matched = segment.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        return decodeXmlText(matched?.[1] || '');
      })
      .join('');
  }

  const vMatch = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  const raw = decodeXmlText(vMatch?.[1] || '');
  if (cellType === 's') {
    const idx = Number.parseInt(raw, 10);
    return Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length ? sharedStrings[idx] : '';
  }
  return raw;
}

function convertXlsxToCsv(filePath: string): string {
  const worksheetPath = getFirstWorksheetPath(filePath);
  const sheetXml = readZipEntry(filePath, worksheetPath);

  let sharedStrings: string[] = [];
  try {
    const sharedStringsXml = readZipEntry(filePath, 'xl/sharedStrings.xml');
    sharedStrings = parseSharedStrings(sharedStringsXml);
  } catch {
    sharedStrings = [];
  }

  const rows: string[][] = [];
  const rowMatches = sheetXml.match(/<row\b[\s\S]*?<\/row>/g) || [];
  for (const rowXml of rowMatches) {
    const rowValues: string[] = [];
    const cellMatches = rowXml.match(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) || [];
    for (const cellXml of cellMatches) {
      const attrMatch = cellXml.match(/^<c\b([^>]*)/);
      const attrs = attrMatch?.[1] || '';
      const ref = attrs.match(/\br="([^"]+)"/)?.[1];
      const colIdx = ref ? columnRefToIndex(ref) : rowValues.length;
      rowValues[colIdx] = getCellValue(cellXml, sharedStrings);
    }

    for (let i = 0; i < rowValues.length; i += 1) {
      if (typeof rowValues[i] !== 'string') {
        rowValues[i] = '';
      }
    }
    rows.push(rowValues);
  }

  return Papa.unparse(rows, { skipEmptyLines: false });
}

async function parseTransactionsFromFile(filePath: string, source: Source): Promise<Transaction[]> {
  const ext = path.extname(filePath).toLowerCase() as SupportedImportExt;

  switch (ext) {
    case '.csv': {
      const buffer = fs.readFileSync(filePath);
      const decodedCandidates = decodeCsvCandidates(buffer);
      const fallback = parseTransactionsBySource(decodedCandidates[0], source);

      if (fallback.length > 0 || decodedCandidates.length === 1) {
        return fallback;
      }

      for (let i = 1; i < decodedCandidates.length; i += 1) {
        const parsed = parseTransactionsBySource(decodedCandidates[i], source);
        if (parsed.length > 0) {
          return parsed;
        }
      }

      return fallback;
    }
    case '.xlsx': {
      const csvContent = convertXlsxToCsv(filePath);
      return parseTransactionsBySource(csvContent, source);
    }
    case '.pdf':
      return parsePdfBill(filePath, source);
    case '.html':
    case '.htm':
      return parseHtmlBill(filePath, source);
    case '.png':
      return parseImageBillWithOcr(filePath, source);
    default:
      throw new Error(`暂不支持的文件类型: ${ext || 'unknown'}`);
  }
}

function buildPreview(
  transactions: Transaction[],
  previewLimit: number
): Array<Pick<Transaction, 'date' | 'type' | 'amount' | 'counterparty' | 'description' | 'category'>> {
  return transactions.slice(0, previewLimit).map((txn) => ({
    date: txn.date,
    type: txn.type,
    amount: txn.amount,
    counterparty: txn.counterparty,
    description: txn.description,
    category: txn.category,
  }));
}

function extractCsvColumns(content: string): string[] {
  const firstLine = content.split('\n')[0];
  const headers = Papa.parse(firstLine, { header: false }).data;
  if (headers.length > 0 && Array.isArray(headers[0])) {
    return headers[0].map((h: string) => h?.trim() || '').filter(Boolean);
  }
  return [];
}

function buildColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  // Date column mapping
  const datePatterns = ['date', '交易时间', '日期', 'time', '交易日期', '记账日期'];
  for (const pattern of datePatterns) {
    const idx = normalizedHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
    if (idx >= 0) {
      mapping[headers[idx]] = 'date';
      break;
    }
  }
  
  // Amount column mapping
  const amountPatterns = ['amount', '金额', '交易金额', '金额(元)', '金额'];
  for (const pattern of amountPatterns) {
    const idx = normalizedHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
    if (idx >= 0) {
      mapping[headers[idx]] = 'amount';
      break;
    }
  }
  
  // Type column mapping
  const typePatterns = ['type', '类型', '收/支', '交易类型', '支出/收入'];
  for (const pattern of typePatterns) {
    const idx = normalizedHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
    if (idx >= 0) {
      mapping[headers[idx]] = 'type';
      break;
    }
  }
  
  // Counterparty mapping
  const counterpartyPatterns = ['counterparty', '交易对方', '对方', '商户', '收款方', '付款方'];
  for (const pattern of counterpartyPatterns) {
    const idx = normalizedHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
    if (idx >= 0) {
      mapping[headers[idx]] = 'counterparty';
      break;
    }
  }
  
  // Description mapping
  const descPatterns = ['description', '说明', '摘要', '商品说明', '备注'];
  for (const pattern of descPatterns) {
    const idx = normalizedHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
    if (idx >= 0) {
      mapping[headers[idx]] = 'description';
      break;
    }
  }
  
  return mapping;
}

function normalizeText(value?: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

function transactionSignature(txn: Pick<Transaction, 'counterparty' | 'description'>): string {
  const counterparty = normalizeText(txn.counterparty);
  const description = normalizeText(txn.description);
  return `${counterparty}|${description}`;
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
  const base = txn.counterparty || txn.description || '';
  return normalizeMerchantName(base);
}

function queryAll(sql: string, params: (string | number)[] = []): Record<string, unknown>[] {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function findDuplicateCandidate(txn: Transaction): { exactId?: string; pending?: DuplicateMatch } {
  const db = getDatabase();
  const stmt = db.prepare(
    `SELECT id, source, date, amount, counterparty, description
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
    const candidate = stmt.getAsObject() as unknown as DuplicateCandidate;
    const isSameDay = candidate.date === txn.date;
    const candidateSig = transactionSignature(candidate);
    const candidateHasSignature = hasTextSignature(candidate);
    const sameSource = candidate.source === txn.source;

    if (isSameDay && inputHasSignature && candidateHasSignature && candidateSig === inputSig) {
      stmt.free();
      return { exactId: candidate.id };
    }

    if (sameSource && inputHasSignature && candidateHasSignature) {
      const score = normalizedSimilarity(inputSig, candidateSig);
      if (isTextSimilar(inputSig, candidateSig) && (!samePeriodBest || score > samePeriodBest.score)) {
        samePeriodBest = { id: candidate.id, score, source: candidate.source };
      }
      continue;
    }

    if (!sameSource && inputMerchantSig.length > 0) {
      const candidateMerchantSig = merchantSignature(candidate);
      if (!candidateMerchantSig.length) {
        continue;
      }
      const score = normalizedSimilarity(inputMerchantSig, candidateMerchantSig);
      if (isTextSimilar(inputMerchantSig, candidateMerchantSig, 0.7) && (!crossPlatformBest || score > crossPlatformBest.score)) {
        crossPlatformBest = { id: candidate.id, score, source: candidate.source };
      }
    }
  }

  stmt.free();
  if (samePeriodBest) {
    return {
      pending: {
        targetId: samePeriodBest.id,
        duplicateType: 'same_period',
        duplicateSource: samePeriodBest.source,
      },
    };
  }

  if (crossPlatformBest) {
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

function findRefundOriginalCandidate(txn: Transaction): string | null {
  if (!(txn.is_refund === 1 || txn.is_refund === true)) {
    return null;
  }

  const db = getDatabase();
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

function linkRefundTransactions(importId: string): void {
  const db = getDatabase();
  const refundRows = queryAll(
    `SELECT id, date, amount, type, counterparty, description, is_refund
     FROM transactions
     WHERE import_id = ?
       AND COALESCE(is_refund, 0) = 1
       AND refund_of IS NULL
     ORDER BY date ASC, created_at ASC`,
    [importId]
  ) as unknown as Transaction[];

  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE transactions SET refund_of = ?, updated_at = ? WHERE id = ?');
  try {
    for (const refundTxn of refundRows) {
      const targetId = findRefundOriginalCandidate(refundTxn);
      if (!targetId) continue;
      stmt.run([targetId, now, refundTxn.id]);
    }
  } finally {
    stmt.free();
  }
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
  const headers = [
    'date',
    'type',
    'amount',
    'source',
    'counterparty',
    'description',
    'bank_name',
    'category',
    'notes',
    'original_id',
    'id',
  ];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expense-xlsx-'));

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
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
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

export function setupIpcHandlers(ipcMain: IpcMain, dialog: Dialog): void {
  ipcMain.handle('select-file', async (_, filters: { name: string; extensions: string[] }[]) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: filters.length > 0 ? filters : [{ name: '账单文件', extensions: ['csv', 'xlsx', 'pdf', 'html', 'png'] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    } catch (error) {
      console.error('[IPC Error] select-file:', error);
      throw error;
    }
  });

  ipcMain.handle('import-csv', async (_, filePath: string, source: Source, options?: ImportCsvOptions & { accountId?: string }) => {
    // Validate inputs
    try {
      validateFilePath(filePath);
      validateSource(source);
      if (options?.accountId) {
        validateId(options.accountId, 'accountId');
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          importId: null,
          parsedCount: 0,
          inserted: 0,
          exactMerged: 0,
          fuzzyFlagged: 0,
          exactCount: 0,
          samePeriodCount: 0,
          crossPlatformCount: 0,
          errors: [error.message],
          preview: [],
        };
      }
      throw error;
    }

    const result: ImportCsvResult = {
      importId: null,
      parsedCount: 0,
      inserted: 0,
      exactMerged: 0,
      fuzzyFlagged: 0,
      exactCount: 0,
      samePeriodCount: 0,
      crossPlatformCount: 0,
      errors: [],
      preview: [],
      columns: [],
      columnMapping: {},
    };

    try {
      const ext = path.extname(filePath).toLowerCase();
      let csvContent = '';
      
      // Extract CSV content based on file type
      if (ext === '.csv') {
        const buffer = fs.readFileSync(filePath);
        const candidates = decodeCsvCandidates(buffer);
        csvContent = candidates[0];
      } else if (ext === '.xlsx') {
        csvContent = convertXlsxToCsv(filePath);
      }
      
      // Extract column information from CSV
      if (csvContent) {
        const columns = extractCsvColumns(csvContent);
        result.columns = columns;
        result.columnMapping = buildColumnMapping(columns);
      }
      
      const transactions = await parseTransactionsFromFile(filePath, source);
      const previewLimit = Math.max(1, options?.previewLimit ?? 5);
      result.parsedCount = transactions.length;
      result.preview = buildPreview(transactions, previewLimit);

      if (options?.dryRun) {
        return result;
      }

      const db = getDatabase();
      const now = new Date().toISOString();
      const importId = generateId();
      const fileName = path.basename(filePath);
      const toInsert: Transaction[] = [];

      for (const txn of transactions) {
        const duplicate = findDuplicateCandidate(txn);
        if (duplicate.exactId) {
          result.exactMerged += 1;
          result.exactCount += 1;
          continue;
        }

        if (duplicate.pending) {
          result.fuzzyFlagged += 1;
          if (duplicate.pending.duplicateType === 'same_period') {
            result.samePeriodCount += 1;
          } else {
            result.crossPlatformCount += 1;
          }
        }

        toInsert.push({
          ...txn,
          id: txn.id || generateId(),
          import_id: importId,
          original_source: txn.original_source || txn.source,
          category: txn.category || '其他',
          is_refund: Number(txn.is_refund ?? 0),
          refund_of: txn.refund_of ?? null,
          is_duplicate: duplicate.pending ? 1 : 0,
          duplicate_source: duplicate.pending?.duplicateSource || null,
          duplicate_type: duplicate.pending?.duplicateType || null,
          merged_with: duplicate.pending?.targetId || null,
          account_id: options?.accountId || null,
          created_at: now,
          updated_at: now,
        });
      }

      result.inserted = insertTransactions(toInsert);

      // Apply triage rules after insertion
      const triageResults = applyTriageRules(toInsert);
      result.triageResults = triageResults;

      db.run(`INSERT INTO imports (id, source, file_name, record_count, imported_at) VALUES (?, ?, ?, ?, ?)`, [
        importId,
        source,
        fileName,
        result.inserted,
        now,
      ]);
      linkRefundTransactions(importId);
      saveDatabase();

      result.importId = importId;
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(message);
      return result;
    }
  });

  ipcMain.handle('get-transactions', async (_, filters?: TransactionQuery): Promise<TransactionListResponse> => {
    try {
      const { where, params } = buildTransactionWhereClause(filters);

      const whereClause = where.join(' AND ');
      const countRows = queryAll(`SELECT COUNT(*) as total FROM transactions WHERE ${whereClause}`, params);
      const total = Number(countRows[0]?.total ?? 0);

      const sortBy = filters?.sortBy === 'amount' ? 'amount' : 'date';
      const sortOrder = filters?.sortOrder === 'asc' ? 'ASC' : 'DESC';
      const page = Math.max(1, filters?.page ?? 1);
      const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 20));
      const offset = (page - 1) * pageSize;

      const listQuery = `
        SELECT *
        FROM transactions
        WHERE ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}, created_at DESC
        LIMIT ? OFFSET ?
      `;
      const items = queryAll(listQuery, [...params, pageSize, offset]) as unknown as Transaction[];

      return {
        items,
        totalCount: total,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('[IPC Error] get-transactions:', error);
      throw error;
    }
  });

  ipcMain.handle('get-duplicate-transactions', async (): Promise<DuplicateReviewItem[]> => {
    try {
      return queryAll(
        `
        SELECT
          d.*,
          t.id AS target_id,
          t.date AS target_date,
          t.amount AS target_amount,
          t.counterparty AS target_counterparty,
          t.description AS target_description,
          t.source AS target_source,
          t.type AS target_type
        FROM transactions d
        LEFT JOIN transactions t ON d.merged_with = t.id
        WHERE d.is_duplicate = 1
        ORDER BY d.date DESC, d.created_at DESC
        `
      ) as unknown as DuplicateReviewItem[];
    } catch (error) {
      console.error('[IPC Error] get-duplicate-transactions:', error);
      throw error;
    }
  });

  ipcMain.handle('resolve-duplicate', async (_, id: string, action: 'keep' | 'merge') => {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();

      if (action === 'keep') {
        db.run(
          'UPDATE transactions SET is_duplicate = 0, duplicate_source = NULL, duplicate_type = NULL, merged_with = NULL, updated_at = ? WHERE id = ?',
          [now, id]
        );
        saveDatabase();
        return true;
      }

      const rows = queryAll('SELECT * FROM transactions WHERE id = ? LIMIT 1', [id]);
      if (rows.length === 0) return false;
      const txn = rows[0] as unknown as Transaction;

      let targetId = typeof txn.merged_with === 'string' ? txn.merged_with : '';
      if (!targetId) {
        const candidate = findDuplicateCandidate(txn);
        targetId = candidate.exactId || candidate.pending?.targetId || '';
      }

      if (!targetId) return false;

      db.run('DELETE FROM transactions WHERE id = ?', [id]);
      db.run('UPDATE transactions SET updated_at = ? WHERE id = ?', [now, targetId]);
      saveDatabase();
      return true;
    } catch (error) {
      console.error('[IPC Error] resolve-duplicate:', error);
      throw error;
    }
  });

  ipcMain.handle('get-category-summary', async (_, year?: number): Promise<{ category: string; total: number; percentage: number }[]> => {
    try {
      const now = new Date();
      const targetYear = Number.isInteger(year) ? year : now.getFullYear();

      const rows = queryAll(
        `
        SELECT COALESCE(NULLIF(TRIM(category), ''), '其他') as category, SUM(amount) as total
        FROM transactions
        WHERE type = 'expense'
          AND strftime('%Y', date) = ?
        GROUP BY category
        ORDER BY total DESC
        LIMIT 5
      `,
        [String(targetYear)]
      );

      // Calculate total for percentage calculation
      const allRows = queryAll(
        `
        SELECT SUM(amount) as grandTotal
        FROM transactions
        WHERE type = 'expense'
          AND strftime('%Y', date) = ?
      `,
        [String(targetYear)]
      );

      const grandTotal = Number(allRows[0]?.grandTotal ?? 0);

      return rows.map((row) => ({
        category: String(row.category ?? '其他'),
        total: Number(row.total ?? 0),
        percentage: grandTotal > 0 ? (Number(row.total ?? 0) / grandTotal) * 100 : 0,
      }));
    } catch (error) {
      console.error('[IPC Error] get-category-summary:', error);
      throw error;
    }
  });

  ipcMain.handle('get-summary', async (_, query?: SummaryQuery): Promise<Summary> => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonthNumber = String(now.getMonth() + 1).padStart(2, '0');
      const targetYear = Number.isInteger(query?.year) ? Number(query?.year) : currentYear;
      const months = Math.min(24, Math.max(6, query?.months ?? 12));
      const targetMonth = `${targetYear}-${currentMonthNumber}`;

      const availableYearsRows = queryAll(`
        SELECT DISTINCT CAST(strftime('%Y', date) AS INTEGER) as year
        FROM transactions
        WHERE date IS NOT NULL AND date != ''
        ORDER BY year DESC
      `);
      const availableYears = availableYearsRows
        .map((row) => Number(row.year))
        .filter((year) => Number.isInteger(year) && year > 0);

      const monthlyRows = queryAll(
        `
        SELECT
          strftime('%Y-%m', date) as month,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income
        FROM transactions
        WHERE type IN ('expense', 'income')
          AND strftime('%Y', date) = ?
        GROUP BY month
        ORDER BY month DESC
        LIMIT ?
      `,
        [String(targetYear), months]
      );
      const monthly = monthlyRows.map((row) => ({
        month: String(row.month ?? ''),
        expense: Number(row.expense ?? 0),
        income: Number(row.income ?? 0),
      }));

      const currentMonthRows = queryAll(
        `
        SELECT
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income
        FROM transactions
        WHERE type IN ('expense', 'income')
          AND strftime('%Y-%m', date) = ?
      `,
        [targetMonth]
      );
      const currentMonthExpense = Number(currentMonthRows[0]?.expense ?? 0);
      const currentMonthIncome = Number(currentMonthRows[0]?.income ?? 0);
      const yearlyExpense = monthly.reduce((sum, item) => sum + item.expense, 0);
      const yearlyIncome = monthly.reduce((sum, item) => sum + item.income, 0);
      const yearlyNet = yearlyIncome - yearlyExpense;

      const byCategoryRows = queryAll(
        `
        SELECT COALESCE(NULLIF(TRIM(category), ''), '其他') as category, SUM(amount) as total
        FROM transactions
        WHERE type = 'expense'
          AND strftime('%Y', date) = ?
        GROUP BY category
        ORDER BY total DESC
      `,
        [String(targetYear)]
      );
      const byCategory = byCategoryRows.map((row) => ({
        category: String(row.category ?? '其他'),
        total: Number(row.total ?? 0),
      }));

      const topMerchantsRows = queryAll(
        `
        SELECT counterparty, COUNT(*) as count, SUM(amount) as total
        FROM transactions
        WHERE type = 'expense'
          AND strftime('%Y', date) = ?
          AND counterparty IS NOT NULL
          AND TRIM(counterparty) != ''
        GROUP BY counterparty
        ORDER BY total DESC, count DESC
        LIMIT 10
      `,
        [String(targetYear)]
      );
      const topMerchants = topMerchantsRows.map((row) => ({
        counterparty: String(row.counterparty ?? ''),
        count: Number(row.count ?? 0),
        total: Number(row.total ?? 0),
      }));

      return {
        year: targetYear,
        currentMonth: targetMonth,
        currentMonthExpense,
        currentMonthIncome,
        yearlyExpense,
        yearlyIncome,
        yearlyNet,
        monthly,
        byCategory,
        topMerchants,
        byMember: getMemberSpendingSummary(targetYear),
        byAccount: getAccountSpendingSummary(targetYear),
        availableYears: availableYears.length > 0 ? availableYears : [currentYear],
      };
    } catch (error) {
      console.error('[IPC Error] get-summary:', error);
      throw error;
    }
  });

  ipcMain.handle('update-category', withValidation('update-category', async (_, id: string, category: string) => {
    validateId(id, 'transaction id');
    validateCategory(category);
    const db = getDatabase();
    const now = new Date().toISOString();
    db.run('UPDATE transactions SET category = ?, updated_at = ? WHERE id = ?', [category, now, id]);
    saveDatabase();
    return true;
  }));

  ipcMain.handle('update-notes', withValidation('update-notes', async (_, id: string, notes: string) => {
    validateId(id, 'transaction id');
    const sanitizedNotes = validateString(notes, 'notes', 5000);
    const db = getDatabase();
    const now = new Date().toISOString();
    db.run('UPDATE transactions SET notes = ?, updated_at = ? WHERE id = ?', [sanitizedNotes || null, now, id]);
    saveDatabase();
    return true;
  }));

  ipcMain.handle('update-currency', async (_, id: string, currency: string) => {
    try {
      return updateTransactionCurrency(id, currency);
    } catch (error) {
      console.error('[IPC Error] update-currency:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-transaction', withValidation('delete-transaction', async (_, id: string) => {
    validateId(id, 'transaction id');
    const db = getDatabase();
    db.run('DELETE FROM transactions WHERE id = ?', [id]);
    saveDatabase();
    return true;
  }));

  ipcMain.handle('delete-transactions-by-ids', async (_, ids: string[]) => {
    try {
      if (!ids || ids.length === 0) {
        return { deleted: 0 };
      }
      const db = getDatabase();
      const placeholders = ids.map(() => '?').join(',');
      db.run(`DELETE FROM transactions WHERE id IN (${placeholders})`, ids);
      saveDatabase();
      return { deleted: ids.length };
    } catch (error) {
      console.error('[IPC Error] delete-transactions-by-ids:', error);
      throw error;
    }
  });

  // Quick Add - Create single transaction
  ipcMain.handle('create-transaction', async (_, transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = generateId();
    
    try {
      db.run(
        `INSERT INTO transactions (
          id, source, import_id, original_source, original_id, date, amount, currency,
          type, counterparty, description, bank_name, category, notes, tags,
          member_id, is_refund, refund_of, is_duplicate, duplicate_source, duplicate_type,
          merged_with, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          transaction.source || 'manual',
          transaction.import_id || null,
          transaction.original_source || null,
          transaction.original_id || null,
          transaction.date,
          transaction.amount,
          transaction.currency || 'CNY',
          transaction.type || 'expense',
          transaction.counterparty || null,
          transaction.description || null,
          transaction.bank_name || null,
          transaction.category || '其他',
          transaction.notes || null,
          transaction.tags || null,
          transaction.member_id || null,
          transaction.is_refund ? 1 : 0,
          transaction.refund_of || null,
          0,
          null,
          null,
          null,
          now,
          now,
        ]
      );
      saveDatabase();
      return { id, success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { id: null, success: false, error: message };
    }
  });

  // Get merchant history for autocomplete
  ipcMain.handle('get-merchant-history', async (_, limit: number = 20): Promise<string[]> => {
    try {
      const rows = queryAll(
        `SELECT DISTINCT counterparty
         FROM transactions
         WHERE counterparty IS NOT NULL
           AND TRIM(counterparty) != ''
         ORDER BY date DESC, created_at DESC
         LIMIT ?`,
        [limit]
      );
      return rows.map(row => String(row.counterparty || '')).filter(Boolean);
    } catch (error) {
      console.error('[IPC Error] get-merchant-history:', error);
      throw error;
    }
  });

  // Get categories list
  ipcMain.handle('get-categories', async (): Promise<string[]> => {
    try {
      const rows = queryAll(
        `SELECT DISTINCT COALESCE(NULLIF(TRIM(category), ''), '其他') as category
         FROM transactions
         WHERE category IS NOT NULL
         ORDER BY category`
      );
      return rows.map(row => String(row.category || '其他'));
    } catch (error) {
      console.error('[IPC Error] get-categories:', error);
      throw error;
    }
  });

  ipcMain.handle('export-csv', async (_, ids?: string[], startDate?: string, endDate?: string) => {
    try {
      let transactions;
      if (ids && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        transactions = queryAll(`SELECT * FROM transactions WHERE id IN (${placeholders}) ORDER BY date DESC, created_at DESC`, ids);
      } else {
        let query = 'SELECT * FROM transactions';
        const params: string[] = [];
        if (startDate) {
          query += ' WHERE date >= ?';
          params.push(startDate);
        }
        if (endDate) {
          query += startDate ? ' AND date <= ?' : ' WHERE date <= ?';
          params.push(endDate);
        }
        query += ' ORDER BY date DESC, created_at DESC';
        transactions = queryAll(query, params);
      }
      const result = await dialog.showSaveDialog({
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        defaultPath: `expenses-${new Date().toISOString().split('T')[0]}.csv`,
      });
      if (result.canceled || !result.filePath) return null;

      const csv = Papa.unparse(transactions);
      fs.writeFileSync(result.filePath, '\ufeff' + csv, 'utf-8');
      return result.filePath;
    } catch (error) {
      console.error('[IPC Error] export-csv:', error);
      throw error;
    }
  });

  ipcMain.handle('export-excel', async (_, startDate?: string, endDate?: string) => {
    try {
      let query = 'SELECT * FROM transactions';
      const params: string[] = [];
      if (startDate) {
        query += ' WHERE date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += startDate ? ' AND date <= ?' : ' WHERE date <= ?';
        params.push(endDate);
      }
      query += ' ORDER BY date DESC, created_at DESC';
      const transactions = queryAll(query, params);
      const result = await dialog.showSaveDialog({
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
        defaultPath: `expenses-${new Date().toISOString().split('T')[0]}.xlsx`,
      });
      if (result.canceled || !result.filePath) return null;

      writeXlsx(result.filePath, transactions);
      return result.filePath;
    } catch (error) {
      console.error('[IPC Error] export-excel:', error);
      throw error;
    }
  });

  ipcMain.handle('export-pdf', async (_, startDate?: string, endDate?: string) => {
    try {
      // Get transactions
      let txnQuery = 'SELECT * FROM transactions';
      const txnParams: string[] = [];
      if (startDate) {
        txnQuery += ' WHERE date >= ?';
        txnParams.push(startDate);
      }
      if (endDate) {
        txnQuery += startDate ? ' AND date <= ?' : ' WHERE date <= ?';
        txnParams.push(endDate);
      }
      txnQuery += ' ORDER BY date DESC';
      const transactions = queryAll(txnQuery, txnParams);

      // Get category summary
      let catQuery = `SELECT category, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE type = 'expense'`;
      const catParams: string[] = [];
      if (startDate) {
        catQuery += ' AND date >= ?';
        catParams.push(startDate);
      }
      if (endDate) {
        catQuery += ' AND date <= ?';
        catParams.push(endDate);
      }
      catQuery += ' GROUP BY category ORDER BY total DESC';
      const categorySummary = (queryAll(catQuery, catParams) as Array<{ category: string | null; total: number; count: number }>).map((r) => ({
        category: r.category || '未分类',
        total: r.total,
        count: r.count,
      }));

      // Get monthly summary
      let monthQuery = `SELECT strftime('%Y-%m', date) as month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
        FROM transactions`;
      const monthParams: string[] = [];
      if (startDate) {
        monthQuery += ' WHERE date >= ?';
        monthParams.push(startDate);
      }
      if (endDate) {
        monthQuery += startDate ? ' AND date <= ?' : ' WHERE date <= ?';
        monthParams.push(endDate);
      }
      monthQuery += ' GROUP BY month ORDER BY month';
      const monthlySummary = (queryAll(monthQuery, monthParams) as Array<{ month: string; income: number | null; expense: number | null }>).map((r) => ({
        month: r.month,
        income: r.income || 0,
        expense: r.expense || 0,
        net: (r.income || 0) - (r.expense || 0),
      }));

      const result = await dialog.showSaveDialog({
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        defaultPath: `expenses-report-${new Date().toISOString().split('T')[0]}.pdf`,
      });
      if (result.canceled || !result.filePath) return null;

      await generatePDFReport(result.filePath, {
        transactions: transactions as Array<{ id: string; date: string; amount: number; type: 'expense' | 'income' | 'transfer'; category?: string; counterparty?: string; description?: string; source: string }>,
        categorySummary,
        monthlySummary,
        startDate: startDate || '最早',
        endDate: endDate || '最新',
        generatedAt: new Date().toLocaleString('zh-CN'),
      });

      return result.filePath;
    } catch (error) {
      console.error('[IPC Error] export-pdf:', error);
      throw error;
    }
  });

  ipcMain.handle('backup-database', async () => {
    try {
      const sourcePath = getDatabasePath();
      const result = await dialog.showSaveDialog({
        filters: [{ name: 'Database Backup', extensions: ['db'] }],
        defaultPath: `expenses-backup-${new Date().toISOString().split('T')[0]}.db`,
      });
      if (result.canceled || !result.filePath) return null;

      saveDatabase();
      fs.copyFileSync(sourcePath, result.filePath);
      return result.filePath;
    } catch (error) {
      console.error('[IPC Error] backup-database:', error);
      throw error;
    }
  });

  ipcMain.handle('get-budgets', async (): Promise<Budget[]> => {
    try {
      return getBudgets();
    } catch (error) {
      console.error('[IPC Error] get-budgets:', error);
      throw error;
    }
  });

  ipcMain.handle('set-budget', async (_, id: string, yearMonth: string, amount: number, category: string | null) => {
    try {
      setBudget(id, yearMonth, amount, category);
      return true;
    } catch (error) {
      console.error('[IPC Error] set-budget:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-budget', async (_, id: string) => {
    try {
      deleteBudget(id);
      return true;
    } catch (error) {
      console.error('[IPC Error] delete-budget:', error);
      throw error;
    }
  });

  ipcMain.handle('get-budget-alerts', async (_, yearMonth?: string): Promise<BudgetAlert[]> => {
    try {
      const budgets = getBudgets();
      const now = new Date();
      const targetYearMonth = yearMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const alerts: BudgetAlert[] = [];

      for (const budget of budgets) {
        if (budget.year_month === targetYearMonth) {
          const spent = getBudgetSpending(budget.year_month, budget.category);
          const remaining = budget.amount - spent;
          const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 100;

          let status: 'ok' | 'warning' | 'exceeded' = 'ok';
          if (percentage >= 100) {
            status = 'exceeded';
          } else if (percentage >= 80) {
            status = 'warning';
          }

          alerts.push({
            budget,
            spent,
            remaining,
            percentage,
            status,
          });
        }
      }

      return alerts;
    } catch (error) {
      console.error('[IPC Error] get-budget-alerts:', error);
      throw error;
    }
  });

  ipcMain.handle('get-tags', async (_, id: string): Promise<string[]> => {
    try {
      return getTransactionTags(id);
    } catch (error) {
      console.error('[IPC Error] get-tags:', error);
      throw error;
    }
  });

  ipcMain.handle('add-tag', async (_, id: string, tag: string): Promise<boolean> => {
    try {
      return addTransactionTag(id, tag);
    } catch (error) {
      console.error('[IPC Error] add-tag:', error);
      throw error;
    }
  });

  ipcMain.handle('remove-tag', async (_, id: string, tag: string): Promise<boolean> => {
    try {
      return removeTransactionTag(id, tag);
    } catch (error) {
      console.error('[IPC Error] remove-tag:', error);
      throw error;
    }
  });

  ipcMain.handle('get-monthly-trend', async (_, months: number = 12): Promise<{
    data: Array<{
      month: string;
      expense: number;
      income: number;
      expenseChange: number | null;
      incomeChange: number | null;
    }>;
    currentMonth: string;
    previousMonth: string;
  }> => {
    try {
      const now = new Date();
      const targetYear = now.getFullYear();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Get data for the last N months
      const monthlyRows = queryAll(
        `
        SELECT
          strftime('%Y-%m', date) as month,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income
        FROM transactions
        WHERE type IN ('expense', 'income')
          AND date >= date('now', '-${months} months')
        GROUP BY month
        ORDER BY month ASC
        `
      );

      const data = monthlyRows.map((row, index) => {
        const expense = Number(row.expense ?? 0);
        const income = Number(row.income ?? 0);
        let expenseChange: number | null = null;
        let incomeChange: number | null = null;

        if (index > 0) {
          const prevRow = monthlyRows[index - 1];
          const prevExpense = Number(prevRow.expense ?? 0);
          const prevIncome = Number(prevRow.income ?? 0);

          if (prevExpense > 0) {
            expenseChange = ((expense - prevExpense) / prevExpense) * 100;
          }
          if (prevIncome > 0) {
            incomeChange = ((income - prevIncome) / prevIncome) * 100;
          }
        }

        return {
          month: String(row.month ?? ''),
          expense,
          income,
          expenseChange,
          incomeChange,
        };
      });

      // Calculate previous month for comparison
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      return {
        data,
        currentMonth,
        previousMonth,
      };
    } catch (error) {
      console.error('[IPC Error] get-monthly-trend:', error);
      throw error;
    }
  });

  // Member handlers
  ipcMain.handle('get-members', async (): Promise<Member[]> => {
    try {
      return getMembers();
    } catch (error) {
      console.error('[IPC Error] get-members:', error);
      throw error;
    }
  });

  ipcMain.handle('add-member', async (_, id: string, name: string, color: string): Promise<void> => {
    try {
      addMember(id, name, color);
    } catch (error) {
      console.error('[IPC Error] add-member:', error);
      throw error;
    }
  });

  ipcMain.handle('update-member', async (_, id: string, name: string, color: string): Promise<void> => {
    try {
      updateMember(id, name, color);
    } catch (error) {
      console.error('[IPC Error] update-member:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-member', async (_, id: string): Promise<void> => {
    try {
      deleteMember(id);
    } catch (error) {
      console.error('[IPC Error] delete-member:', error);
      throw error;
    }
  });

  ipcMain.handle('set-transaction-member', async (_, transactionId: string, memberId: string | null): Promise<void> => {
    try {
      setTransactionMember(transactionId, memberId);
    } catch (error) {
      console.error('[IPC Error] set-transaction-member:', error);
      throw error;
    }
  });

  ipcMain.handle('get-member-summary', async (_, year: number, month?: number): Promise<{ memberId: string; memberName: string; memberColor: string; total: number }[]> => {
    try {
      return getMemberSpendingSummary(year, month);
    } catch (error) {
      console.error('[IPC Error] get-member-summary:', error);
      throw error;
    }
  });

  // Account handlers
  ipcMain.handle('get-accounts', async (): Promise<Account[]> => {
    try {
      return getAccounts();
    } catch (error) {
      console.error('[IPC Error] get-accounts:', error);
      throw error;
    }
  });

  ipcMain.handle('add-account', async (_, id: string, name: string, type: Account['type'], balance: number, color: string): Promise<void> => {
    try {
      addAccount(id, name, type, balance, color);
    } catch (error) {
      console.error('[IPC Error] add-account:', error);
      throw error;
    }
  });

  ipcMain.handle('update-account', async (_, id: string, name: string, type: Account['type'], balance: number, color: string): Promise<void> => {
    try {
      updateAccount(id, name, type, balance, color);
    } catch (error) {
      console.error('[IPC Error] update-account:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-account', async (_, id: string): Promise<void> => {
    try {
      deleteAccount(id);
    } catch (error) {
      console.error('[IPC Error] delete-account:', error);
      throw error;
    }
  });

  ipcMain.handle('set-transaction-account', async (_, transactionId: string, accountId: string | null): Promise<void> => {
    try {
      setTransactionAccount(transactionId, accountId);
    } catch (error) {
      console.error('[IPC Error] set-transaction-account:', error);
      throw error;
    }
  });

  ipcMain.handle('get-account-summary', async (_, year: number, month?: number): Promise<AccountSummary[]> => {
    try {
      return getAccountSpendingSummary(year, month);
    } catch (error) {
      console.error('[IPC Error] get-account-summary:', error);
      throw error;
    }
  });

  ipcMain.handle('update-account-balance', async (_, id: string, balance: number): Promise<void> => {
    try {
      updateAccountBalance(id, balance);
    } catch (error) {
      console.error('[IPC Error] update-account-balance:', error);
      throw error;
    }
  });

  // Phase 1: Triage Rules handlers
  ipcMain.handle('apply-triage-rules', async (_, transactions: Transaction[]) => {
    try {
      return applyTriageRules(transactions);
    } catch (error) {
      console.error('[IPC Error] apply-triage-rules:', error);
      throw error;
    }
  });

  ipcMain.handle('auto-apply-triage-rules', async (_, transactions: Transaction[]) => {
    try {
      return autoApplyTriageRules(transactions);
    } catch (error) {
      console.error('[IPC Error] auto-apply-triage-rules:', error);
      throw error;
    }
  });

  // Batch Assignment Prompt handlers
  ipcMain.handle('check-similar-assignments', async (_, transaction: Transaction, memberId: string, threshold?: number) => {
    try {
      return checkSimilarAssignments(transaction, memberId, threshold ?? 2);
    } catch (error) {
      console.error('[IPC Error] check-similar-assignments:', error);
      throw error;
    }
  });

  ipcMain.handle('batch-assign-similar', async (_, transaction: Transaction, memberId: string) => {
    try {
      return batchAssignSimilar(transaction, memberId);
    } catch (error) {
      console.error('[IPC Error] batch-assign-similar:', error);
      throw error;
    }
  });

  // Email account handlers
  ipcMain.handle('get-email-accounts', async (): Promise<EmailAccount[]> => {
    try {
      return getEmailAccounts();
    } catch (error) {
      console.error('[IPC Error] get-email-accounts:', error);
      throw error;
    }
  });

  ipcMain.handle('add-email-account', async (
    _,
    id: string,
    email: string,
    imapHost: string,
    imapPort: number,
    smtpHost: string,
    smtpPort: number,
    username: string,
    password: string
  ): Promise<void> => {
    try {
      addEmailAccount(id, email, imapHost, imapPort, smtpHost, smtpPort, username, password);
    } catch (error) {
      console.error('[IPC Error] add-email-account:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-email-account', async (_, id: string): Promise<void> => {
    try {
      deleteEmailAccount(id);
    } catch (error) {
      console.error('[IPC Error] delete-email-account:', error);
      throw error;
    }
  });

  ipcMain.handle('get-email-messages', async (_, accountId: string, limit?: number): Promise<EmailMessage[]> => {
    try {
      return getEmailMessages(accountId, limit ?? 50);
    } catch (error) {
      console.error('[IPC Error] get-email-messages:', error);
      throw error;
    }
  });

  ipcMain.handle('sync-emails', async (_, accountId: string) => {
    try {
      // Dynamic import to avoid issues
      const { syncEmailAccount } = await import('./email');
      return syncEmailAccount({ accountId });
    } catch (error) {
      console.error('[IPC Error] sync-emails:', error);
      throw error;
    }
  });

  // Source Coverage IPC handlers
  ipcMain.handle('get-source-coverage', async (_, year: number) => {
    try {
      return getSourceCoverage(year);
    } catch (error) {
      console.error('[IPC Error] get-source-coverage:', error);
      throw error;
    }
  });

  ipcMain.handle('get-last-import-by-source', async () => {
    try {
      return getLastImportBySource();
    } catch (error) {
      console.error('[IPC Error] get-last-import-by-source:', error);
      throw error;
    }
  });

  // Mark-as-zero handlers for Source Coverage
  ipcMain.handle('mark-as-zero', async (_, source: string, month: string) => {
    try {
      markAsZero(source, month);
      return true;
    } catch (error) {
      console.error('[IPC Error] mark-as-zero:', error);
      throw error;
    }
  });

  ipcMain.handle('unmark-as-zero', async (_, source: string, month: string) => {
    try {
      unmarkAsZero(source, month);
      return true;
    } catch (error) {
      console.error('[IPC Error] unmark-as-zero:', error);
      throw error;
    }
  });

  ipcMain.handle('is-marked-as-zero', async (_, source: string, month: string) => {
    try {
      return isMarkedAsZero(source, month);
    } catch (error) {
      console.error('[IPC Error] is-marked-as-zero:', error);
      throw error;
    }
  });

  ipcMain.handle('get-marked-as-zero', async (_, year: number) => {
    try {
      return getMarkedAsZero(year);
    } catch (error) {
      console.error('[IPC Error] get-marked-as-zero:', error);
      throw error;
    }
  });

  // Recurring Transaction handlers
  ipcMain.handle('get-recurring-transactions', async () => {
    try {
      return getRecurringTransactions();
    } catch (error) {
      console.error('[IPC Error] get-recurring-transactions:', error);
      throw error;
    }
  });

  ipcMain.handle('add-recurring-transaction', async (_, data: {
    id: string;
    name: string;
    amount: number;
    type: 'expense' | 'income';
    category: string;
    counterparty: string;
    memberId: string | null;
    accountId: string | null;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    startDate: string;
    endDate: string | null;
    dayOfMonth: number | null;
    dayOfWeek: number | null;
  }) => {
    try {
      addRecurringTransaction(
        data.id, data.name, data.amount, data.type, data.category,
        data.counterparty, data.memberId, data.accountId, data.frequency,
        data.startDate, data.endDate, data.dayOfMonth, data.dayOfWeek
      );
      return true;
    } catch (error) {
      console.error('[IPC Error] add-recurring-transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('update-recurring-transaction', async (_, data: {
    id: string;
    name: string;
    amount: number;
    type: 'expense' | 'income';
    category: string;
    counterparty: string;
    memberId: string | null;
    accountId: string | null;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    startDate: string;
    endDate: string | null;
    dayOfMonth: number | null;
    dayOfWeek: number | null;
    isActive: boolean;
  }) => {
    try {
      updateRecurringTransaction(
        data.id, data.name, data.amount, data.type, data.category,
        data.counterparty, data.memberId, data.accountId, data.frequency,
        data.startDate, data.endDate, data.dayOfMonth, data.dayOfWeek, data.isActive
      );
      return true;
    } catch (error) {
      console.error('[IPC Error] update-recurring-transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-recurring-transaction', async (_, id: string) => {
    try {
      deleteRecurringTransaction(id);
      return true;
    } catch (error) {
      console.error('[IPC Error] delete-recurring-transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('toggle-recurring-transaction', async (_, id: string, isActive: boolean) => {
    try {
      toggleRecurringTransaction(id, isActive);
      return true;
    } catch (error) {
      console.error('[IPC Error] toggle-recurring-transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('generate-recurring-transactions', async () => {
    try {
      return generateRecurringTransactions();
    } catch (error) {
      console.error('[IPC Error] generate-recurring-transactions:', error);
      throw error;
    }
  });

  // Investment Account handlers
  ipcMain.handle('get-investment-accounts', async () => {
    try {
      return getInvestmentAccounts();
    } catch (error) {
      console.error('[IPC Error] get-investment-accounts:', error);
      throw error;
    }
  });

  ipcMain.handle('add-investment-account', async (_, data: {
    id: string;
    name: string;
    type: 'stock' | 'fund' | 'bond' | 'crypto';
    symbol: string;
    currency: string;
    broker: string;
    notes: string;
  }) => {
    try {
      addInvestmentAccount(data.id, data.name, data.type, data.symbol, data.currency, data.broker, data.notes);
      return true;
    } catch (error) {
      console.error('[IPC Error] add-investment-account:', error);
      throw error;
    }
  });

  ipcMain.handle('update-investment-account', async (_, data: {
    id: string;
    name: string;
    type: 'stock' | 'fund' | 'bond' | 'crypto';
    symbol: string;
    currency: string;
    broker: string;
    notes: string;
  }) => {
    try {
      updateInvestmentAccount(data.id, data.name, data.type, data.symbol, data.currency, data.broker, data.notes);
      return true;
    } catch (error) {
      console.error('[IPC Error] update-investment-account:', error);
      throw error;
    }
  });

  ipcMain.handle('update-investment-price', async (_, id: string, currentPrice: number) => {
    try {
      updateInvestmentPrice(id, currentPrice);
      return true;
    } catch (error) {
      console.error('[IPC Error] update-investment-price:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-investment-account', async (_, id: string) => {
    try {
      deleteInvestmentAccount(id);
      return true;
    } catch (error) {
      console.error('[IPC Error] delete-investment-account:', error);
      throw error;
    }
  });

  ipcMain.handle('get-investment-transactions', async (_, accountId?: string) => {
    try {
      return getInvestmentTransactions(accountId);
    } catch (error) {
      console.error('[IPC Error] get-investment-transactions:', error);
      throw error;
    }
  });

  ipcMain.handle('add-investment-transaction', async (_, data: {
    id: string;
    accountId: string;
    type: 'buy' | 'sell' | 'dividend';
    shares: number;
    price: number;
    fee: number;
    date: string;
    notes: string;
  }) => {
    try {
      addInvestmentTransaction(data.id, data.accountId, data.type, data.shares, data.price, data.fee, data.date, data.notes);
      return true;
    } catch (error) {
      console.error('[IPC Error] add-investment-transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-investment-transaction', async (_, id: string) => {
    try {
      deleteInvestmentTransaction(id);
      return true;
    } catch (error) {
      console.error('[IPC Error] delete-investment-transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('get-investment-summary', async () => {
    try {
      return getInvestmentSummary();
    } catch (error) {
      console.error('[IPC Error] get-investment-summary:', error);
      throw error;
    }
  });

  // Savings Goals handlers
  ipcMain.handle('get-savings-goals', async () => {
    try {
      return getSavingsGoals();
    } catch (error) {
      console.error('[IPC Error] get-savings-goals:', error);
      throw error;
    }
  });

  ipcMain.handle('add-savings-goal', async (_, data: {
    id: string;
    name: string;
    targetAmount: number;
    deadline: string | null;
    category: string;
    color: string;
  }) => {
    try {
      addSavingsGoal(data.id, data.name, data.targetAmount, data.deadline, data.category, data.color);
      return true;
    } catch (error) {
      console.error('[IPC Error] add-savings-goal:', error);
      throw error;
    }
  });

  ipcMain.handle('update-savings-goal', async (_, data: {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string | null;
    category: string;
    color: string;
    isActive: boolean;
  }) => {
    try {
      updateSavingsGoal(data.id, data.name, data.targetAmount, data.currentAmount, data.deadline, data.category, data.color, data.isActive);
      return true;
    } catch (error) {
      console.error('[IPC Error] update-savings-goal:', error);
      throw error;
    }
  });

  ipcMain.handle('add-to-savings-goal', async (_, id: string, amount: number) => {
    try {
      addToSavingsGoal(id, amount);
      return true;
    } catch (error) {
      console.error('[IPC Error] add-to-savings-goal:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-savings-goal', async (_, id: string) => {
    try {
      deleteSavingsGoal(id);
      return true;
    } catch (error) {
      console.error('[IPC Error] delete-savings-goal:', error);
      throw error;
    }
  });

  ipcMain.handle('get-savings-summary', async () => {
    try {
      return getSavingsSummary();
    } catch (error) {
      console.error('[IPC Error] get-savings-summary:', error);
      throw error;
    }
  });

  // Cash Flow IPC handlers
  ipcMain.handle('get-cashflow-forecast', async (_, accountId?: string, days?: number) => {
    try {
      return generateCashFlowForecast(accountId, days);
    } catch (error) {
      console.error('[IPC Error] get-cashflow-forecast:', error);
      throw error;
    }
  });

  ipcMain.handle('optimize-bill-payment', async (_, dueDate: string, amount: number) => {
    try {
      const forecast = await generateCashFlowForecast();
      return optimizeBillPaymentDate(dueDate, amount, forecast);
    } catch (error) {
      console.error('[IPC Error] optimize-bill-payment:', error);
      throw error;
    }
  });

  // Category ML IPC handlers
  ipcMain.handle('predict-category', async (_, merchant: string, description: string, amount: number, date?: string) => {
    try {
      return predictCategory(merchant, description, amount, date);
    } catch (error) {
      console.error('[IPC Error] predict-category:', error);
      throw error;
    }
  });

  ipcMain.handle('learn-category', async (_, merchant: string, description: string, amount: number, category: string, date?: string) => {
    try {
      await learnFromCorrection(merchant, description, amount, category, date);
      return true;
    } catch (error) {
      console.error('[IPC Error] learn-category:', error);
      throw error;
    }
  });

  ipcMain.handle('get-training-stats', async () => {
    try {
      return getTrainingStats();
    } catch (error) {
      console.error('[IPC Error] get-training-stats:', error);
      throw error;
    }
  });

  ipcMain.handle('batch-categorize', async (_, dryRun: boolean = true) => {
    try {
      return batchCategorize(dryRun);
    } catch (error) {
      console.error('[IPC Error] batch-categorize:', error);
      throw error;
    }
  });

  // NLP IPC handlers
  ipcMain.handle('parse-nlp', async (_, text: string) => {
    try {
      return parseNaturalLanguage(text);
    } catch (error) {
      console.error('[IPC Error] parse-nlp:', error);
      throw error;
    }
  });

  // Sync IPC handlers
  ipcMain.handle('get-device-identity', async () => {
    try {
      return generateDeviceIdentity();
    } catch (error) {
      console.error('[IPC Error] get-device-identity:', error);
      throw error;
    }
  });

  ipcMain.handle('get-device-fingerprint', async (_, publicKey: string) => {
    try {
      return getDeviceFingerprint(publicKey);
    } catch (error) {
      console.error('[IPC Error] get-device-fingerprint:', error);
      throw error;
    }
  });

  ipcMain.handle('get-sync-status', async () => {
    try {
      return getSyncStatus();
    } catch (error) {
      console.error('[IPC Error] get-sync-status:', error);
      throw error;
    }
  });

  // Template IPC handlers
  ipcMain.handle('create-template', async (_, transactionId: string, name: string) => {
    try {
      return createTemplateFromTransaction(transactionId, name);
    } catch (error) {
      console.error('[IPC Error] create-template:', error);
      throw error;
    }
  });

  ipcMain.handle('get-templates', async (_, category?: string, favoritesOnly?: boolean) => {
    try {
      return getTemplates(category, favoritesOnly);
    } catch (error) {
      console.error('[IPC Error] get-templates:', error);
      throw error;
    }
  });

  // Health check IPC handlers
  ipcMain.handle('run-health-check', async () => {
    try {
      return runHealthCheck();
    } catch (error) {
      console.error('[IPC Error] run-health-check:', error);
      throw error;
    }
  });

  ipcMain.handle('fix-health-issue', async (_, issue: { type: string; table: string; recordId: string }) => {
    try {
      return fixIssue(issue as any);
    } catch (error) {
      console.error('[IPC Error] fix-health-issue:', error);
      throw error;
    }
  });

  // Backup IPC handlers
  ipcMain.handle('create-backup', async (_, description?: string) => {
    try {
      return createBackup(description);
    } catch (error) {
      console.error('[IPC Error] create-backup:', error);
      throw error;
    }
  });

  ipcMain.handle('list-backups', async () => {
    try {
      return listBackups();
    } catch (error) {
      console.error('[IPC Error] list-backups:', error);
      throw error;
    }
  });

  ipcMain.handle('restore-backup', async (_, backupId: string) => {
    try {
      return restoreBackup(backupId);
    } catch (error) {
      console.error('[IPC Error] restore-backup:', error);
      throw error;
    }
  });

  // Rounds 11-20 IPC handlers
  ipcMain.handle('check-scheduled-tasks', async () => {
    try {
      checkScheduledTasks();
      return true;
    } catch (error) {
      console.error('[IPC Error] check-scheduled-tasks:', error);
      throw error;
    }
  });

  ipcMain.handle('analyze-trends', async (_, months?: number) => {
    try {
      return analyzeCategoryTrends(months);
    } catch (error) {
      console.error('[IPC Error] analyze-trends:', error);
      throw error;
    }
  });

  ipcMain.handle('detect-fraud', async () => {
    try {
      return detectSuspiciousTransactions();
    } catch (error) {
      console.error('[IPC Error] detect-fraud:', error);
      throw error;
    }
  });

  ipcMain.handle('generate-tax-report', async (_, year: number) => {
    try {
      return generateTaxReport(year);
    } catch (error) {
      console.error('[IPC Error] generate-tax-report:', error);
      throw error;
    }
  });

  ipcMain.handle('convert-currency', async (_, amount: number, from: string, to: string) => {
    try {
      return convertCurrency(amount, from as any, to as any);
    } catch (error) {
      console.error('[IPC Error] convert-currency:', error);
      throw error;
    }
  });

  ipcMain.handle('calculate-goal-progress', async (_, goalId: string) => {
    try {
      return calculateGoalProgress(goalId);
    } catch (error) {
      console.error('[IPC Error] calculate-goal-progress:', error);
      throw error;
    }
  });

  ipcMain.handle('get-merchant-analytics', async (_, merchant: string) => {
    try {
      return getMerchantAnalytics(merchant);
    } catch (error) {
      console.error('[IPC Error] get-merchant-analytics:', error);
      throw error;
    }
  });

  ipcMain.handle('get-debt-summary', async () => {
    try {
      return getDebtSummary();
    } catch (error) {
      console.error('[IPC Error] get-debt-summary:', error);
      throw error;
    }
  });

  ipcMain.handle('get-wishlist-total', async () => {
    try {
      return getWishlistTotal();
    } catch (error) {
      console.error('[IPC Error] get-wishlist-total:', error);
      throw error;
    }
  });

  ipcMain.handle('generate-insights', async () => {
    try {
      return generateInsights();
    } catch (error) {
      console.error('[IPC Error] generate-insights:', error);
      throw error;
    }
  });
}
