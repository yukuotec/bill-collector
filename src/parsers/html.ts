import fs from 'fs';
import { Transaction } from '../shared/types';
import { parseBillText } from './billText';

type Source = 'alipay' | 'wechat' | 'yunshanfu';

type CheerioApi = {
  load: (html: string) => (selector: string) => {
    each: (callback: (index: number, element: unknown) => void) => void;
    find: (selector: string) => { toArray: () => unknown[] };
    text: () => string;
  };
};

function parseHtmlTables(html: string, source: Source): Transaction[] {
  let cheerio: CheerioApi | undefined;
  try {
    cheerio = require('cheerio') as CheerioApi;
  } catch {
    throw new Error('未安装 cheerio，无法解析 HTML。请执行: npm install cheerio');
  }

  const $ = cheerio.load(html);
  const rows: string[] = [];

  $('tr').each((_idx, row) => {
    const cells = $(row as never)
      .find('th,td')
      .toArray()
      .map((cell) => $(cell as never).text().replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (cells.length > 0) {
      rows.push(cells.join(' | '));
    }
  });

  const tableText = rows.join('\n');
  const parsedFromTable = parseBillText(tableText, source);
  if (parsedFromTable.length > 0) {
    return parsedFromTable;
  }

  return parseBillText($('body').text() || '', source);
}

export async function parseHtmlBill(filePath: string, source: Source): Promise<Transaction[]> {
  const html = fs.readFileSync(filePath, 'utf-8');
  return parseHtmlTables(html, source);
}
