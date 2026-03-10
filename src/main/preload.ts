import { contextBridge, ipcRenderer } from 'electron';
import { Budget, BudgetAlert, DuplicateReviewItem, Member, Summary, SummaryQuery, Transaction, TransactionListResponse, TransactionQuery, Account, AccountSummary } from '../shared/types';

type ImportSource = 'alipay' | 'wechat' | 'yunshanfu' | 'bank';

interface CategorySummary {
  category: string;
  total: number;
  percentage: number;
}

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

// In preload script, we always have access to Electron APIs
// The web API fallback is only used when this file is loaded in browser (via main.tsx)
const isRunningInElectron = typeof process !== 'undefined' && process.versions?.electron !== undefined;

const webAPI = {
  // Web simulation API - for development in browser
  selectFile: () => Promise.resolve(null),
  importCSV: (): Promise<ImportResult> => Promise.resolve({
    importId: null,
    parsedCount: 0,
    inserted: 0,
    exactMerged: 0,
    fuzzyFlagged: 0,
    errors: [],
    preview: [],
  }),
  getTransactions: () => Promise.resolve({ items: [], totalCount: 0, page: 1, pageSize: 20 }),
  getSummary: () => Promise.resolve({
    year: new Date().getFullYear(),
    currentMonth: '2024-01',
    currentMonthExpense: 0,
    currentMonthIncome: 0,
    yearlyExpense: 0,
    yearlyIncome: 0,
    yearlyNet: 0,
    monthly: [],
    byCategory: [],
    topMerchants: [],
    availableYears: [2024],
  }),
  getCategorySummary: () => Promise.resolve([]),
  getDuplicateTransactions: () => Promise.resolve([]),
  resolveDuplicate: () => Promise.resolve(true),
  updateCategory: () => Promise.resolve(true),
  updateNotes: () => Promise.resolve(true),
  deleteTransaction: () => Promise.resolve(true),
  deleteTransactionsByIds: () => Promise.resolve({ deleted: 0 }),
  exportCSV: () => Promise.resolve(null),
  exportExcel: () => Promise.resolve(null),
  backupDatabase: () => Promise.resolve(null),
  getBudgets: () => Promise.resolve([]),
  setBudget: () => Promise.resolve(true),
  deleteBudget: () => Promise.resolve(true),
  getBudgetAlerts: () => Promise.resolve([]),
  getTags: () => Promise.resolve([]),
  addTag: () => Promise.resolve(true),
  removeTag: () => Promise.resolve(true),
  getMonthlyTrend: () => Promise.resolve({ data: [], currentMonth: '', previousMonth: '' }),
  getMembers: () => Promise.resolve([
    { id: 'demo-1', name: '👨 老公', color: '#3B82F6', created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: 'demo-2', name: '👩 老婆', color: '#EC4899', created_at: '2024-01-01', updated_at: '2024-01-01' },
  ]),
  addMember: () => Promise.resolve(),
  updateMember: () => Promise.resolve(),
  deleteMember: () => Promise.resolve(),
  checkSimilarAssignments: () => Promise.resolve({ similarCount: 0, shouldPrompt: false, similarTransactions: [], memberId: '', memberName: '' }),
  batchAssignSimilar: () => Promise.resolve(0),
  setTransactionMember: () => Promise.resolve(),
  getMemberSummary: () => Promise.resolve([]),
  // Web simulation API for accounts
  getAccounts: () => Promise.resolve([
    { id: 'demo-1', name: '招商银行', type: 'bank' as const, balance: 0, color: '#EF4444', created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: 'demo-2', name: '支付宝', type: 'alipay' as const, balance: 0, color: '#3B82F6', created_at: '2024-01-01', updated_at: '2024-01-01' },
  ]),
  addAccount: () => Promise.resolve(),
  updateAccount: () => Promise.resolve(),
  deleteAccount: () => Promise.resolve(),
  setTransactionAccount: () => Promise.resolve(),
  getAccountSummary: () => Promise.resolve([]),
  updateAccountBalance: () => Promise.resolve(),
  // Quick Add APIs
  createTransaction: () => Promise.resolve({ id: null, success: false, error: 'Browser mode' }),
  getMerchantHistory: () => Promise.resolve([]),
  getCategories: () => Promise.resolve(['餐饮', '交通', '购物', '住房', '医疗', '娱乐', '通讯', '其他']),
  // Source Coverage APIs (web fallback)
  getSourceCoverage: () => Promise.resolve([]),
  getLastImportBySource: () => Promise.resolve([]),
  // Mark-as-zero APIs (web fallback)
  markAsZero: () => Promise.resolve(true),
  unmarkAsZero: () => Promise.resolve(true),
  isMarkedAsZero: () => Promise.resolve(false),
  getMarkedAsZero: () => Promise.resolve([]),
};

