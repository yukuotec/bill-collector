// Type declarations for Electron API

interface ImportOptions {
  dryRun?: boolean;
  previewLimit?: number;
  accountId?: string;
}

interface ImportResult {
  importId: string | null;
  parsedCount: number;
  inserted: number;
  exactMerged: number;
  fuzzyFlagged: number;
  errors: string[];
  preview: Array<{
    date: string;
    type: string;
    amount: number;
    counterparty?: string;
    description?: string;
    category?: string;
  }>;
  columns?: string[];
  columnMapping?: Record<string, string>;
}

interface TransactionQuery {
  page?: number;
  pageSize?: number;
  sortBy?: 'date' | 'amount';
  sortOrder?: 'asc' | 'desc';
  source?: string;
  category?: string;
  memberId?: string;
  accountId?: string;
  search?: string;
  from?: string;
  to?: string;
  type?: 'expense' | 'income' | 'transfer';
  duplicateType?: string;
  refundOnly?: boolean;
}

interface TransactionListResponse {
  items: Array<{
    id: string;
    source: string;
    date: string;
    amount: number;
    type: string;
    counterparty?: string;
    description?: string;
    category?: string;
    member_id?: string;
    account_id?: string;
  }>;
  totalCount: number;
  total: number;
  page: number;
  pageSize: number;
}

interface SummaryQuery {
  year?: number;
  months?: number;
}

interface Budget {
  id: string;
  year_month: string;
  amount: number;
  category: string | null;
}

interface BudgetAlert {
  budget: Budget;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
}

interface Member {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: string;
  name: string;
  type: 'bank' | 'credit' | 'cash' | 'alipay' | 'wechat' | 'other';
  balance: number;
  color: string;
  created_at: string;
  updated_at: string;
}

interface AccountSummary {
  accountId: string;
  accountName: string;
  accountType: Account['type'];
  accountColor: string;
  total: number;
}

interface DuplicateReviewItem {
  id: string;
  source: string;
  date: string;
  amount: number;
  counterparty?: string;
  description?: string;
  target_id?: string;
  target_date?: string;
  target_amount?: number;
  target_counterparty?: string;
  target_description?: string;
  target_source?: string;
  target_type?: string;
}

interface Transaction {
  id: string;
  source: string;
  import_id?: string;
  original_source?: string;
  original_id?: string;
  date: string;
  amount: number;
  currency?: string;
  type: string;
  counterparty?: string;
  description?: string;
  bank_name?: string;
  category?: string;
  notes?: string;
  tags?: string;
  member_id?: string;
  account_id?: string;
  is_refund?: number;
  refund_of?: string;
  is_duplicate?: number;
  duplicate_source?: string;
  duplicate_type?: string;
  merged_with?: string;
  created_at: string;
  updated_at: string;
}

interface Summary {
  year: number;
  currentMonth: string;
  currentMonthExpense: number;
  currentMonthIncome: number;
  yearlyExpense: number;
  yearlyIncome: number;
  yearlyNet: number;
  monthly: Array<{ month: string; expense: number; income: number }>;
  byCategory: Array<{ category: string; total: number }>;
  topMerchants: Array<{ counterparty: string; count: number; total: number }>;
  byMember?: Array<{ memberId: string; memberName: string; memberColor: string; total: number }>;
  byAccount?: Array<{ accountId: string; accountName: string; accountType: string; accountColor: string; total: number }>;
  availableYears: number[];
}

interface ElectronAPI {
  // File operations
  selectFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
  importCSV: (filePath: string, source: string, options?: ImportOptions) => Promise<ImportResult>;

  // Data queries
  getTransactions: (filters?: TransactionQuery) => Promise<TransactionListResponse>;
  getSummary: (query?: SummaryQuery) => Promise<Summary>;
  getCategorySummary: (year?: number) => Promise<Array<{ category: string; total: number; percentage: number }>>;
  getDuplicateTransactions: () => Promise<DuplicateReviewItem[]>;
  resolveDuplicate: (id: string, action: 'keep' | 'merge') => Promise<boolean>;

  // Updates
  updateCategory: (id: string, category: string) => Promise<boolean>;
  updateNotes: (id: string, notes: string) => Promise<boolean>;
  updateCurrency: (id: string, currency: string) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  deleteTransactionsByIds: (ids: string[]) => Promise<{ deleted: number }>;

  // Export/Backup
  exportCSV: (ids?: string[]) => Promise<string | null>;
  exportExcel: () => Promise<string | null>;
  backupDatabase: () => Promise<string | null>;

  // Budgets
  getBudgets: () => Promise<Budget[]>;
  setBudget: (id: string, yearMonth: string, amount: number, category: string | null) => Promise<boolean>;
  deleteBudget: (id: string) => Promise<boolean>;
  getBudgetAlerts: (yearMonth?: string) => Promise<BudgetAlert[]>;

  // Tags
  getTags: (id: string) => Promise<string[]>;
  addTag: (id: string, tag: string) => Promise<boolean>;
  removeTag: (id: string, tag: string) => Promise<boolean>;

  // Trends
  getMonthlyTrend: (months?: number) => Promise<{
    data: Array<{
      month: string;
      expense: number;
      income: number;
      expenseChange: number | null;
      incomeChange: number | null;
    }>;
    currentMonth: string;
    previousMonth: string;
  }>;

  // Members
  getMembers: () => Promise<Member[]>;
  addMember: (id: string, name: string, color: string) => Promise<void>;
  updateMember: (id: string, name: string, color: string) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  setTransactionMember: (transactionId: string, memberId: string | null) => Promise<void>;
  getMemberSummary: (year: number, month?: number) => Promise<Array<{ memberId: string; memberName: string; memberColor: string; total: number }>>;
  checkSimilarAssignments: (
    transaction: Transaction,
    memberId: string,
    threshold?: number
  ) => Promise<{
    similarCount: number;
    memberId: string;
    memberName: string;
    shouldPrompt: boolean;
    similarTransactions: Array<{
      id: string;
      counterparty: string | null;
      description: string | null;
      category: string | null;
      date: string;
      amount: number;
    }>;
  }>;
  batchAssignSimilar: (transaction: Transaction, memberId: string) => Promise<number>;

  // Accounts
  getAccounts: () => Promise<Account[]>;
  addAccount: (id: string, name: string, type: Account['type'], balance: number, color: string) => Promise<void>;
  updateAccount: (id: string, name: string, type: Account['type'], balance: number, color: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  setTransactionAccount: (transactionId: string, accountId: string | null) => Promise<void>;
  getAccountSummary: (year: number, month?: number) => Promise<AccountSummary[]>;
  updateAccountBalance: (id: string, balance: number) => Promise<void>;

  // Quick Add
  createTransaction: (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<{ id: string | null; success: boolean; error?: string }>;
  getMerchantHistory: (limit?: number) => Promise<string[]>;
  getCategories: () => Promise<string[]>;

  // Source Coverage
  getSourceCoverage: (year: number) => Promise<Array<{ source: string; month: string; count: number }>>;
  getLastImportBySource: () => Promise<Array<{ source: string; lastDate: string | null }>>;

  // Mark-as-zero
  markAsZero: (source: string, month: string) => Promise<boolean>;
  unmarkAsZero: (source: string, month: string) => Promise<boolean>;
  isMarkedAsZero: (source: string, month: string) => Promise<boolean>;
  getMarkedAsZero: (year: number) => Promise<Array<{ source: string; month: string; markedAt: string }>>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    __IS_ELECTRON?: boolean;
  }
}

export {};
