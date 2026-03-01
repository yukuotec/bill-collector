import { contextBridge, ipcRenderer } from 'electron';
import { Budget, BudgetAlert, DuplicateReviewItem, Summary, SummaryQuery, TransactionListResponse, TransactionQuery } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (filters: { name: string; extensions: string[] }[]) => ipcRenderer.invoke('select-file', filters),
  importCSV: (filePath: string, source: 'alipay' | 'wechat' | 'yunshanfu' | 'bank', options?: { dryRun?: boolean; previewLimit?: number }) =>
    ipcRenderer.invoke('import-csv', filePath, source, options),
  getTransactions: (filters?: TransactionQuery): Promise<TransactionListResponse> => ipcRenderer.invoke('get-transactions', filters),
  getSummary: (query?: SummaryQuery): Promise<Summary> => ipcRenderer.invoke('get-summary', query),
  getDuplicateTransactions: (): Promise<DuplicateReviewItem[]> => ipcRenderer.invoke('get-duplicate-transactions'),
  resolveDuplicate: (id: string, action: 'keep' | 'merge') => ipcRenderer.invoke('resolve-duplicate', id, action),
  updateCategory: (id: string, category: string) => ipcRenderer.invoke('update-category', id, category),
  updateNotes: (id: string, notes: string) => ipcRenderer.invoke('update-notes', id, notes),
  deleteTransaction: (id: string) => ipcRenderer.invoke('delete-transaction', id),
  exportCSV: (ids?: string[]) => ipcRenderer.invoke('export-csv', ids),
  exportExcel: () => ipcRenderer.invoke('export-excel'),
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  getBudgets: (): Promise<Budget[]> => ipcRenderer.invoke('get-budgets'),
  setBudget: (id: string, yearMonth: string, amount: number, category: string | null) => ipcRenderer.invoke('set-budget', id, yearMonth, amount, category),
  deleteBudget: (id: string) => ipcRenderer.invoke('delete-budget', id),
  getBudgetAlerts: (yearMonth?: string): Promise<BudgetAlert[]> => ipcRenderer.invoke('get-budget-alerts', yearMonth),
});