const electronAPI = {
  selectFile: (filters: { name: string; extensions: string[] }[]) => ipcRenderer.invoke('select-file', filters),
  importCSV: (filePath: string, source: ImportSource, options?: ImportOptions): Promise<ImportResult> =>
    ipcRenderer.invoke('import-csv', filePath, source, options),
  getTransactions: (filters?: TransactionQuery): Promise<TransactionListResponse> => ipcRenderer.invoke('get-transactions', filters),
  getSummary: (query?: SummaryQuery): Promise<Summary> => ipcRenderer.invoke('get-summary', query),
  getCategorySummary: (year?: number): Promise<CategorySummary[]> => ipcRenderer.invoke('get-category-summary', year),
  getDuplicateTransactions: (): Promise<DuplicateReviewItem[]> => ipcRenderer.invoke('get-duplicate-transactions'),
  resolveDuplicate: (id: string, action: 'keep' | 'merge') => ipcRenderer.invoke('resolve-duplicate', id, action),
  updateCategory: (id: string, category: string) => ipcRenderer.invoke('update-category', id, category),
  updateNotes: (id: string, notes: string) => ipcRenderer.invoke('update-notes', id, notes),
  deleteTransaction: (id: string) => ipcRenderer.invoke('delete-transaction', id),
  deleteTransactionsByIds: (ids: string[]) => ipcRenderer.invoke('delete-transactions-by-ids', ids),
  exportCSV: (ids?: string[]) => ipcRenderer.invoke('export-csv', ids),
  exportExcel: () => ipcRenderer.invoke('export-excel'),
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  getBudgets: (): Promise<Budget[]> => ipcRenderer.invoke('get-budgets'),
  setBudget: (id: string, yearMonth: string, amount: number, category: string | null) => ipcRenderer.invoke('set-budget', id, yearMonth, amount, category),
  deleteBudget: (id: string) => ipcRenderer.invoke('delete-budget', id),
  getBudgetAlerts: (yearMonth?: string): Promise<BudgetAlert[]> => ipcRenderer.invoke('get-budget-alerts', yearMonth),
  getTags: (id: string): Promise<string[]> => ipcRenderer.invoke('get-tags', id),
  addTag: (id: string, tag: string): Promise<boolean> => ipcRenderer.invoke('add-tag', id, tag),
  removeTag: (id: string, tag: string): Promise<boolean> => ipcRenderer.invoke('remove-tag', id, tag),
  getMonthlyTrend: (months?: number): Promise<{
    data: Array<{
      month: string;
      expense: number;
      income: number;
      expenseChange: number | null;
      incomeChange: number | null;
    }>;
    currentMonth: string;
    previousMonth: string;
  }> => ipcRenderer.invoke('get-monthly-trend', months),
  
  // Member APIs
  getMembers: (): Promise<Member[]> => ipcRenderer.invoke('get-members'),
  addMember: (id: string, name: string, color: string): Promise<void> =>
    ipcRenderer.invoke('add-member', id, name, color),
  updateMember: (id: string, name: string, color: string): Promise<void> =>
    ipcRenderer.invoke('update-member', id, name, color),
  deleteMember: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-member', id),
  
  checkSimilarAssignments: (
    transaction: Transaction,
    memberId: string,
    threshold?: number
  ): Promise<{
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
  }> => ipcRenderer.invoke('check-similar-assignments', transaction, memberId, threshold),
  
  batchAssignSimilar: (
    transaction: Transaction,
    memberId: string
  ): Promise<number> => ipcRenderer.invoke('batch-assign-similar', transaction, memberId),
  
  setTransactionMember: (transactionId: string, memberId: string | null): Promise<void> =>
    ipcRenderer.invoke('set-transaction-member', transactionId, memberId),

  getMemberSummary: (year: number, month?: number): Promise<Array<{ memberId: string; memberName: string; memberColor: string; total: number }>> =>
    ipcRenderer.invoke('get-member-summary', year, month),

  // Account APIs
  getAccounts: (): Promise<Account[]> => ipcRenderer.invoke('get-accounts'),
  addAccount: (id: string, name: string, type: Account['type'], balance: number, color: string): Promise<void> =>
    ipcRenderer.invoke('add-account', id, name, type, balance, color),
  updateAccount: (id: string, name: string, type: Account['type'], balance: number, color: string): Promise<void> =>
    ipcRenderer.invoke('update-account', id, name, type, balance, color),
  deleteAccount: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-account', id),
  setTransactionAccount: (transactionId: string, accountId: string | null): Promise<void> =>
    ipcRenderer.invoke('set-transaction-account', transactionId, accountId),
  getAccountSummary: (year: number, month?: number): Promise<AccountSummary[]> =>
    ipcRenderer.invoke('get-account-summary', year, month),
  updateAccountBalance: (id: string, balance: number): Promise<void> =>
    ipcRenderer.invoke('update-account-balance', id, balance),

  // Quick Add APIs
  createTransaction: (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<{ id: string | null; success: boolean; error?: string }> =>
    ipcRenderer.invoke('create-transaction', transaction),

  getMerchantHistory: (limit?: number): Promise<string[]> =>
    ipcRenderer.invoke('get-merchant-history', limit),

  getCategories: (): Promise<string[]> =>
    ipcRenderer.invoke('get-categories'),

  // Source Coverage APIs
  getSourceCoverage: (year: number): Promise<Array<{ source: string; month: string; count: number }>> =>
    ipcRenderer.invoke('get-source-coverage', year),

  getLastImportBySource: (): Promise<Array<{ source: string; lastDate: string | null }>> =>
    ipcRenderer.invoke('get-last-import-by-source'),

  // Mark-as-zero APIs
  markAsZero: (source: string, month: string): Promise<boolean> =>
    ipcRenderer.invoke('mark-as-zero', source, month),

  unmarkAsZero: (source: string, month: string): Promise<boolean> =>
    ipcRenderer.invoke('unmark-as-zero', source, month),

  isMarkedAsZero: (source: string, month: string): Promise<boolean> =>
    ipcRenderer.invoke('is-marked-as-zero', source, month),

  getMarkedAsZero: (year: number): Promise<Array<{ source: string; month: string; markedAt: string }>> =>
    ipcRenderer.invoke('get-marked-as-zero', year),
};

// Export the appropriate API based on environment
// In Electron preload script, use real IPC APIs
// In browser (when this file is loaded via main.tsx mock), use web APIs
const api = isRunningInElectron ? electronAPI : webAPI;

contextBridge.exposeInMainWorld('electronAPI', api);
