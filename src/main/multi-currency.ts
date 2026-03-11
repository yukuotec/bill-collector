// Round 15: Multi-Currency Support
import { getDatabase } from './database';

export type Currency = 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'KRW';

export const EXCHANGE_RATES: Record<Currency, number> = {
  CNY: 1,
  USD: 7.2,
  EUR: 7.8,
  GBP: 9.1,
  JPY: 0.048,
  KRW: 0.0054,
};

export interface CurrencyConversion {
  from: Currency;
  to: Currency;
  amount: number;
  convertedAmount: number;
  rate: number;
  date: string;
}

export function convertCurrency(amount: number, from: Currency, to: Currency): number {
  const fromRate = EXCHANGE_RATES[from];
  const toRate = EXCHANGE_RATES[to];
  return (amount / fromRate) * toRate;
}

export function formatCurrency(amount: number, currency: Currency): string {
  const symbols: Record<Currency, string> = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    KRW: '₩',
  };

  return `${symbols[currency]}${amount.toFixed(2)}`;
}

export function getTransactionsInCurrency(currency: Currency = 'CNY'): { items: any[]; totalInCurrency: number } {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM transactions LIMIT 100');

  const items: any[] = [];
  let totalInCurrency = 0;

  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const txCurrency = (row.currency as Currency) || 'CNY';
    const amount = row.amount as number;
    const convertedAmount = convertCurrency(Math.abs(amount), txCurrency, currency);

    items.push({
      ...row,
      originalAmount: amount,
      originalCurrency: txCurrency,
      convertedAmount,
      displayCurrency: currency,
    });

    totalInCurrency += convertedAmount;
  }

  stmt.free();
  return { items, totalInCurrency };
}
