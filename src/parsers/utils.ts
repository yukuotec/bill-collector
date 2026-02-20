export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function normalizeDate(dateStr: string): string {
  const firstPart = dateStr.trim().split(' ')[0].replace(/[./]/g, '-');
  const match = firstPart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return firstPart;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function parseAmount(amountStr: string): number {
  const normalized = amountStr.replace(/[,¥￥\s]/g, '');
  const match = normalized.match(/-?\d+(\.\d+)?/);
  if (!match) return 0;
  return Math.abs(Number.parseFloat(match[0]));
}

export function inferType(options: {
  typeText?: string;
  expenseField?: string;
  incomeField?: string;
  amountText?: string;
}): 'expense' | 'income' {
  const typeText = options.typeText || '';
  if (typeText.includes('收入')) return 'income';
  if (typeText.includes('支出')) return 'expense';
  if (options.expenseField && !options.incomeField) return 'expense';
  if (options.incomeField && !options.expenseField) return 'income';
  if ((options.amountText || '').includes('-')) return 'expense';
  return 'expense';
}
