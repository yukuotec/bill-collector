import Papa from 'papaparse';
import { Transaction } from '../shared/types';
import { categorize } from '../shared/constants';
import { generateId, inferType, isRefundText, normalizeDate, parseAmount } from './utils';

function detectHeaderLine(lines: string[]): number {
  return lines.findIndex((line) => {
    const normalized = line.replace(/\ufeff/g, '').trim();
    if (!normalized) return false;

    const hasDate = /(交易时间|日期时间|日期)/.test(normalized);
    const hasAmount = /(交易金额|金额|支出|收入)/.test(normalized);
    return hasDate && hasAmount;
  });
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

export function parseYunshanfu(content: string): Transaction[] {
  const transactions: Transaction[] = [];
  const now = new Date().toISOString();

  for (const row of parseRows(content)) {
    const dateStr = row['交易时间'] || row['日期'] || row['时间'];
    const amountStr = row['交易金额'] || row['金额'] || row['金额(元)'] || row['金额（元）'] || row['支出'] || row['收入'];
    const description = row['交易说明'] || row['商品说明'] || row['备注'] || '';
    const counterparty = row['交易对方'] || row['商户'] || row['收款方'] || '';
    const flow = row['收/支'] || row['收支类型'] || '';
    const typeStr = row['交易类型'] || row['类型'] || flow || '';

    if (!dateStr || !amountStr) continue;
    if (dateStr.includes('共') || dateStr.includes('合计')) continue;

    const date = normalizeDate(dateStr);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const amount = parseAmount(amountStr);
    const refundLike = isRefundText(`${typeStr} ${flow} ${description}`);
    const transferLike =
      (flow.includes('不计收支') && !refundLike) ||
      /中性/.test(typeStr) ||
      (/转账/.test(typeStr) && !flow.includes('收入') && !flow.includes('支出'));
    const type = refundLike
      ? 'income'
      : transferLike
        ? 'transfer'
        : inferType({
            typeText: `${typeStr}${flow}`,
            expenseField: flow.includes('支出') ? amountStr : row['支出'],
            incomeField: flow.includes('收入') ? amountStr : row['收入'],
            amountText: amountStr,
          });

    transactions.push({
      id: generateId(),
      source: 'yunshanfu',
      original_id: row['交易流水号'] || row['订单号'],
      date,
      amount: Math.abs(amount),
      type,
      is_refund: refundLike ? 1 : 0,
      counterparty,
      description,
      category: categorize(description || counterparty),
      created_at: now,
      updated_at: now,
    });
  }

  return transactions;
}
