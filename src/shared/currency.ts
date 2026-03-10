// Simple exchange rate service
// In production, this would call an external API

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  updatedAt: string;
}

// Base currency is CNY
const DEFAULT_RATES: Record<string, number> = {
  CNY: 1,
  USD: 0.14,    // 1 CNY = 0.14 USD
  EUR: 0.13,
  JPY: 20.5,
  GBP: 0.11,
  HKD: 1.09,
  TWD: 4.35,
  KRW: 182.5,
  SGD: 0.19,
  AUD: 0.21,
  CAD: 0.19,
  CHF: 0.12,
  THB: 4.9,
  MYR: 0.65,
};

const CURRENCY_NAMES: Record<string, string> = {
  CNY: '人民币',
  USD: '美元',
  EUR: '欧元',
  JPY: '日元',
  GBP: '英镑',
  HKD: '港币',
  TWD: '新台币',
  KRW: '韩元',
  SGD: '新加坡元',
  AUD: '澳元',
  CAD: '加元',
  CHF: '瑞士法郎',
  THB: '泰铢',
  MYR: '马来西亚林吉特',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  GBP: '£',
  HKD: 'HK$',
  TWD: 'NT$',
  KRW: '₩',
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'Fr',
  THB: '฿',
  MYR: 'RM',
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export function getExchangeRate(from: string, to: string): number {
  if (from === to) return 1;
  const fromRate = DEFAULT_RATES[from] || 1;
  const toRate = DEFAULT_RATES[to] || 1;
  return toRate / fromRate;
}

export function convertCurrency(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const rate = getExchangeRate(from, to);
  return amount * rate;
}

export function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol}${amount.toFixed(2)}`;
}

export function getCurrencyName(currency: string): string {
  return CURRENCY_NAMES[currency] || currency;
}

export function getSupportedCurrencies(): string[] {
  return Object.keys(DEFAULT_RATES);
}

// Cache rates in localStorage
export function cacheRates(rates: Record<string, number>): void {
  localStorage.setItem('expense-exchange-rates', JSON.stringify({
    rates,
    updatedAt: new Date().toISOString(),
  }));
}

export function getCachedRates(): Record<string, number> | null {
  const cached = localStorage.getItem('expense-exchange-rates');
  if (cached) {
    try {
      const data = JSON.parse(cached);
      // Check if cache is less than 24 hours old
      const updatedAt = new Date(data.updatedAt);
      const now = new Date();
      if (now.getTime() - updatedAt.getTime() < 24 * 60 * 60 * 1000) {
        return data.rates;
      }
    } catch (e) {
      console.error('Failed to parse cached rates:', e);
    }
  }
  return null;
}
