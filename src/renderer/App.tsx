import { useEffect, useState } from 'react';
import { Budget, BudgetAlert, DuplicateReviewItem, Summary, SummaryQuery, Transaction, TransactionListResponse, TransactionQuery } from '../shared/types';
import { AppPage, buildDrilldownQuery, parseHashLocation } from '../shared/drilldown';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';

declare global {
  interface Window {
    electronAPI: {
      selectFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
      importCSV: (
        filePath: string,
        source: 'alipay' | 'wechat' | 'yunshanfu' | 'bank',
        options?: { dryRun?: boolean; previewLimit?: number }
      ) => Promise<{
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
      }>;
      getTransactions: (filters?: TransactionQuery) => Promise<TransactionListResponse>;
      getSummary: (query?: SummaryQuery) => Promise<Summary>;
      getDuplicateTransactions: () => Promise<DuplicateReviewItem[]>;
      resolveDuplicate: (id: string, action: 'keep' | 'merge') => Promise<boolean>;
      updateCategory: (id: string, category: string) => Promise<boolean>;
      updateNotes: (id: string, notes: string) => Promise<boolean>;
      deleteTransaction: (id: string) => Promise<boolean>;
      exportCSV: () => Promise<string | null>;
      exportExcel: () => Promise<string | null>;
      backupDatabase: () => Promise<string | null>;
      getBudgets: () => Promise<Budget[]>;
      setBudget: (id: string, yearMonth: string, amount: number, category: string | null) => Promise<boolean>;
      deleteBudget: (id: string) => Promise<boolean>;
      getBudgetAlerts: (yearMonth?: string) => Promise<BudgetAlert[]>;
    };
  }
}

const navItems = [
  { page: 'dashboard', label: '仪表盘', icon: '📊' },
  { page: 'budgets', label: '预算', icon: '💵' },
  { page: 'import', label: '导入', icon: '📥' },
  { page: 'transactions', label: '交易记录', icon: '📋' },
] as const;

export default function App() {
  const [locationState, setLocationState] = useState(() => parseHashLocation(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setLocationState(parseHashLocation(window.location.hash));
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const navigate = (page: AppPage, search = '') => {
    window.location.hash = `${page}${search}`;
  };

  const currentPage = locationState.page;

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-brand-icon">💰</div>
          <span>记账小助手</span>
        </div>
        <div className="nav-links">
          {navItems.map((item) => (
            <button
              key={item.page}
              onClick={() => navigate(item.page)}
              className={currentPage === item.page ? 'active' : ''}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <main className="main">
        {currentPage === 'dashboard' && (
          <Dashboard
            onDrilldown={(query) => {
              navigate('transactions', buildDrilldownQuery(query));
            }}
          />
        )}
        {currentPage === 'budgets' && <Budgets />}
        {currentPage === 'import' && <Import />}
        {currentPage === 'transactions' && (
          <Transactions
            locationSearch={locationState.search}
            onReplaceSearch={(search) => {
              navigate('transactions', search);
            }}
          />
        )}
      </main>
    </div>
  );
}
