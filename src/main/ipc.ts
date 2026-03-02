import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { TextDecoder } from 'util';
import Papa from 'papaparse';
import { Dialog, IpcMain } from 'electron';
import { getDatabase, getDatabasePath, deleteBudget, getBudgets, getBudgetSpending, insertTransactions, saveDatabase, setBudget, getTransactionTags, addTransactionTag, removeTransactionTag } from './database';
import { parseAlipay } from '../parsers/alipay';
import { parseBank } from '../parsers/bank';
import { parseWechat } from '../parsers/wechat';
import { parseYunshanfu } from '../parsers/yunshanfu';
import { parsePdfBill } from '../parsers/pdf';
import { parseHtmlBill } from '../parsers/html';
import { parseImageBillWithOcr } from '../parsers/ocr';
import { Budget, BudgetAlert, DuplicateReviewItem, DuplicateType, Summary, SummaryQuery, Transaction, TransactionListResponse, TransactionQuery, TransactionSource } from '../shared/types';
import { buildTransactionWhereClause } from './ipcFilters';

type Source = TransactionSource;
type SupportedImportExt = '.csv' | '.xlsx' | '.pdf' | '.html' | '.htm' | '.png';

interface ImportCsvOptions {
  dryRun?: boolean;
  previewLimit?: number;
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
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters.length > 0 ? filters : [{ name: '账单文件', extensions: ['csv', 'xlsx', 'pdf', 'html', 'png'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('import-csv', async (_, filePath: string, source: Source, options?: ImportCsvOptions) => {
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
          created_at: now,
          updated_at: now,
        });
      }

      result.inserted = insertTransactions(toInsert);

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
  });

  ipcMain.handle('get-duplicate-transactions', async (): Promise<DuplicateReviewItem[]> => {
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
  });

  ipcMain.handle('resolve-duplicate', async (_, id: string, action: 'keep' | 'merge') => {
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
  });

  ipcMain.handle('get-category-summary', async (_, year?: number): Promise<{ category: string; total: number; percentage: number }[]> => {
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
  });

  ipcMain.handle('get-summary', async (_, query?: SummaryQuery): Promise<Summary> => {
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
      availableYears: availableYears.length > 0 ? availableYears : [currentYear],
    };
  });

  ipcMain.handle('update-category', async (_, id: string, category: string) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.run('UPDATE transactions SET category = ?, updated_at = ? WHERE id = ?', [category, now, id]);
    saveDatabase();
    return true;
  });

  ipcMain.handle('update-notes', async (_, id: string, notes: string) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.run('UPDATE transactions SET notes = ?, updated_at = ? WHERE id = ?', [notes || null, now, id]);
    saveDatabase();
    return true;
  });

  ipcMain.handle('delete-transaction', async (_, id: string) => {
    const db = getDatabase();
    db.run('DELETE FROM transactions WHERE id = ?', [id]);
    saveDatabase();
    return true;
  });

  ipcMain.handle('delete-transactions-by-ids', async (_, ids: string[]) => {
    if (!ids || ids.length === 0) {
      return { deleted: 0 };
    }
    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM transactions WHERE id IN (${placeholders})`, ids);
    saveDatabase();
    return { deleted: ids.length };
  });

  ipcMain.handle('export-csv', async (_, ids?: string[]) => {
    let transactions;
    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      transactions = queryAll(`SELECT * FROM transactions WHERE id IN (${placeholders}) ORDER BY date DESC, created_at DESC`, ids);
    } else {
      transactions = queryAll('SELECT * FROM transactions ORDER BY date DESC, created_at DESC');
    }
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      defaultPath: `expenses-${new Date().toISOString().split('T')[0]}.csv`,
    });
    if (result.canceled || !result.filePath) return null;

    const csv = Papa.unparse(transactions);
    fs.writeFileSync(result.filePath, '\ufeff' + csv, 'utf-8');
    return result.filePath;
  });

  ipcMain.handle('export-excel', async () => {
    const transactions = queryAll('SELECT * FROM transactions ORDER BY date DESC, created_at DESC');
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
      defaultPath: `expenses-${new Date().toISOString().split('T')[0]}.xlsx`,
    });
    if (result.canceled || !result.filePath) return null;

    writeXlsx(result.filePath, transactions);
    return result.filePath;
  });

  ipcMain.handle('backup-database', async () => {
    const sourcePath = getDatabasePath();
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
      defaultPath: `expenses-backup-${new Date().toISOString().split('T')[0]}.db`,
    });
    if (result.canceled || !result.filePath) return null;

    saveDatabase();
    fs.copyFileSync(sourcePath, result.filePath);
    return result.filePath;
  });

  ipcMain.handle('get-budgets', async (): Promise<Budget[]> => {
    return getBudgets();
  });

  ipcMain.handle('set-budget', async (_, id: string, yearMonth: string, amount: number, category: string | null) => {
    setBudget(id, yearMonth, amount, category);
    return true;
  });

  ipcMain.handle('delete-budget', async (_, id: string) => {
    deleteBudget(id);
    return true;
  });

  ipcMain.handle('get-budget-alerts', async (_, yearMonth?: string): Promise<BudgetAlert[]> => {
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
  });

  ipcMain.handle('get-tags', async (_, id: string): Promise<string[]> => {
    return getTransactionTags(id);
  });

  ipcMain.handle('add-tag', async (_, id: string, tag: string): Promise<boolean> => {
    return addTransactionTag(id, tag);
  });

  ipcMain.handle('remove-tag', async (_, id: string, tag: string): Promise<boolean> => {
    return removeTransactionTag(id, tag);
  });
}
