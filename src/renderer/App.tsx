import { useEffect, useState } from 'react';
import { DuplicateReviewItem, Summary, SummaryQuery, Transaction, TransactionListResponse, TransactionQuery } from '../shared/types';
import { AppPage, buildDrilldownQuery, parseHashLocation } from '../shared/drilldown';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Transactions from './pages/Transactions';

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
      deleteTransaction: (id: string) => Promise<boolean>;
      exportCSV: () => Promise<string | null>;
      exportExcel: () => Promise<string | null>;
      backupDatabase: () => Promise<string | null>;
    };
  }
}

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
        <h1>记账小助手</h1>
        <div className="nav-links">
          <button onClick={() => navigate('dashboard')} className={currentPage === 'dashboard' ? 'active' : ''}>
            仪表盘
          </button>
          <button onClick={() => navigate('import')} className={currentPage === 'import' ? 'active' : ''}>
            导入
          </button>
          <button onClick={() => navigate('transactions')} className={currentPage === 'transactions' ? 'active' : ''}>
            交易记录
          </button>
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
