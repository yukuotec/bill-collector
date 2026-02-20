import fs from 'fs';
import { Transaction } from '../shared/types';
import { parseBillText } from './billText';

type Source = 'alipay' | 'wechat' | 'yunshanfu';

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
  return parseBillText(text || '', source);
}
