import { useEffect, useState } from 'react';
import { Budget, BudgetAlert, DuplicateReviewItem, Member, Summary, SummaryQuery, Transaction, TransactionListResponse, TransactionQuery, EmailAccount, EmailMessage } from '../shared/types';
import { AppPage, buildDrilldownQuery, parseHashLocation } from '../shared/drilldown';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Members from './pages/Members';
import AssignTransactions from './pages/AssignTransactions';
import EmailSettings from './pages/EmailSettings';
import QuickAdd from './pages/QuickAdd';

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
      exportCSV: (ids?: string[]) => Promise<string | null>;
      exportExcel: () => Promise<string | null>;
      backupDatabase: () => Promise<string | null>;
      getBudgets: () => Promise<Budget[]>;
      setBudget: (id: string, yearMonth: string, amount: number, category: string | null) => Promise<boolean>;
      deleteBudget: (id: string) => Promise<boolean>;
      getBudgetAlerts: (yearMonth?: string) => Promise<BudgetAlert[]>;
      getTags: (id: string) => Promise<string[]>;
      addTag: (id: string, tag: string) => Promise<boolean>;
      removeTag: (id: string, tag: string) => Promise<boolean>;
      getMembers: () => Promise<Member[]>;
      addMember: (id: string, name: string, color: string) => Promise<void>;
      updateMember: (id: string, name: string, color: string) => Promise<void>;
      deleteMember: (id: string) => Promise<void>;
      setTransactionMember: (transactionId: string, memberId: string | null) => Promise<void>;
      getMemberSummary: (year: number, month?: number) => Promise<{ memberId: string; memberName: string; memberColor: string; total: number }[]>;
      checkSimilarAssignments: (
        transaction: Transaction,
        memberId: string,
        threshold?: number
      ) => Promise<{
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
      }>;
      batchAssignSimilar: (transaction: Transaction, memberId: string) => Promise<number>;
      getEmailAccounts: () => Promise<EmailAccount[]>;
      addEmailAccount: (
        id: string,
        email: string,
        imapHost: string,
        imapPort: number,
        smtpHost: string,
        smtpPort: number,
        username: string,
        password: string
      ) => Promise<void>;
      deleteEmailAccount: (id: string) => Promise<void>;
      getEmailMessages: (accountId: string, limit?: number) => Promise<EmailMessage[]>;
      syncEmails: (accountId: string) => Promise<{
        success: boolean;
        emailsFound: number;
        attachmentsDownloaded: number;
        errors: string[];
      }>;
      // Quick Add APIs
      createTransaction: (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<{ id: string | null; success: boolean; error?: string }>;
      getMerchantHistory: (limit?: number) => Promise<string[]>;
      getCategories: () => Promise<string[]>;
    };
  }
}

const navItems = [
  { page: 'quick-add', label: '快速记账', icon: '➕', highlight: true },
  { page: 'dashboard', label: '仪表盘', icon: '📊' },
  { page: 'budgets', label: '预算', icon: '💵' },
  { page: 'members', label: '成员', icon: '👨‍👩‍👧‍👦' },
  { page: 'assign', label: '分配交易', icon: '📤' },
  { page: 'import', label: '导入', icon: '📥' },
  { page: 'transactions', label: '交易记录', icon: '📋' },
  { page: 'email-settings', label: '邮箱设置', icon: '📧' },
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
              className={`${currentPage === item.page ? 'active' : ''} ${item.highlight ? 'highlight' : ''}`}
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
        {currentPage === 'members' && <Members locationSearch={locationState.search} />}
        {currentPage === 'import' && <Import />}
        {currentPage === 'transactions' && (
          <Transactions
            locationSearch={locationState.search}
            onReplaceSearch={(search) => {
              navigate('transactions', search);
            }}
          />
        )}
        {currentPage === 'assign' && <AssignTransactions />}
        {currentPage === 'email-settings' && <EmailSettings />}
        {currentPage === 'quick-add' && <QuickAdd onClose={() => navigate('dashboard')} />}
      </main>
    </div>
  );
}
