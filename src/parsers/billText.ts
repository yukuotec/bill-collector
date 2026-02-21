import { Transaction } from '../shared/types';
import { categorize } from '../shared/constants';
import { generateId, normalizeDate, parseAmount } from './utils';

type Source = 'alipay' | 'wechat' | 'yunshanfu' | 'bank';

const DATE_PATTERN = /(20\d{2}[\/-年.]\d{1,2}[\/-月.]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/;
const AMOUNT_PATTERN = /[-+]?\s*[¥￥]?\d[\d,]*(?:\.\d{1,2})?/g;

function compact(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function shouldSkipLine(line: string): boolean {
  if (!line) return true;
  if (line.length < 6) return true;
  if (/^(页码|Page|交易记录|账单明细|导出时间|币种|总计|合计)/i.test(line)) return true;
  if (/(交易时间|日期|金额|收支|类型|备注|交易对方|商户)/.test(line) && !DATE_PATTERN.test(line)) return true;
  return false;
}

function inferTypeFromText(text: string, amountText: string): Transaction['type'] {
  if (/(转账|不计收支|中性)/.test(text)) return 'transfer';
  if (/(收入|退款|入账|返现)/.test(text)) return 'income';
  if (/(支出|消费|付款|扣款)/.test(text)) return 'expense';
  if (/^-/.test(amountText)) return 'expense';
  if (/^\+/.test(amountText)) return 'income';
  return 'expense';
}

function extractDescription(line: string, dateText: string, amountText: string): string {
  let description = line;
  description = description.replace(dateText, ' ');
  const amountIndex = description.lastIndexOf(amountText);
  if (amountIndex >= 0) {
    description = description.slice(0, amountIndex);
  }
  return compact(description).replace(/[|，,;；]+$/, '');
}

function maybeParseLine(line: string, source: Source, now: string): Transaction | null {
  const dateMatch = line.match(DATE_PATTERN);
  if (!dateMatch) return null;

  const amountMatches = Array.from(line.matchAll(AMOUNT_PATTERN)).map((match) => match[0]);
  if (amountMatches.length === 0) return null;

  const dateText = dateMatch[1];
  const amountText = amountMatches[amountMatches.length - 1];
  const date = normalizeDate(dateText.replace(/[年月]/g, '-').replace(/日/g, ''));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const amount = parseAmount(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const description = extractDescription(line, dateText, amountText);
  const type = inferTypeFromText(line, amountText);

  return {
    id: generateId(),
    source,
    date,
    amount: Math.abs(amount),
    type,
    counterparty: '',
    description,
    category: categorize(description),
    created_at: now,
    updated_at: now,
  };
}

export function parseBillText(content: string, source: Source): Transaction[] {
  const now = new Date().toISOString();
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => compact(line));

  const results: Transaction[] = [];
  const dedupe = new Set<string>();

  for (const line of lines) {
    if (shouldSkipLine(line)) continue;

    const txn = maybeParseLine(line, source, now);
    if (!txn) continue;

    const key = `${txn.date}|${txn.amount}|${txn.description || ''}|${txn.type}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    results.push(txn);
  }

  return results;
}
