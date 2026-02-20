import Papa from 'papaparse';
import { Transaction } from '../shared/types';
import { categorize } from '../shared/constants';
import { generateId, inferType, normalizeDate, parseAmount } from './utils';

function detectHeaderLine(lines: string[]): number {
  return lines.findIndex((line) => {
    const normalized = line.replace(/\ufeff/g, '').trim();
    if (!normalized) return false;

    const hasDate = /(交易时间|日期时间|时间)/.test(normalized);
    const hasAmount = /(金额|金额\(元\)|金额（元）|支出|收入)/.test(normalized);
    const hasType = /(交易类型|类型|收\/支)/.test(normalized);
    return hasDate && hasAmount && hasType;
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

export function parseWechat(content: string): Transaction[] {
  const transactions: Transaction[] = [];
  const now = new Date().toISOString();

  for (const row of parseRows(content)) {
    const dateStr = row['交易时间'] || row['日期时间'] || row['时间'] || row['交易日期'];
    const amountStr = row['金额(元)'] || row['金额（元）'] || row['金额'] || row['支出'] || row['收入'];
    const description = row['商品'] || row['交易说明'] || row['备注'] || '';
    const counterparty = row['交易对方'] || row['商户'] || row['收款方'] || '';
    const flow = row['收/支'] || row['收支类型'] || '';
    const typeStr = row['交易类型'] || row['类型'] || flow || '';

    if (!dateStr || !amountStr) continue;
    if (dateStr.includes('共') || dateStr.includes('微信') || dateStr.includes('收入') || dateStr.includes('支出')) continue;

    const date = normalizeDate(dateStr);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const amount = parseAmount(amountStr);
    const transferLike =
      flow.includes('不计收支') ||
      /中性/.test(typeStr) ||
      (/转账/.test(typeStr) && !flow.includes('收入') && !flow.includes('支出'));
    const type = transferLike
      ? 'transfer'
      : inferType({
          typeText: `${typeStr}${flow}`,
          expenseField: flow.includes('支出') ? amountStr : row['支出'],
          incomeField: flow.includes('收入') ? amountStr : row['收入'],
          amountText: amountStr,
        });

    transactions.push({
      id: generateId(),
      source: 'wechat',
      original_id: row['交易单号'] || row['微信支付单号'] || row['订单号'] || row['商户单号'],
      date,
      amount: Math.abs(amount),
      type,
      counterparty,
      description,
      category: categorize(description || counterparty),
      created_at: now,
      updated_at: now,
    });
  }

  return transactions;
}
