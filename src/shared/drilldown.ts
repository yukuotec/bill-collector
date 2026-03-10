export interface DrilldownQuery {
  from?: string;
  to?: string;
  category?: string;
  merchant?: string;
  drill?: boolean;
}

export type AppPage = 'dashboard' | 'budgets' | 'accounts' | 'members' | 'import' | 'transactions' | 'assign' | 'quick-add' | 'email-settings' | 'source-coverage' | 'recurring' | 'investments' | 'savings' | 'export';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseHashLocation(hash: string): { page: AppPage; search: string } {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path, query = ''] = raw.split('?');
  const validPages: AppPage[] = ['dashboard', 'budgets', 'accounts', 'members', 'import', 'transactions', 'assign', 'quick-add', 'email-settings', 'source-coverage', 'recurring', 'investments', 'savings', 'export'];
  const page: AppPage = validPages.includes(path as AppPage) ? (path as AppPage) : 'dashboard';
  return { page, search: query ? `?${query}` : '' };
}

export function getYearDateRange(year: number): { from: string; to: string } {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

export function parseDrilldownQuery(search: string): DrilldownQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  const from = params.get('from') || undefined;
  const to = params.get('to') || undefined;
  const category = params.get('category') || undefined;
  const merchant = params.get('merchant') || undefined;
  const drill = params.get('drill') === '1';

  const parsed: DrilldownQuery = { drill };
  const validFrom = from && DATE_RE.test(from) ? from : undefined;
  const validTo = to && DATE_RE.test(to) ? to : undefined;
  const validCategory = category && category.trim().length > 0 ? category : undefined;
  const validMerchant = merchant && merchant.trim().length > 0 ? merchant : undefined;

  if (validFrom) parsed.from = validFrom;
  if (validTo) parsed.to = validTo;
  if (validCategory) parsed.category = validCategory;
  if (validMerchant) parsed.merchant = validMerchant;

  return parsed;
}

export function buildDrilldownQuery(input: DrilldownQuery): string {
  const params = new URLSearchParams();

  if (input.from) params.set('from', input.from);
  if (input.to) params.set('to', input.to);
  if (input.category) params.set('category', input.category);
  if (input.merchant) params.set('merchant', input.merchant);
  if (input.drill) params.set('drill', '1');

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function removeDrilldownField(search: string, field: 'from' | 'to' | 'category' | 'merchant' | 'drill'): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete(field);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function shouldApplyLatestResponse(latestRequestId: number, responseRequestId: number): boolean {
  return latestRequestId === responseRequestId;
}
