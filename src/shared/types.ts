export interface Transaction {
  id: string;
  source: 'alipay' | 'wechat' | 'yunshanfu' | 'bank';
  import_id?: string | null;
  original_source?: string;
  original_id?: string;
  date: string;
  amount: number;
  currency?: string;
  type: 'expense' | 'income' | 'transfer';
  counterparty?: string;
  description?: string;
  bank_name?: string;
  category?: string;
  notes?: string;
  tags?: string;
  is_refund?: boolean | number;
  refund_of?: string | null;
  is_duplicate?: boolean | number;
  duplicate_source?: string | null;
  duplicate_type?: DuplicateType | null;
  merged_with?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DuplicateReviewItem extends Transaction {
  target_id?: string | null;
  target_date?: string | null;
  target_amount?: number | null;
  target_counterparty?: string | null;
  target_description?: string | null;
  target_source?: Transaction['source'] | null;
  target_type?: Transaction['type'] | null;
}

export interface ImportRecord {
  id: string;
  source: 'alipay' | 'wechat' | 'yunshanfu' | 'bank';
  file_name?: string;
  record_count: number;
  imported_at: string;
}

export interface SummaryQuery {
  year?: number;
  months?: number;
}

export interface SummaryMonthlyItem {
  month: string;
  expense: number;
  income: number;
}

export interface SummaryCategoryItem {
  category: string;
  total: number;
}

export interface SummaryMerchantItem {
  counterparty: string;
  count: number;
  total: number;
}

export interface Summary {
  year: number;
  currentMonth: string;
  currentMonthExpense: number;
  currentMonthIncome: number;
  yearlyExpense: number;
  yearlyIncome: number;
  yearlyNet: number;
  monthly: SummaryMonthlyItem[];
  byCategory: SummaryCategoryItem[];
  topMerchants: SummaryMerchantItem[];
  availableYears: number[];
}

export type TransactionSource = 'alipay' | 'wechat' | 'yunshanfu' | 'bank';
export type TransactionType = 'expense' | 'income' | 'transfer';
export type DuplicateType = 'exact' | 'same_period' | 'cross_platform';
export type TransactionSortBy = 'date' | 'amount';
export type SortOrder = 'asc' | 'desc';

export interface TransactionQuery {
  category?: string;
  merchant?: string;
  source?: TransactionSource;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  duplicateType?: DuplicateType;
  refundOnly?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: TransactionSortBy;
  sortOrder?: SortOrder;
}

export interface TransactionListResponse {
  items: Transaction[];
  totalCount: number;
  total?: number;
  page: number;
  pageSize: number;
}

export interface Budget {
  id: string;
  year_month: string;
  amount: number;
  category: string | null;
  created_at: string;
}

export interface BudgetAlert {
  budget: Budget;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
}
