import { contextBridge, ipcRenderer } from 'electron';
import { Budget, BudgetAlert, DuplicateReviewItem, Member, Summary, SummaryQuery, Transaction, TransactionListResponse, TransactionQuery, Account, AccountSummary, Receipt, ReceiptQuery, ReceiptWithTransaction, ReceiptUploadResult, CashFlowForecast, CategoryPrediction, CategoryTrainingStats, BatchCategorizeResult, ParsedCommand, SyncState, TransactionTemplate, HealthReport, BackupInfo, TrendAnalysis, FraudAlert, TaxReport, MerchantProfile, FinancialInsight } from '../shared/types';

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
  exportPDF: () => Promise.resolve(null),
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
  // Recurring Transaction APIs (web fallback)
  getRecurringTransactions: () => Promise.resolve([]),
  addRecurringTransaction: () => Promise.resolve(true),
  updateRecurringTransaction: () => Promise.resolve(true),
  deleteRecurringTransaction: () => Promise.resolve(true),
  toggleRecurringTransaction: () => Promise.resolve(true),
  generateRecurringTransactions: () => Promise.resolve(0),
  // Investment APIs (web fallback)
  getInvestmentAccounts: () => Promise.resolve([]),
  addInvestmentAccount: () => Promise.resolve(true),
  updateInvestmentAccount: () => Promise.resolve(true),
  updateInvestmentPrice: () => Promise.resolve(true),
  deleteInvestmentAccount: () => Promise.resolve(true),
  getInvestmentTransactions: () => Promise.resolve([]),
  addInvestmentTransaction: () => Promise.resolve(true),
  deleteInvestmentTransaction: () => Promise.resolve(true),
  getInvestmentSummary: () => Promise.resolve({ totalCost: 0, totalValue: 0, totalGain: 0, gainPercentage: 0 }),
  // Savings Goals APIs (web fallback)
  getSavingsGoals: () => Promise.resolve([]),
  addSavingsGoal: () => Promise.resolve(true),
  updateSavingsGoal: () => Promise.resolve(true),
  addToSavingsGoal: () => Promise.resolve(true),
  deleteSavingsGoal: () => Promise.resolve(true),
  getSavingsSummary: () => Promise.resolve({ totalTarget: 0, totalCurrent: 0, totalRemaining: 0, completedGoals: 0, totalGoals: 0 }),
  // Email APIs (web fallback)
  getEmailAccounts: () => Promise.resolve([]),
  addEmailAccount: () => Promise.resolve(true),
  deleteEmailAccount: () => Promise.resolve(true),
  // Reminder APIs (web fallback)
  getReminderConfig: () => Promise.resolve({
    budgetAlerts: true,
    budgetThreshold: 80,
    recurringReminders: true,
    importReminders: true,
    importReminderDay: 5,
  }),
  setReminderConfig: () => Promise.resolve(true),
  testReminder: () => Promise.resolve(true),
  // Receipt APIs (web fallback)
  uploadReceipt: () => Promise.resolve({ receipt: null, extracted: null, suggestedTransactions: [] } as unknown as ReceiptUploadResult),
  getReceipt: () => Promise.resolve(null),
  searchReceipts: () => Promise.resolve({ items: [], total: 0 }),
  linkReceipt: () => Promise.resolve(true),
  deleteReceipt: () => Promise.resolve(true),
  selectReceiptFile: () => Promise.resolve(null),
  // Cash Flow APIs (web fallback)
  getCashFlowForecast: () => Promise.resolve({
    predictions: [],
    alerts: [],
    summary: { startingBalance: 0, projectedLow: 0, projectedHigh: 0, averageDailyChange: 0, trendDirection: 'stable' }
  } as CashFlowForecast),
  optimizeBillPayment: () => Promise.resolve({ suggestedDate: new Date().toISOString().split('T')[0], reason: 'Fallback' }),
  // Category ML APIs (web fallback)
  predictCategory: () => Promise.resolve({ category: '其他', confidence: 0.5, reason: 'Fallback' } as CategoryPrediction),
  learnCategory: () => Promise.resolve(true),
  getTrainingStats: () => Promise.resolve({ totalSamples: 0, samplesPerCategory: {}, lastTrainingDate: null } as CategoryTrainingStats),
  batchCategorize: () => Promise.resolve({ categorized: 0, suggestions: [] } as BatchCategorizeResult),
  // NLP APIs (web fallback)
  parseNLP: () => Promise.resolve({ action: 'unknown' } as ParsedCommand),
  // Sync APIs (web fallback)
  getDeviceIdentity: () => Promise.resolve({ id: '', publicKey: '', privateKey: '' }),
  getDeviceFingerprint: () => Promise.resolve(''),
  getSyncStatus: () => Promise.resolve({ lastSyncAt: null, devices: [], pendingChanges: 0 } as SyncState),
  // Template APIs (web fallback)
  createTemplate: () => Promise.resolve(null),
  getTemplates: () => Promise.resolve([]),
  // Health check APIs (web fallback)
  runHealthCheck: () => Promise.resolve({ issues: [], summary: { totalIssues: 0, criticalIssues: 0, fixableIssues: 0, lastCheck: '' } } as HealthReport),
  fixHealthIssue: () => Promise.resolve(false),
  // Backup APIs (web fallback)
  createBackup: () => Promise.resolve({ id: '', filePath: '', createdAt: '', size: 0, description: '' } as BackupInfo),
  listBackups: () => Promise.resolve([]),
  restoreBackup: () => Promise.resolve(false),
  // Rounds 11-20 APIs (web fallback)
  checkScheduledTasks: () => Promise.resolve(true),
  analyzeTrends: () => Promise.resolve([]),
  detectFraud: () => Promise.resolve([]),
  generateTaxReport: () => Promise.resolve({ year: 2024, totalIncome: 0, totalExpense: 0, deductibleExpenses: {}, summary: { medicalExpenses: 0, educationExpenses: 0, charitableDonations: 0, businessExpenses: 0 } } as TaxReport),
  convertCurrency: () => Promise.resolve(0),
  calculateGoalProgress: () => Promise.resolve(null),
  getMerchantAnalytics: () => Promise.resolve(null),
  getDebtSummary: () => Promise.resolve({ totalOwed: 0, totalOwing: 0, net: 0 }),
  getWishlistTotal: () => Promise.resolve({ total: 0, byPriority: {} }),
  generateInsights: () => Promise.resolve([]),
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
  exportCSV: (ids?: string[], startDate?: string, endDate?: string) => ipcRenderer.invoke('export-csv', ids, startDate, endDate),
  exportExcel: (startDate?: string, endDate?: string) => ipcRenderer.invoke('export-excel', startDate, endDate),
  exportPDF: (startDate?: string, endDate?: string) => ipcRenderer.invoke('export-pdf', startDate, endDate),
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

  // Recurring Transaction APIs
  getRecurringTransactions: () => ipcRenderer.invoke('get-recurring-transactions'),
  addRecurringTransaction: (data: object) => ipcRenderer.invoke('add-recurring-transaction', data),
  updateRecurringTransaction: (data: object) => ipcRenderer.invoke('update-recurring-transaction', data),
  deleteRecurringTransaction: (id: string) => ipcRenderer.invoke('delete-recurring-transaction', id),
  toggleRecurringTransaction: (id: string, isActive: boolean) => ipcRenderer.invoke('toggle-recurring-transaction', id, isActive),
  generateRecurringTransactions: () => ipcRenderer.invoke('generate-recurring-transactions'),

  // Investment APIs
  getInvestmentAccounts: () => ipcRenderer.invoke('get-investment-accounts'),
  addInvestmentAccount: (data: object) => ipcRenderer.invoke('add-investment-account', data),
  updateInvestmentAccount: (data: object) => ipcRenderer.invoke('update-investment-account', data),
  updateInvestmentPrice: (id: string, currentPrice: number) => ipcRenderer.invoke('update-investment-price', id, currentPrice),
  deleteInvestmentAccount: (id: string) => ipcRenderer.invoke('delete-investment-account', id),
  getInvestmentTransactions: (accountId?: string) => ipcRenderer.invoke('get-investment-transactions', accountId),
  addInvestmentTransaction: (data: object) => ipcRenderer.invoke('add-investment-transaction', data),
  deleteInvestmentTransaction: (id: string) => ipcRenderer.invoke('delete-investment-transaction', id),
  getInvestmentSummary: () => ipcRenderer.invoke('get-investment-summary'),

  // Savings Goals APIs
  getSavingsGoals: () => ipcRenderer.invoke('get-savings-goals'),
  addSavingsGoal: (data: object) => ipcRenderer.invoke('add-savings-goal', data),
  updateSavingsGoal: (data: object) => ipcRenderer.invoke('update-savings-goal', data),
  addToSavingsGoal: (id: string, amount: number) => ipcRenderer.invoke('add-to-savings-goal', id, amount),
  deleteSavingsGoal: (id: string) => ipcRenderer.invoke('delete-savings-goal', id),
  getSavingsSummary: () => ipcRenderer.invoke('get-savings-summary'),

  // Email APIs
  getEmailAccounts: () => ipcRenderer.invoke('get-email-accounts'),
  addEmailAccount: (data: object) => ipcRenderer.invoke('add-email-account', data),
  deleteEmailAccount: (id: string) => ipcRenderer.invoke('delete-email-account', id),

  // Reminder APIs
  getReminderConfig: () => ipcRenderer.invoke('get-reminder-config'),
  setReminderConfig: (config: object) => ipcRenderer.invoke('set-reminder-config', config),
  testReminder: (type: string) => ipcRenderer.invoke('test-reminder', type),

  // Receipt APIs
  uploadReceipt: (filePath: string, fileName: string): Promise<ReceiptUploadResult> =>
    ipcRenderer.invoke('upload-receipt', filePath, fileName),
  getReceipt: (id: string): Promise<ReceiptWithTransaction | null> =>
    ipcRenderer.invoke('get-receipt', id),
  searchReceipts: (query: ReceiptQuery): Promise<{ items: ReceiptWithTransaction[]; total: number }> =>
    ipcRenderer.invoke('search-receipts', query),
  linkReceipt: (receiptId: string, transactionId: string | null): Promise<boolean> =>
    ipcRenderer.invoke('link-receipt', receiptId, transactionId),
  deleteReceipt: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('delete-receipt', id),
  selectReceiptFile: (): Promise<string | null> =>
    ipcRenderer.invoke('select-receipt-file'),

  // Cash Flow APIs
  getCashFlowForecast: (accountId?: string, days?: number) => ipcRenderer.invoke('get-cashflow-forecast', accountId, days),
  optimizeBillPayment: (dueDate: string, amount: number) => ipcRenderer.invoke('optimize-bill-payment', dueDate, amount),

  // Category ML APIs
  predictCategory: (merchant: string, description: string, amount: number, date?: string): Promise<CategoryPrediction> =>
    ipcRenderer.invoke('predict-category', merchant, description, amount, date),
  learnCategory: (merchant: string, description: string, amount: number, category: string, date?: string): Promise<boolean> =>
    ipcRenderer.invoke('learn-category', merchant, description, amount, category, date),
  getTrainingStats: (): Promise<CategoryTrainingStats> =>
    ipcRenderer.invoke('get-training-stats'),
  batchCategorize: (dryRun?: boolean): Promise<BatchCategorizeResult> =>
    ipcRenderer.invoke('batch-categorize', dryRun),

  // NLP APIs
  parseNLP: (text: string): Promise<ParsedCommand> =>
    ipcRenderer.invoke('parse-nlp', text),

  // Sync APIs
  getDeviceIdentity: (): Promise<{ id: string; publicKey: string; privateKey: string }> =>
    ipcRenderer.invoke('get-device-identity'),
  getDeviceFingerprint: (publicKey: string): Promise<string> =>
    ipcRenderer.invoke('get-device-fingerprint', publicKey),
  getSyncStatus: (): Promise<SyncState> =>
    ipcRenderer.invoke('get-sync-status'),

  // Template APIs
  createTemplate: (transactionId: string, name: string): Promise<TransactionTemplate | null> =>
    ipcRenderer.invoke('create-template', transactionId, name),
  getTemplates: (category?: string, favoritesOnly?: boolean): Promise<TransactionTemplate[]> =>
    ipcRenderer.invoke('get-templates', category, favoritesOnly),

  // Health check APIs
  runHealthCheck: (): Promise<HealthReport> =>
    ipcRenderer.invoke('run-health-check'),
  fixHealthIssue: (issue: { type: string; table: string; recordId: string }): Promise<boolean> =>
    ipcRenderer.invoke('fix-health-issue', issue),

  // Backup APIs
  createBackup: (description?: string): Promise<BackupInfo> =>
    ipcRenderer.invoke('create-backup', description),
  listBackups: (): Promise<BackupInfo[]> =>
    ipcRenderer.invoke('list-backups'),
  restoreBackup: (backupId: string): Promise<boolean> =>
    ipcRenderer.invoke('restore-backup', backupId),

  // Rounds 11-20 APIs
  checkScheduledTasks: (): Promise<boolean> =>
    ipcRenderer.invoke('check-scheduled-tasks'),
  analyzeTrends: (months?: number): Promise<TrendAnalysis[]> =>
    ipcRenderer.invoke('analyze-trends', months),
  detectFraud: (): Promise<FraudAlert[]> =>
    ipcRenderer.invoke('detect-fraud'),
  generateTaxReport: (year: number): Promise<TaxReport> =>
    ipcRenderer.invoke('generate-tax-report', year),
  convertCurrency: (amount: number, from: string, to: string): Promise<number> =>
    ipcRenderer.invoke('convert-currency', amount, from, to),
  calculateGoalProgress: (goalId: string): Promise<any> =>
    ipcRenderer.invoke('calculate-goal-progress', goalId),
  getMerchantAnalytics: (merchant: string): Promise<MerchantProfile | null> =>
    ipcRenderer.invoke('get-merchant-analytics', merchant),
  getDebtSummary: (): Promise<{ totalOwed: number; totalOwing: number; net: number }> =>
    ipcRenderer.invoke('get-debt-summary'),
  getWishlistTotal: (): Promise<{ total: number; byPriority: Record<string, number> }> =>
    ipcRenderer.invoke('get-wishlist-total'),
  generateInsights: (): Promise<FinancialInsight[]> =>
    ipcRenderer.invoke('generate-insights'),
};

// Export the appropriate API based on environment
// In Electron preload script, use real IPC APIs
// In browser (when this file is loaded via main.tsx mock), use web APIs
const api = isRunningInElectron ? electronAPI : webAPI;

contextBridge.exposeInMainWorld('electronAPI', api);
