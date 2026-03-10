import { useEffect, useState } from 'react';
import { Budget, BudgetAlert, DuplicateReviewItem, Member, Summary, SummaryQuery, Transaction, TransactionListResponse, TransactionQuery, EmailAccount, EmailMessage, Account, AccountSummary } from '../shared/types';
import { AppPage, buildDrilldownQuery, parseHashLocation } from '../shared/drilldown';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Members from './pages/Members';
import Accounts from './pages/Accounts';
import AssignTransactions from './pages/AssignTransactions';
import EmailSettings from './pages/EmailSettings';
import QuickAdd from './pages/QuickAdd';
import SourceCoverage from './pages/SourceCoverage';
import Recurring from './pages/Recurring';
import Investments from './pages/Investments';
import SavingsGoals from './pages/SavingsGoals';
import Export from './pages/Export';
import Reminders from './pages/Reminders';

declare global {
  interface Window {
    electronAPI: {
      selectFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
      importCSV: (
        filePath: string,
        source: 'alipay' | 'wechat' | 'yunshanfu' | 'bank',
        options?: { dryRun?: boolean; previewLimit?: number; accountId?: string }
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
      // Account APIs
      getAccounts: () => Promise<Account[]>;
      addAccount: (id: string, name: string, type: Account['type'], balance: number, color: string) => Promise<void>;
      updateAccount: (id: string, name: string, type: Account['type'], balance: number, color: string) => Promise<void>;
      deleteAccount: (id: string) => Promise<void>;
      setTransactionAccount: (transactionId: string, accountId: string | null) => Promise<void>;
      getAccountSummary: (year: number, month?: number) => Promise<AccountSummary[]>;
      updateAccountBalance: (id: string, balance: number) => Promise<void>;
      // Email APIs
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
      getSourceCoverage: (year: number) => Promise<Array<{ source: string; month: string; count: number }>>;
      getLastImportBySource: () => Promise<Array<{ source: string; lastDate: string | null }>>;
      // Recurring Transaction APIs
      getRecurringTransactions: () => Promise<Array<{
        id: string;
        name: string;
        amount: number;
        type: 'expense' | 'income';
        category: string;
        counterparty?: string;
        member_id?: string;
        account_id?: string;
        frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
        start_date: string;
        end_date?: string;
        day_of_month?: number;
        day_of_week?: number;
        is_active: boolean;
        last_generated_date?: string;
        created_at: string;
        updated_at: string;
      }>>;
      addRecurringTransaction: (data: object) => Promise<boolean>;
      updateRecurringTransaction: (data: object) => Promise<boolean>;
      deleteRecurringTransaction: (id: string) => Promise<boolean>;
      toggleRecurringTransaction: (id: string, isActive: boolean) => Promise<boolean>;
      generateRecurringTransactions: () => Promise<number>;
    };
  }
}

const navItems = [
  { page: 'quick-add', label: '快速记账', icon: '➕', highlight: true },
  { page: 'dashboard', label: '仪表盘', icon: '📊' },
  { page: 'recurring', label: '周期记账', icon: '📅' },
  { page: 'investments', label: '投资追踪', icon: '📈' },
  { page: 'savings', label: '目标储蓄', icon: '🎯' },
  { page: 'budgets', label: '预算', icon: '💵' },
  { page: 'accounts', label: '账户', icon: '💳' },
  { page: 'members', label: '成员', icon: '👨‍👩‍👧‍👦' },
  { page: 'reminders', label: '提醒', icon: '🔔' },
  { page: 'export', label: '导出', icon: '📤' },
  { page: 'import', label: '导入', icon: '📥' },
  { page: 'source-coverage', label: '数据收集', icon: '📆' },
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
        {currentPage === 'accounts' && <Accounts locationSearch={locationState.search} />}
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
        {currentPage === 'source-coverage' && <SourceCoverage />}
        {currentPage === 'quick-add' && <QuickAdd onClose={() => navigate('dashboard')} />}
        {currentPage === 'recurring' && <Recurring />}
        {currentPage === 'investments' && <Investments />}
        {currentPage === 'savings' && <SavingsGoals />}
        {currentPage === 'export' && <Export />}
        {currentPage === 'reminders' && <Reminders />}
      </main>
    </div>
  );
}
