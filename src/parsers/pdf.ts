import fs from 'fs';
import { Transaction } from '../shared/types';
import { parseBillText } from './billText';
import { categorize } from '../shared/constants';
import { generateId } from './utils';

type Source = 'alipay' | 'wechat' | 'yunshanfu' | 'bank';

function compact(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function parseAbcCreditCardText(text: string, source: Source): Transaction[] {
  if (source !== 'bank') return [];
  if (!/(农业银行信用卡对账单|Statement Information)/i.test(text)) return [];

  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => compact(line))
    .filter(Boolean);

  const start = lines.findIndex((line) => /交易明细/.test(line));
  if (start < 0) return [];

  const now = new Date().toISOString();
  const rows: Transaction[] = [];

  const toDate = (yymmdd: string): string | null => {
    if (!/^\d{6}$/.test(yymmdd)) return null;
    const yy = Number(yymmdd.slice(0, 2));
    const mm = Number(yymmdd.slice(2, 4));
    const dd = Number(yymmdd.slice(4, 6));
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `20${String(yy).padStart(2, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  };

  const parseAmtPair = (value: string): { settled: number } | null => {
    const m = value.match(/(-?\d+(?:\.\d{1,2})?)\/CNY\s*(-?\d+(?:\.\d{1,2})?)\/CNY/i);
    if (!m) return null;
    const settled = Number.parseFloat(m[2]);
    if (!Number.isFinite(settled)) return null;
    return { settled };
  };

  const extractCounterparty = (desc: string): string => {
    const stripped = desc
      .replace(/^(跨行无卡消费|跨行二维码支付|网上消费|银联入账)\s*/g, '')
      .replace(/^支付宝[，,]/, '')
      .trim();
    const tail = stripped.split(/\s+/).filter(Boolean).pop();
    return tail || stripped;
  };

  for (let i = start + 1; i < lines.length; i += 1) {
    const marker = lines[i];
    if (/^(温馨提示|\*|卡号|账单周期|到期还款日)/.test(marker)) break;
    if (/^●/.test(marker)) continue;

    const tx = marker.match(/^(\d{6})(\d{6})(\d{4})(.+)$/);
    if (!tx) continue;

    const date = toDate(tx[1]);
    if (!date) continue;

    let desc = compact(tx[4]);
    let amtInfo = parseAmtPair(desc);
    if (amtInfo) {
      desc = compact(desc.replace(/(-?\d+(?:\.\d{1,2})?)\/CNY\s*(-?\d+(?:\.\d{1,2})?)\/CNY/i, ' '));
    }

    let j = i + 1;
    while (!amtInfo && j < lines.length) {
      const next = lines[j];
      if (/^(\d{6})(\d{6})(\d{4})/.test(next) || /^●/.test(next) || /^(温馨提示|\*|卡号)/.test(next)) {
        break;
      }
      const nextAmt = parseAmtPair(next);
      if (nextAmt) {
        amtInfo = nextAmt;
        j += 1;
        break;
      }
      desc = compact(`${desc} ${next}`);
      j += 1;
    }

    if (!amtInfo) continue;

    const settled = amtInfo.settled;
    const type: Transaction['type'] = settled < 0 ? 'expense' : 'income';
    const description = desc;
    const counterparty = extractCounterparty(description);
    rows.push({
      id: generateId(),
      source,
      date,
      amount: Math.abs(settled),
      type,
      counterparty,
      description,
      bank_name: '农业银行',
      category: categorize(description || counterparty),
      is_refund: /(退款|返还|返款|冲正)/.test(description) ? 1 : 0,
      created_at: now,
      updated_at: now,
    });

    if (j > i + 1) {
      i = j - 1;
    }
  }

  return rows;
}

function parseCmbcCreditCardText(text: string, source: Source): Transaction[] {
  if (source !== 'bank') return [];
  if (!/(民生银行信用卡对账单|CMBC Credit Card Statement)/i.test(text)) return [];

  const cycle = text.match(/(20\d{2})年(\d{1,2})月/);
  if (!cycle) return [];
  const cycleYear = Number(cycle[1]);
  const cycleMonth = Number(cycle[2]);
  if (!Number.isFinite(cycleYear) || !Number.isFinite(cycleMonth)) return [];

  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => compact(line))
    .filter(Boolean);

  const detailStart = lines.findIndex((line) => /本期财务明细|Transaction Details/i.test(line));
  if (detailStart < 0) return [];

  const now = new Date().toISOString();
  const rows: Transaction[] = [];

  for (let i = detailStart + 1; i < lines.length - 2; i += 1) {
    const sold = lines[i].match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!sold) continue;

    const desc = lines[i + 1];
    const amountText = lines[i + 2].replace(/[,¥￥\s]/g, '');
    if (!desc || /^(\d{1,2})\/(\d{1,2})$/.test(desc)) continue;
    if (!/^[-+]?\d+(?:\.\d{1,2})?$/.test(amountText)) continue;

    const month = Number(sold[1]);
    const day = Number(sold[2]);
    if (!Number.isFinite(month) || !Number.isFinite(day)) continue;
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    const year = month > cycleMonth ? cycleYear - 1 : cycleYear;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const signedAmount = Number.parseFloat(amountText);
    if (!Number.isFinite(signedAmount) || signedAmount === 0) continue;

    const type: Transaction['type'] =
      signedAmount < 0 || /(入账|退款|返还|返款|冲正)/.test(desc) ? 'income' : 'expense';

    rows.push({
      id: generateId(),
      source,
      date,
      amount: Math.abs(signedAmount),
      type,
      counterparty: desc.split('/')[0] || desc,
      description: desc,
      bank_name: '民生银行',
      category: categorize(desc),
      is_refund: /(退款|返还|返款|冲正)/.test(desc) ? 1 : 0,
      created_at: now,
      updated_at: now,
    });

    if (i + 4 < lines.length && /^(\d{1,2})\/(\d{1,2})$/.test(lines[i + 3]) && /^\d{4}$/.test(lines[i + 4])) {
      i += 4;
    } else {
      i += 2;
    }
  }

  return rows;
}

export async function parsePdfBill(filePath: string, source: Source): Promise<Transaction[]> {
  let pdfParse: ((buffer: Buffer) => Promise<{ text: string }>) | undefined;
  try {
    const mod = require('pdf-parse') as { default?: (buffer: Buffer) => Promise<{ text: string }> } | ((buffer: Buffer) => Promise<{ text: string }>);
    pdfParse = typeof mod === 'function' ? mod : mod.default;
  } catch {
    throw new Error('未安装 pdf-parse，无法解析 PDF。请执行: npm install pdf-parse');
  }

  if (!pdfParse) {
    throw new Error('pdf-parse 加载失败，无法解析 PDF');
  }

  const buffer = fs.readFileSync(filePath);
  const { text } = await pdfParse(buffer);
  const rawText = text || '';

  const abcRows = parseAbcCreditCardText(rawText, source);
  if (abcRows.length > 0) {
    return abcRows;
  }

  const cmbcRows = parseCmbcCreditCardText(rawText, source);
  if (cmbcRows.length > 0) {
    return cmbcRows;
  }

  return parseBillText(rawText, source);
}

export { parseCmbcCreditCardText };
export { parseAbcCreditCardText };
