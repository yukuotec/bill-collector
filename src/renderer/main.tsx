import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Mock API for browser development (when not running in Electron)
if (typeof window.electronAPI === 'undefined') {
  console.log('[Dev] Setting up mock electronAPI for browser development');

  (window as any).electronAPI = {
    // File operations
    selectFile: () => Promise.resolve(null),
    importCSV: () => Promise.resolve({
      importId: null,
      parsedCount: 0,
      inserted: 0,
      exactMerged: 0,
      fuzzyFlagged: 0,
      errors: [],
      preview: [],
    }),

    // Data queries
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

    // Updates
    updateCategory: () => Promise.resolve(true),
    updateNotes: () => Promise.resolve(true),
    updateCurrency: () => Promise.resolve(true),
    deleteTransaction: () => Promise.resolve(true),
    deleteTransactionsByIds: () => Promise.resolve({ deleted: 0 }),

    // Export/Backup
    exportCSV: () => Promise.resolve(null),
    exportExcel: () => Promise.resolve(null),
    backupDatabase: () => Promise.resolve(null),

    // Budgets
    getBudgets: () => Promise.resolve([]),
    setBudget: () => Promise.resolve(true),
    deleteBudget: () => Promise.resolve(true),
    getBudgetAlerts: () => Promise.resolve([]),
    getBudgetSpending: () => Promise.resolve(0),

    // Tags
    getTags: () => Promise.resolve([]),
    addTag: () => Promise.resolve(true),
    removeTag: () => Promise.resolve(true),

    // Trends
    getMonthlyTrend: () => Promise.resolve({ data: [], currentMonth: '', previousMonth: '' }),

    // Members
    getMembers: () => Promise.resolve([
      { id: 'demo-1', name: '👨 老公', color: '#3B82F6', created_at: '2024-01-01', updated_at: '2024-01-01' },
      { id: 'demo-2', name: '👩 老婆', color: '#EC4899', created_at: '2024-01-01', updated_at: '2024-01-01' },
    ]),
    addMember: () => Promise.resolve(),
    updateMember: () => Promise.resolve(),
    deleteMember: () => Promise.resolve(),
    setTransactionMember: () => Promise.resolve(),
    getMemberSummary: () => Promise.resolve([]),

    // Accounts (new)
    getAccounts: () => Promise.resolve([
      { id: 'demo-1', name: '招商银行', type: 'bank', balance: 10000, color: '#EF4444', created_at: '2024-01-01', updated_at: '2024-01-01' },
      { id: 'demo-2', name: '支付宝', type: 'alipay', balance: 5000, color: '#3B82F6', created_at: '2024-01-01', updated_at: '2024-01-01' },
    ]),
    addAccount: () => Promise.resolve(),
    updateAccount: () => Promise.resolve(),
    deleteAccount: () => Promise.resolve(),
    setTransactionAccount: () => Promise.resolve(),
    getAccountSummary: () => Promise.resolve([]),
    updateAccountBalance: () => Promise.resolve(),

    // Smart assignment
    checkSimilarAssignments: () => Promise.resolve({ similarCount: 0, shouldPrompt: false, similarTransactions: [] }),
    batchAssignSimilar: () => Promise.resolve(0),

    // Email
    getEmailAccounts: () => Promise.resolve([]),
    addEmailAccount: () => Promise.resolve(),
    deleteEmailAccount: () => Promise.resolve(),
    getEmailMessages: () => Promise.resolve([]),
    syncEmails: () => Promise.resolve({ success: true, emailsFound: 0, attachmentsDownloaded: 0, errors: [] }),

    // Quick add
    createTransaction: () => Promise.resolve({ id: 'demo-txn', success: true }),
    getMerchantHistory: () => Promise.resolve([]),
    getCategories: () => Promise.resolve(['餐饮', '交通', '购物', '住房', '医疗', '娱乐', '通讯', '其他']),
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
