import { useState } from 'react';
import { DuplicateReviewItem, Summary, SummaryQuery, Transaction, TransactionListResponse, TransactionQuery } from '../shared/types';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Transactions from './pages/Transactions';

declare global {
  interface Window {
    electronAPI: {
      selectFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
      importCSV: (
        filePath: string,
        source: 'alipay' | 'wechat' | 'yunshanfu',
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

type Page = 'dashboard' | 'import' | 'transactions';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  return (
    <div className="app">
      <nav className="nav">
        <h1>记账小助手</h1>
        <div className="nav-links">
          <button onClick={() => setCurrentPage('dashboard')} className={currentPage === 'dashboard' ? 'active' : ''}>
            仪表盘
          </button>
          <button onClick={() => setCurrentPage('import')} className={currentPage === 'import' ? 'active' : ''}>
            导入
          </button>
          <button onClick={() => setCurrentPage('transactions')} className={currentPage === 'transactions' ? 'active' : ''}>
            交易记录
          </button>
        </div>
      </nav>
      <main className="main">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'import' && <Import />}
        {currentPage === 'transactions' && <Transactions />}
      </main>
    </div>
  );
}
