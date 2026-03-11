export interface Member {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export type AccountType = 'bank' | 'credit' | 'cash' | 'alipay' | 'wechat' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface AccountSummary {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  accountColor: string;
  total: number;
}

export interface Transaction {
  id: string;
  source: 'alipay' | 'wechat' | 'yunshanfu' | 'bank' | 'manual';
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
  member_id?: string | null;
  account_id?: string | null;
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

export interface MemberSummaryItem {
  memberId: string;
  memberName: string;
  memberColor: string;
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
  byMember?: MemberSummaryItem[];
  byAccount?: AccountSummary[];
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
  memberId?: string;
  accountId?: string;
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

// Smart Assignment Types
export interface AssignmentHistory {
  id: string;
  transaction_id: string;
  member_id: string;
  feature_key: string;
  feature_value: string;
  created_at: string;
}

export interface AssignmentPattern {
  id: string;
  feature_key: string;
  feature_value: string;
  member_id: string;
  count: number;
  confidence: number;
  updated_at: string;
}

export interface SmartAssignmentResult {
  transactionId: string;
  predictedMemberId: string | null;
  confidence: number;
  action: 'auto' | 'suggest' | 'none';
}

export interface SmartAssignmentApplyResult {
  autoAssigned: number;
  suggested: number;
  skipped: number;
  results: SmartAssignmentResult[];
}

// Email types
export interface EmailAccount {
  id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password: string;
  last_sync?: string | null;
  created_at: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  path?: string;
}

export interface EmailMessage {
  id: string;
  account_id: string;
  message_id: string;
  subject?: string | null;
  from_address?: string | null;
  date?: string | null;
  attachments?: string | null;
  processed: number;
  created_at: string;
}

export interface EmailSyncResult {
  success: boolean;
  emailsFound: number;
  attachmentsDownloaded: number;
  transactionsImported: number;
  errors: string[];
}

// Receipt types
export interface Receipt {
  id: string;
  transaction_id?: string | null;
  file_path: string;
  thumbnail_path?: string | null;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  ocr_text?: string;
  ocr_confidence?: number;
  amount_detected?: number;
  date_detected?: string;
  merchant_detected?: string;
  items_detected?: string;
  encrypted?: boolean | number;
  created_at: string;
  updated_at: string;
}

export interface ReceiptWithTransaction extends Receipt {
  transaction?: Transaction;
}

export interface ReceiptUploadResult {
  receipt: Receipt;
  extracted: ReceiptExtractedData;
  suggestedTransactions: Transaction[];
}

export interface ReceiptExtractedData {
  amount?: number;
  date?: string;
  merchant?: string;
  items?: ReceiptItem[];
  confidence: number;
}

export interface ReceiptItem {
  name: string;
  quantity?: number;
  price?: number;
  total?: number;
}

export interface ReceiptSearchResult {
  receipt: ReceiptWithTransaction;
  matchScore: number;
  highlights: string[];
}

export interface ReceiptQuery {
  q?: string;
  transactionId?: string;
  startDate?: string;
  endDate?: string;
  merchant?: string;
  page?: number;
  pageSize?: number;
}

// Cash Flow types
export interface CashFlowPrediction {
  date: string;
  predictedBalance: number;
  predictedIncome: number;
  predictedExpense: number;
  confidence: number;
  factors: string[];
}

export interface CashFlowAlert {
  type: 'overdraft' | 'low_balance' | 'high_expense' | 'bill_due';
  date: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestedAction?: string;
  balance?: number;
}

export interface CashFlowForecast {
  predictions: CashFlowPrediction[];
  alerts: CashFlowAlert[];
  summary: {
    startingBalance: number;
    projectedLow: number;
    projectedHigh: number;
    averageDailyChange: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
}

// Category ML types
export interface CategoryPrediction {
  category: string;
  confidence: number;
  reason: string;
}

export interface CategoryTrainingStats {
  totalSamples: number;
  samplesPerCategory: Record<string, number>;
  lastTrainingDate: string | null;
}

export interface BatchCategorizeResult {
  categorized: number;
  suggestions: Array<{
    transactionId: string;
    merchant: string;
    currentCategory: string;
    suggestedCategory: string;
    confidence: number;
  }>;
}

// NLP types
export interface ParsedTransaction {
  amount?: number;
  description?: string;
  merchant?: string;
  category?: string;
  date?: string;
  type: 'expense' | 'income';
  confidence: number;
}

export interface ParsedCommand {
  action: 'add' | 'show' | 'query' | 'unknown';
  target?: string;
  filters?: Record<string, string>;
  transaction?: ParsedTransaction;
}
