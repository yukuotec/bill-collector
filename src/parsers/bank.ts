import Papa from 'papaparse';
import { categorize } from '../shared/constants';
import { Transaction } from '../shared/types';
import { generateId, normalizeDate, parseAmount } from './utils';

type HeaderMap = {
  date?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  direction?: string;
  counterparty?: string;
  description?: string;
  balance?: string;
  bankName?: string;
  originalId?: string;
};

const HEADER_ALIASES: Record<keyof HeaderMap, string[]> = {
  date: [
    '交易时间',
    '交易日期',
    '日期',
    '记账日期',
    '入账日期',
    'Date',
    'Transaction Date',
    'Value Date',
    'Posting Date',
  ],
  amount: ['金额', '交易金额', '发生额', 'Amount', 'Transaction Amount'],
  debit: ['借方金额', '借方', '支出金额', '支出', 'Debit', 'Withdrawal'],
  credit: ['贷方金额', '贷方', '收入金额', '收入', 'Credit', 'Deposit'],
  direction: ['借贷标志', '方向', '收支', '收/支', '类型', 'Type', 'Direction', 'Dr/Cr'],
  counterparty: ['交易对方', '对方账户', '商户', '收款方', '付款方', 'Counterparty', 'Merchant', 'Payee', 'Payer'],
  description: ['摘要', '备注', '用途', '附言', '交易说明', 'Description', 'Narrative', 'Memo', 'Remark'],
  balance: ['余额', '账户余额', '可用余额', 'Balance', 'Account Balance'],
  bankName: ['银行', '银行名称', '开户行', 'Bank', 'Bank Name'],
  originalId: ['交易流水号', '交易序号', '凭证号', '订单号', '流水号', 'Reference', 'Txn ID', 'Transaction ID'],
};

function cleanHeader(value: string): string {
  return value
    .replace(/\ufeff/g, '')
    .replace(/["']/g, '')
    .trim()
    .toLowerCase();
}

function detectHeaderLine(lines: string[]): number {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\ufeff/g, '').trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    const hasDate = /(交易时间|交易日期|记账日期|date|posting date|value date)/.test(lower);
    const hasAmount = /(金额|amount|借方|贷方|debit|credit)/.test(lower);
    if (hasDate && hasAmount) {
      return i;
    }
  }
  return -1;
}

function parseRows(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const headerIndex = detectHeaderLine(lines);
  const csv = headerIndex >= 0 ? lines.slice(headerIndex).join('\n') : content;
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.replace(/\ufeff/g, '').trim(),
  });
  return result.data;
}

function resolveHeaderMap(rows: Record<string, string>[]): HeaderMap {
  const keys = new Set<string>();
  for (const row of rows.slice(0, 20)) {
    for (const key of Object.keys(row)) {
      if (key && key.trim()) keys.add(key);
    }
  }

  const entries = [...keys];
  const map: HeaderMap = {};

  const findKey = (aliases: string[]): string | undefined => {
    const normalizedAliases = aliases.map((alias) => cleanHeader(alias));
    for (const key of entries) {
      const normalizedKey = cleanHeader(key);
      if (normalizedAliases.includes(normalizedKey)) return key;
    }
    for (const key of entries) {
      const normalizedKey = cleanHeader(key);
      if (normalizedAliases.some((alias) => normalizedKey.includes(alias))) return key;
    }
    return undefined;
  };

  (Object.keys(HEADER_ALIASES) as Array<keyof HeaderMap>).forEach((field) => {
    map[field] = findKey(HEADER_ALIASES[field]);
  });

  return map;
}

function pick(row: Record<string, string>, key?: string): string {
  if (!key) return '';
  return (row[key] || '').trim();
}

function inferTypeFromDirection(direction: string): 'expense' | 'income' | null {
  if (!direction) return null;
  const value = direction.toLowerCase();
  if (/(贷|收入|入账|credit|cr|deposit|incoming)/i.test(value)) return 'income';
  if (/(借|支出|付款|debit|dr|withdraw|outgoing)/i.test(value)) return 'expense';
  return null;
}

export function parseBank(content: string): Transaction[] {
  const rows = parseRows(content);
  if (rows.length === 0) return [];

  const headers = resolveHeaderMap(rows);
  const transactions: Transaction[] = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    const rawDate = pick(row, headers.date);
    if (!rawDate || /(合计|汇总|总计|total)/i.test(rawDate)) continue;

    const date = normalizeDate(rawDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const debitText = pick(row, headers.debit);
    const creditText = pick(row, headers.credit);
    const amountText = pick(row, headers.amount);
    const directionText = pick(row, headers.direction);

    const debit = parseAmount(debitText);
    const credit = parseAmount(creditText);
    const signedAmount = amountText.replace(/[,￥¥\s]/g, '');
    const singleAmount = parseAmount(amountText);

    let type: 'expense' | 'income' = 'expense';
    let amount = 0;

    if (debit > 0 || credit > 0) {
      if (credit > 0 && debit <= 0) {
        type = 'income';
        amount = credit;
      } else if (debit > 0 && credit <= 0) {
        type = 'expense';
        amount = debit;
      } else {
        const inferred = inferTypeFromDirection(directionText);
        type = inferred || (credit >= debit ? 'income' : 'expense');
        amount = Math.max(debit, credit);
      }
    } else if (singleAmount > 0) {
      const inferred = inferTypeFromDirection(directionText);
      type = inferred || (signedAmount.startsWith('-') ? 'expense' : 'income');
      amount = singleAmount;
    }

    if (amount <= 0) continue;

    const counterparty = pick(row, headers.counterparty);
    const description = pick(row, headers.description);
    const bankName = pick(row, headers.bankName);
    const balanceValue = pick(row, headers.balance);
    const notes = balanceValue ? `余额: ${balanceValue}` : undefined;

    transactions.push({
      id: generateId(),
      source: 'bank',
      original_id: pick(row, headers.originalId) || undefined,
      date,
      amount: Math.abs(amount),
      type,
      counterparty,
      description,
      category: categorize(description || counterparty),
      notes,
      bank_name: bankName || undefined,
      created_at: now,
      updated_at: now,
    });
  }

  return transactions;
}
