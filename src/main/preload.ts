import { contextBridge, ipcRenderer } from 'electron';
import { DuplicateReviewItem, Summary, SummaryQuery, TransactionListResponse, TransactionQuery } from '../shared/types';

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
  exportCSV: () => ipcRenderer.invoke('export-csv'),
  exportExcel: () => ipcRenderer.invoke('export-excel'),
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
});
