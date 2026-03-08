// Test setup for React components
import '@testing-library/jest-dom';

// Mock Electron API before any component loads
global.window.electronAPI = {
  // Common mocked APIs
  getTransactions: jest.fn(),
  getSummary: jest.fn(),
  getCategorySummary: jest.fn(),
  getDuplicateTransactions: jest.fn(),
  resolveDuplicate: jest.fn(),
  updateCategory: jest.fn(),
  updateNotes: jest.fn(),
  deleteTransaction: jest.fn(),
  deleteTransactionsByIds: jest.fn(),
  exportCSV: jest.fn(),
  exportExcel: jest.fn(),
  backupDatabase: jest.fn(),
  getBudgets: jest.fn(),
  setBudget: jest.fn(),
  deleteBudget: jest.fn(),
  getBudgetAlerts: jest.fn(),
  getTags: jest.fn(),
  addTag: jest.fn(),
  removeTag: jest.fn(),
  getMonthlyTrend: jest.fn(),
  getMembers: jest.fn(),
  checkSimilarAssignments: jest.fn(),
  batchAssignSimilar: jest.fn(),
  setTransactionMember: jest.fn(),
  createTransaction: jest.fn(),
  getMerchantHistory: jest.fn(),
  getCategories: jest.fn(),
  selectFile: jest.fn(),
  importCSV: jest.fn(),
  addEmailAccount: jest.fn(),
  deleteEmailAccount: jest.fn(),
  syncEmails: jest.fn(),
  getEmailAccounts: jest.fn(),
  getEmailMessages: jest.fn(),
};

// Mock matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});
