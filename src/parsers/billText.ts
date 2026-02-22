import { Transaction } from '../shared/types';
import { categorize } from '../shared/constants';
import { generateId, isRefundText, normalizeDate, parseAmount } from './utils';

type Source = 'alipay' | 'wechat' | 'yunshanfu' | 'bank';

const DATE_PATTERN = /(20\d{2}(?:[\/.-]|年)\d{1,2}(?:[\/.-]|月)\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/;
const AMOUNT_DECIMAL_PATTERN = /[-+]?\s*[¥￥]?\d[\d,]*\.\d{1,2}/g;
const AMOUNT_INTEGER_PATTERN = /[-+]\s*[¥￥]?\d[\d,]*|[¥￥]\s*\d[\d,]*/g;
const FLOW_TEXT_PATTERN = /(转账|不计收支|中性|收入|退款|入账|返现|支出|消费|付款|扣款)/;

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

function normalizeForTokens(text: string): string {
  return compact(
    text
      .replace(/\b(?:交易(?:单号|号|流水号)|订单号|商户单号|流水号|凭证号|参考号|reference|ref|id)\s*[:：#]?\s*[A-Za-z0-9_-]{6,}\b/gi, ' ')
      .replace(/[()（）【】[\]]/g, ' ')
  );
}

function extractOriginalId(line: string): string | undefined {
  const idByLabel = line.match(
    /(?:交易(?:单号|号|流水号)|订单号|商户单号|流水号|凭证号|参考号|reference|ref|id)\s*[:：#]?\s*([A-Za-z0-9_-]{6,})/i
  );
  if (idByLabel?.[1]) {
    return idByLabel[1];
  }

  const candidates = line.match(/\b[A-Za-z]*\d{8,}[A-Za-z0-9_-]*\b/g) || [];
  if (candidates.length > 0) {
    return candidates[candidates.length - 1];
  }
  return undefined;
}

function extractCounterparty(line: string, dateText: string, amountText: string): string {
  const base = normalizeForTokens(line.replace(dateText, ' ').replace(amountText, ' '));
  const tokens = base
    .split(/\s*\|\s*|\s{2,}/)
    .map((token) => compact(token.replace(FLOW_TEXT_PATTERN, ' ')))
    .filter(Boolean)
    .filter((token) => !/^(成功|完成|处理中|已退款|退款成功|支付成功|待处理)$/i.test(token))
    .filter((token) => !/^[A-Za-z]*\d{8,}[A-Za-z0-9_-]*$/.test(token));

  if (tokens.length === 0) {
    const fallback = compact(
      base
        .replace(FLOW_TEXT_PATTERN, ' ')
        .replace(/(?:交易(?:单号|号|流水号)|订单号|商户单号|流水号)\s*[:：#]?/gi, ' ')
    )
      .split(/\s+/)
      .find((token) => /[\u4e00-\u9fffA-Za-z]/.test(token) && !/^\d+$/.test(token));
    return fallback || '';
  }
  if (tokens.length === 1) {
    if (/\s/.test(tokens[0])) {
      const firstWord = tokens[0]
        .split(/\s+/)
        .map((token) => compact(token))
        .filter(Boolean)
        .filter((token) => !/^(交易(?:单号|号|流水号)|订单号|商户单号|流水号)[:：#]?$/i.test(token))
        .find((token) => /[\u4e00-\u9fffA-Za-z]/.test(token) && !/^[A-Za-z]*\d{8,}[A-Za-z0-9_-]*$/.test(token));
      if (firstWord) {
        return firstWord;
      }
    }
    return tokens[0];
  }

  const preferred = tokens.find((token) => /[\u4e00-\u9fffA-Za-z]/.test(token) && !/\d{4}-\d{1,2}-\d{1,2}/.test(token));
  return preferred || tokens[0];
}

function inferTypeFromText(text: string, amountText: string): Transaction['type'] {
  if (/(转账|不计收支|中性)/.test(text)) return 'transfer';
  if (/(收入|退款|入账|返现)/.test(text)) return 'income';
  if (/(支出|消费|付款|扣款)/.test(text)) return 'expense';
  if (/^-/.test(amountText)) return 'expense';
  if (/^\+/.test(amountText)) return 'income';
  return 'expense';
}

function getAmountCandidates(line: string): string[] {
  const extract = (pattern: RegExp): string[] =>
    Array.from(line.matchAll(pattern))
      .filter((match) => {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        const prev = start > 0 ? line[start - 1] : '';
        const next = end < line.length ? line[end] : '';
        if (/[\d/:.-]/.test(prev)) return false;
        if (/[/:-]/.test(next)) return false;
        return true;
      })
      .map((match) => match[0]);

  const decimal = extract(AMOUNT_DECIMAL_PATTERN);
  if (decimal.length > 0) {
    return decimal;
  }
  return extract(AMOUNT_INTEGER_PATTERN);
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

  const amountMatches = getAmountCandidates(line);
  if (amountMatches.length === 0) return null;

  const dateText = dateMatch[1];
  const amountText = amountMatches[amountMatches.length - 1];
  const date = normalizeDate(dateText.replace(/[年月]/g, '-').replace(/日/g, ''));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const amount = parseAmount(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const isRefund = isRefundText(line);
  const counterparty = extractCounterparty(line, dateText, amountText);
  const description = extractDescription(line, dateText, amountText);
  const type = inferTypeFromText(line, amountText);
  const originalId = extractOriginalId(line);

  return {
    id: generateId(),
    source,
    original_id: originalId,
    date,
    amount: Math.abs(amount),
    type: isRefund && type !== 'transfer' ? 'income' : type,
    is_refund: isRefund ? 1 : 0,
    counterparty,
    description,
    category: categorize(description || counterparty),
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

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (shouldSkipLine(line)) continue;

    let txn = maybeParseLine(line, source, now);
    if (!txn && DATE_PATTERN.test(line) && getAmountCandidates(line).length === 0 && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (!shouldSkipLine(nextLine)) {
        txn = maybeParseLine(`${line} ${nextLine}`, source, now);
        if (txn) {
          i += 1;
        }
      }
    }
    if (!txn) continue;

    const key = `${txn.date}|${txn.amount}|${txn.description || ''}|${txn.type}|${txn.original_id || ''}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    results.push(txn);
  }

  return results;
}
