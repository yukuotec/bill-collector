import { contextBridge, ipcRenderer } from 'electron';
import { Budget, BudgetAlert, DuplicateReviewItem, Member, Summary, SummaryQuery, Transaction, TransactionListResponse, TransactionQuery } from '../shared/types';

type ImportSource = 'alipay' | 'wechat' | 'yunshanfu' | 'bank';

interface CategorySummary {
  category: string;
  total: number;
  percentage: number;
}

interface ImportOptions {
  dryRun?: boolean;
  previewLimit?: number;
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

contextBridge.exposeInMainWorld('electronAPI', {
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
  
  // Batch Assignment Prompt APIs
  getMembers: (): Promise<Member[]> => ipcRenderer.invoke('get-members'),
  
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

  // Quick Add APIs
  createTransaction: (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<{ id: string | null; success: boolean; error?: string }> =>
    ipcRenderer.invoke('create-transaction', transaction),
  
  getMerchantHistory: (limit?: number): Promise<string[]> =>
    ipcRenderer.invoke('get-merchant-history', limit),
  
  getCategories: (): Promise<string[]> =>
    ipcRenderer.invoke('get-categories'),
});
