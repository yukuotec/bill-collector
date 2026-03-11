import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES } from '../../shared/constants';
import { DuplicateReviewItem, Member, Account, SortOrder, Transaction, TransactionQuery, TransactionSortBy } from '../../shared/types';
import { parseDrilldownQuery, removeDrilldownField, shouldApplyLatestResponse } from '../../shared/drilldown';

interface FilterState {
  startDate: string;
  endDate: string;
  category: string;
  merchant: string;
  source: string;
  type: string;
  memberId: string;
  accountId: string;
  q: string;
}

interface TransactionsProps {
  locationSearch: string;
  onReplaceSearch: (search: string) => void;
}

const PAGE_SIZE_OPTIONS = [20, 30, 50];

const SOURCE_LABELS: Record<string, string> = {
  alipay: '支付宝',
  wechat: '微信',
  yunshanfu: '云闪付',
};

const TYPE_LABELS: Record<string, string> = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
};

// Helper functions to calculate date ranges
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getStartOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function getEndOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayRange(): { startDate: string; endDate: string } {
  const today = formatDate(new Date());
  return { startDate: today, endDate: today };
}

function getYesterdayRange(): { startDate: string; endDate: string } {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  return { startDate: yesterdayStr, endDate: yesterdayStr };
}

function getLast7DaysRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

function getLast30DaysRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

type DateRangeOption =
  | 'today' | 'yesterday' | 'last7days' | 'last30days'
  | 'thisweek' | 'lastweek'
  | 'thismonth' | 'lastmonth'
  | 'thisyear' | 'custom';

interface DateRangeConfig {
  value: DateRangeOption;
  label: string;
  getRange: () => { startDate: string; endDate: string };
}

const DATE_RANGE_OPTIONS: DateRangeConfig[] = [
  { value: 'today', label: '今天', getRange: getTodayRange },
  { value: 'yesterday', label: '昨天', getRange: getYesterdayRange },
  { value: 'last7days', label: '近7天', getRange: getLast7DaysRange },
  { value: 'last30days', label: '近30天', getRange: getLast30DaysRange },
  { value: 'thisweek', label: '本周', getRange: getThisWeekRange },
  { value: 'lastweek', label: '上周', getRange: getLastWeekRange },
  { value: 'thismonth', label: '本月', getRange: getThisMonthRange },
  { value: 'lastmonth', label: '上月', getRange: getLastMonthRange },
  { value: 'thisyear', label: '今年', getRange: getThisYearRange },
  { value: 'custom', label: '自定义', getRange: () => ({ startDate: '', endDate: '' }) },
];

function getThisWeekRange(): { startDate: string; endDate: string } {
  const now = new Date();
  return {
    startDate: formatDate(getStartOfWeek(now)),
    endDate: formatDate(getEndOfWeek(now)),
  };
}

function getLastWeekRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const lastWeekStart = new Date(getStartOfWeek(now).getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(getEndOfWeek(now).getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    startDate: formatDate(lastWeekStart),
    endDate: formatDate(lastWeekEnd),
  };
}

function getThisMonthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  return {
    startDate: formatDate(getStartOfMonth(now)),
    endDate: formatDate(getEndOfMonth(now)),
  };
}

function getLastMonthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    startDate: formatDate(lastMonthStart),
    endDate: formatDate(lastMonthEnd),
  };
}

function getThisYearRange(): { startDate: string; endDate: string } {
  const now = new Date();
  return {
    startDate: formatDate(getStartOfYear(now)),
    endDate: formatDate(getEndOfYear(now)),
  };
}

function isDuplicate(txn: Transaction): boolean {
  return txn.is_duplicate === 1 || txn.is_duplicate === true;
}

function isRefund(txn: Transaction): boolean {
  return txn.is_refund === 1 || txn.is_refund === true;
}

// ========== Search Stats Panel Component ==========
interface SearchStatsPanelProps {
  transactions: Transaction[];
  filter: FilterState;
}

function SearchStatsPanel({ transactions, filter: _filter }: SearchStatsPanelProps) {
  // Only show when there are transactions and filter is applied
  if (transactions.length === 0) return null;

  const stats = transactions.reduce(
    (acc, txn) => {
      if (txn.type === 'income') {
        acc.income += txn.amount;
        acc.incomeCount++;
      } else if (txn.type === 'expense') {
        acc.expense += txn.amount;
        acc.expenseCount++;
      }
      return acc;
    },
    { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 }
  );

  const net = stats.income - stats.expense;

  return (
    <div className="card" style={{ marginBottom: '16px', background: '#F8FAFC' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>📊</span>
          <span style={{ fontWeight: 600, color: '#1F2937' }}>搜索结果</span>
        </div>

        <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
          <div>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>共</span>
            <span style={{ fontSize: '18px', fontWeight: 600, marginLeft: '4px', color: '#1F2937' }}>
              {transactions.length}
            </span>
            <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '2px' }}>条</span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>收入</span>
            <span style={{ fontSize: '18px', fontWeight: 600, marginLeft: '4px', color: '#10B981' }}>
              +¥{stats.income.toFixed(2)}
            </span>
            <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '4px' }}>({stats.incomeCount}笔)</span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>支出</span>
            <span style={{ fontSize: '18px', fontWeight: 600, marginLeft: '4px', color: '#EF4444' }}>
              -¥{stats.expense.toFixed(2)}
            </span>
            <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '4px' }}>({stats.expenseCount}笔)</span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>结余</span>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 600,
                marginLeft: '4px',
                color: net >= 0 ? '#10B981' : '#EF4444'
              }}
            >
              {net >= 0 ? '+' : '-'}¥{Math.abs(net).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Date Range Selector Component ==========
interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
}

function DateRangeSelector({ startDate, endDate, onChange }: DateRangeSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);

  // Determine current selection
  const getCurrentOption = (): DateRangeOption => {
    if (!startDate && !endDate) return 'thismonth';

    const today = getTodayRange();
    const yesterday = getYesterdayRange();
    const last7 = getLast7DaysRange();
    const last30 = getLast30DaysRange();
    const thisWeek = getThisWeekRange();
    const lastWeek = getLastWeekRange();
    const thisMonth = getThisMonthRange();
    const lastMonth = getLastMonthRange();
    const thisYear = getThisYearRange();

    if (startDate === today.startDate && endDate === today.endDate) return 'today';
    if (startDate === yesterday.startDate && endDate === yesterday.endDate) return 'yesterday';
    if (startDate === last7.startDate && endDate === last7.endDate) return 'last7days';
    if (startDate === last30.startDate && endDate === last30.endDate) return 'last30days';
    if (startDate === thisWeek.startDate && endDate === thisWeek.endDate) return 'thisweek';
    if (startDate === lastWeek.startDate && endDate === lastWeek.endDate) return 'lastweek';
    if (startDate === thisMonth.startDate && endDate === thisMonth.endDate) return 'thismonth';
    if (startDate === lastMonth.startDate && endDate === lastMonth.endDate) return 'lastmonth';
    if (startDate === thisYear.startDate && endDate === thisYear.endDate) return 'thisyear';

    return 'custom';
  };

  const currentOption = getCurrentOption();

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as DateRangeOption;
    if (value === 'custom') {
      setIsCustom(true);
      return;
    }
    setIsCustom(false);
    const option = DATE_RANGE_OPTIONS.find(opt => opt.value === value);
    if (option) {
      onChange(option.getRange());
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ startDate: e.target.value, endDate });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ startDate, endDate: e.target.value });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <select
        value={isCustom || currentOption === 'custom' ? 'custom' : currentOption}
        onChange={handleSelectChange}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: '1px solid #D1D5DB',
          background: 'white',
          fontSize: '14px'
        }}
      >
        {DATE_RANGE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {isCustom && (
        <>
          <input
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '14px'
            }}
          />
          <span style={{ color: '#6B7280' }}>至</span>
          <input
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '14px'
            }}
          />
        </>
      )}
    </div>
  );
}

export default function Transactions({ locationSearch, onReplaceSearch }: TransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateReviewItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<TransactionSortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const requestIdRef = useRef(0);
  const [editableNotes, setEditableNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [editableTags, setEditableTags] = useState<string | null>(null);
  const [tempTags, setTempTags] = useState('');
  const [pendingMemberAssignment, setPendingMemberAssignment] = useState<{
    transaction: Transaction;
    memberId: string;
    memberName: string;
  } | null>(null);
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<string>>(new Set());
  const tagsInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultThisMonth = getThisMonthRange();
  const [filter, setFilter] = useState<FilterState>({
    startDate: defaultThisMonth.startDate,
    endDate: defaultThisMonth.endDate,
    category: '',
    merchant: '',
    source: '',
    type: '',
    memberId: '',
    accountId: '',
    q: '',
  });
  const drillQuery = useMemo(() => parseDrilldownQuery(locationSearch), [locationSearch]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const loadTransactions = async () => {
    const responseRequestId = requestIdRef.current + 1;
    requestIdRef.current = responseRequestId;

    try {
      const query: TransactionQuery = {
        startDate: filter.startDate || undefined,
        endDate: filter.endDate || undefined,
        category: filter.category || undefined,
        merchant: filter.merchant || undefined,
        source: (filter.source || undefined) as TransactionQuery['source'],
        type: (filter.type || undefined) as TransactionQuery['type'],
        memberId: filter.memberId || undefined,
        accountId: filter.accountId || undefined,
        q: filter.q || undefined,
        page,
        pageSize,
        sortBy,
        sortOrder,
      };

      const result = await window.electronAPI.getTransactions(query);
      if (!shouldApplyLatestResponse(requestIdRef.current, responseRequestId)) {
        return;
      }
      setTransactions(result.items);
      setTotal(result.totalCount ?? result.total ?? 0);
    } catch (error) {
      if (!shouldApplyLatestResponse(requestIdRef.current, responseRequestId)) {
        return;
      }
      console.error('Failed to load transactions:', error);
    }
  };

  const loadDuplicates = async () => {
    try {
      const data = await window.electronAPI.getDuplicateTransactions();
      setDuplicates(data);
    } catch (error) {
      console.error('Failed to load duplicates:', error);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [filter, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    loadDuplicates();
  }, []);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const data = await window.electronAPI.getMembers();
        setMembers(data);
      } catch (error) {
        console.error('Failed to load members:', error);
      }
    };
    loadMembers();
  }, []);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await window.electronAPI.getAccounts();
        setAccounts(data);
      } catch (error) {
        console.error('Failed to load accounts:', error);
      }
    };
    loadAccounts();
  }, []);

  useEffect(() => {
    const hasDrillParams = Boolean(drillQuery.drill || drillQuery.from || drillQuery.to || drillQuery.category || drillQuery.merchant);
    if (!hasDrillParams) return;

    setPage(1);
    setFilter((prev) => ({
      ...prev,
      startDate: drillQuery.from || '',
      endDate: drillQuery.to || '',
      category: drillQuery.category || '',
      merchant: drillQuery.merchant || '',
    }));
  }, [drillQuery]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const updateFilter = (next: Partial<FilterState>) => {
    setPage(1);
    setFilter((prev) => ({ ...prev, ...next }));
  };

  const handleCategoryChange = async (id: string, category: string) => {
    await window.electronAPI.updateCategory(id, category);
    await loadTransactions();
  };

  const startEditNotes = (id: string, currentNotes: string | null | undefined) => {
    setEditableNotes(id);
    setTempNotes(currentNotes || '');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEditNotes = () => {
    setEditableNotes(null);
    setTempNotes('');
  };

  const saveNotes = async (id: string) => {
    await window.electronAPI.updateNotes(id, tempNotes);
    setEditableNotes(null);
    setTempNotes('');
    await loadTransactions();
  };

  const handleNotesKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      saveNotes(id);
    } else if (e.key === 'Escape') {
      cancelEditNotes();
    }
  };

  const startEditTags = (id: string, currentTags: string | null | undefined) => {
    setEditableTags(id);
    let parsedTags: string[] = [];
    if (currentTags) {
      try {
        parsedTags = JSON.parse(currentTags);
        if (!Array.isArray(parsedTags)) {
          parsedTags = [];
        }
      } catch {
        parsedTags = [];
      }
    }
    setTempTags(parsedTags.join(', '));
    setTimeout(() => tagsInputRef.current?.focus(), 0);
  };

  const cancelEditTags = () => {
    setEditableTags(null);
    setTempTags('');
  };

  const saveTags = async (id: string) => {
    // Get current tags from database
    const currentTags = await window.electronAPI.getTags(id);
    
    // Parse new tags from input (comma-separated)
    const newTags = tempTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    
    // Find tags to add (in newTags but not in currentTags)
    const tagsToAdd = newTags.filter(t => !currentTags.includes(t));
    
    // Find tags to remove (in currentTags but not in newTags)
    const tagsToRemove = currentTags.filter(t => !newTags.includes(t));
    
    // Add new tags
    for (const tag of tagsToAdd) {
      await window.electronAPI.addTag(id, tag);
    }
    
    // Remove old tags
    for (const tag of tagsToRemove) {
      await window.electronAPI.removeTag(id, tag);
    }
    
    setEditableTags(null);
    setTempTags('');
    await loadTransactions();
  };

  const handleRemoveTag = async (id: string, tag: string) => {
    await window.electronAPI.removeTag(id, tag);
    await loadTransactions();
  };

  const handleMemberAssignment = async (transaction: Transaction, memberId: string | null) => {
    if (memberId === null) {
      // If unassigning, just do it directly
      await window.electronAPI.setTransactionMember(transaction.id, null);
      await loadTransactions();
      return;
    }

    // First, assign the current transaction
    await window.electronAPI.setTransactionMember(transaction.id, memberId);

    // Check for similar assignments
    const result = await window.electronAPI.checkSimilarAssignments(transaction, memberId, 2);

    if (result.shouldPrompt && result.similarCount >= 2) {
      // Store pending assignment and show prompt
      setPendingMemberAssignment({
        transaction,
        memberId,
        memberName: result.memberName,
      });
    } else {
      // No prompt needed, just refresh
      await loadTransactions();
    }
  };

  const handleBatchAssignConfirm = async () => {
    if (!pendingMemberAssignment) return;

    const { transaction, memberId } = pendingMemberAssignment;

    // Batch assign similar transactions
    const updatedCount = await window.electronAPI.batchAssignSimilar(transaction, memberId);
    console.log(`Batch assigned ${updatedCount} similar transactions`);

    // Clear pending and refresh
    setPendingMemberAssignment(null);
    await loadTransactions();
  };

  const handleBatchAssignCancel = async () => {
    // Just clear the pending state, the transaction is already assigned
    setPendingMemberAssignment(null);
    await loadTransactions();
  };

  const handleAccountAssignment = async (transactionId: string, accountId: string | null) => {
    await window.electronAPI.setTransactionAccount(transactionId, accountId);
    await loadTransactions();
  };

  const handleTagsKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      saveTags(id);
    } else if (e.key === 'Escape') {
      cancelEditTags();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条记录吗？')) {
      await window.electronAPI.deleteTransaction(id);
      await Promise.all([loadTransactions(), loadDuplicates()]);
    }
  };

  const handleDuplicateAction = async (id: string, action: 'keep' | 'merge') => {
    await window.electronAPI.resolveDuplicate(id, action);
    await Promise.all([loadTransactions(), loadDuplicates()]);
  };

  const toggleSort = (field: TransactionSortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortOrder('desc');
  };

  const formatDuplicateSummary = (txn: {
    date?: string | null;
    amount?: number | null;
    source?: string | null;
    type?: string | null;
    counterparty?: string | null;
    description?: string | null;
  }) => {
    const merchant = txn.counterparty || txn.description || '-';
    const date = txn.date || '-';
    const amount = `¥${Math.abs(Number(txn.amount ?? 0)).toFixed(2)}`;
    const source = txn.source ? SOURCE_LABELS[txn.source] || txn.source : '-';
    const type = txn.type ? TYPE_LABELS[txn.type] || txn.type : '-';
    return `${date} / ${type} / ${amount} / ${source} / ${merchant}`;
  };

  const drillContextVisible = Boolean(drillQuery.from || drillQuery.to || drillQuery.category || drillQuery.merchant || drillQuery.drill);
  const drillChips: Array<{ key: 'from' | 'to' | 'category' | 'merchant'; label: string }> = [];
  if (filter.startDate) drillChips.push({ key: 'from', label: `开始: ${filter.startDate}` });
  if (filter.endDate) drillChips.push({ key: 'to', label: `结束: ${filter.endDate}` });
  if (filter.category) drillChips.push({ key: 'category', label: `分类: ${filter.category}` });
  if (filter.merchant) drillChips.push({ key: 'merchant', label: `商家: ${filter.merchant}` });

  const clearDrillContext = () => {
    setPage(1);
    setFilter((prev) => ({ ...prev, startDate: '', endDate: '', category: '', merchant: '' }));
    onReplaceSearch('');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(transactions.map((txn) => txn.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectTransaction = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleExportSelected = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await window.electronAPI.exportCSV(ids);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (confirm(`确定要删除选中的 ${count} 条记录吗？此操作不可撤销。`)) {
      const ids = Array.from(selectedIds);
      await window.electronAPI.deleteTransactionsByIds(ids);
      setSelectedIds(new Set());
      await Promise.all([loadTransactions(), loadDuplicates()]);
    }
  };

  const isAllSelected = transactions.length > 0 && transactions.every((txn) => selectedIds.has(txn.id));
  const isPartialSelected = transactions.some((txn) => selectedIds.has(txn.id)) && !isAllSelected;

  // ========== Duplicate Batch Operations ==========
  const handleSelectDuplicateAll = (checked: boolean) => {
    if (checked) {
      setSelectedDuplicateIds(new Set(duplicates.map(d => d.id)));
    } else {
      setSelectedDuplicateIds(new Set());
    }
  };

  const handleSelectDuplicate = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedDuplicateIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedDuplicateIds(newSelected);
  };

  const handleBatchDuplicateAction = async (action: 'keep' | 'merge') => {
    if (selectedDuplicateIds.size === 0) return;
    const count = selectedDuplicateIds.size;
    const actionText = action === 'keep' ? '保留' : '合并';
    if (confirm(`确定要${actionText}选中的 ${count} 条重复记录吗？`)) {
      const ids = Array.from(selectedDuplicateIds);
      let successCount = 0;
      for (const id of ids) {
        try {
          await window.electronAPI.resolveDuplicate(id, action);
          successCount++;
        } catch (error) {
          console.error(`Failed to ${action} duplicate ${id}:`, error);
        }
      }
      setSelectedDuplicateIds(new Set());
      await Promise.all([loadTransactions(), loadDuplicates()]);
      alert(`成功${actionText} ${successCount} 条记录`);
    }
  };

  const isAllDuplicatesSelected = duplicates.length > 0 && duplicates.every(d => selectedDuplicateIds.has(d.id));
  const isPartialDuplicatesSelected = duplicates.some(d => selectedDuplicateIds.has(d.id)) && !isAllDuplicatesSelected;

  return (
    <div className="transactions">
      <div className="page-header">
        <h2>交易记录</h2>
        <p className="page-subtitle">查看和管理所有交易明细</p>
      </div>

      {drillContextVisible && (
        <div className="drilldown-chips">
          {drillChips.map((chip) => (
            <button
              key={chip.key}
              className="drilldown-chip"
              onClick={() => onReplaceSearch(removeDrilldownField(locationSearch, chip.key))}
            >
              {chip.label} ×
            </button>
          ))}
          <button className="btn-secondary" onClick={clearDrillContext}>
            清除钻取条件
          </button>
        </div>
      )}

      {/* Search Stats Panel */}
      <SearchStatsPanel transactions={transactions} filter={filter} />

      <div className="filters filters-wrap">
        <input
          className="search-input"
          value={filter.q}
          placeholder="搜索描述/备注"
          onChange={(e) => updateFilter({ q: e.target.value })}
        />

        <input
          className="search-input"
          data-testid="merchant-search"
          value={filter.merchant}
          placeholder="搜索商家"
          onChange={(e) => updateFilter({ merchant: e.target.value })}
        />

        <label className="filter-inline">
          时间范围
          <DateRangeSelector
            startDate={filter.startDate}
            endDate={filter.endDate}
            onChange={({ startDate, endDate }) => updateFilter({ startDate, endDate })}
          />
        </label>

        <div className="quick-filters">
          <button className="btn-secondary" onClick={() => updateFilter(getThisWeekRange())}>
            本周
          </button>
          <button className="btn-secondary" onClick={() => updateFilter(getLastWeekRange())}>
            上周
          </button>
          <button className="btn-secondary" onClick={() => updateFilter(getThisMonthRange())}>
            本月
          </button>
          <button className="btn-secondary" onClick={() => updateFilter(getLastMonthRange())}>
            上月
          </button>
          <button className="btn-secondary" onClick={() => updateFilter(getThisYearRange())}>
            今年
          </button>
        </div>

        <select value={filter.category} onChange={(e) => updateFilter({ category: e.target.value })}>
          <option value="">所有分类</option>
          {Object.keys(CATEGORIES).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select value={filter.memberId} onChange={(e) => updateFilter({ memberId: e.target.value })}>
          <option value="">所有成员</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>

        <select value={filter.accountId} onChange={(e) => updateFilter({ accountId: e.target.value })}>
          <option value="">所有账户</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>

        <select value={filter.source} onChange={(e) => updateFilter({ source: e.target.value })}>
          <option value="">所有来源</option>
          <option value="alipay">支付宝</option>
          <option value="wechat">微信</option>
          <option value="yunshanfu">云闪付</option>
        </select>

        <select value={filter.type} onChange={(e) => updateFilter({ type: e.target.value })}>
          <option value="">所有类型</option>
          <option value="expense">支出</option>
          <option value="income">收入</option>
          <option value="transfer">转账</option>
        </select>

        <button
          className="btn-secondary"
          onClick={() => {
            setFilter({ startDate: '', endDate: '', category: '', merchant: '', source: '', type: '', memberId: '', accountId: '', q: '' });
            setPage(1);
            setSortBy('date');
            setSortOrder('desc');
            setPageSize(20);
            onReplaceSearch('');
          }}
        >
          重置
        </button>
      </div>

      {duplicates.length > 0 && (
        <div className="duplicate-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>待确认重复记录 ({duplicates.length})</h3>
            {selectedDuplicateIds.size > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#6B7280', fontSize: '14px' }}>
                  已选择 {selectedDuplicateIds.size} 条
                </span>
                <button
                  onClick={() => handleBatchDuplicateAction('keep')}
                  className="btn-secondary"
                  style={{ fontSize: '13px', padding: '4px 12px' }}
                >
                  保留选中
                </button>
                <button
                  onClick={() => handleBatchDuplicateAction('merge')}
                  className="btn-primary"
                  style={{ fontSize: '13px', padding: '4px 12px' }}
                >
                  合并选中
                </button>
              </div>
            )}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={isAllDuplicatesSelected}
                    ref={(el) => { if (el) el.indeterminate = isPartialDuplicatesSelected; }}
                    onChange={(e) => handleSelectDuplicateAll(e.target.checked)}
                  />
                </th>
                <th>当前记录</th>
                <th>建议记录</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {duplicates.map((txn) => (
                <tr key={txn.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedDuplicateIds.has(txn.id)}
                      onChange={(e) => handleSelectDuplicate(txn.id, e.target.checked)}
                    />
                  </td>
                  <td>{formatDuplicateSummary(txn)}</td>
                  <td>
                    {txn.target_id
                      ? formatDuplicateSummary({
                          date: txn.target_date,
                          amount: txn.target_amount,
                          source: txn.target_source,
                          type: txn.target_type,
                          counterparty: txn.target_counterparty,
                          description: txn.target_description,
                        })
                      : txn.merged_with || '-'}
                  </td>
                  <td className="actions">
                    <button onClick={() => handleDuplicateAction(txn.id, 'keep')} className="btn-secondary">
                      保留两条
                    </button>
                    <button onClick={() => handleDuplicateAction(txn.id, 'merge')} className="btn-primary">
                      合并
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-toolbar">
        <div className="table-meta">
          {selectedIds.size > 0 ? (
            <span className="selected-count">已选择 {selectedIds.size} 条</span>
          ) : (
            <span>共 {total} 条</span>
          )}
        </div>
        <div className="toolbar-actions">
          {selectedIds.size > 0 && (
            <>
              <button className="btn-primary" onClick={handleExportSelected}>
                导出选中
              </button>
              <button className="btn-danger" onClick={handleDeleteSelected}>
                删除选中 ({selectedIds.size})
              </button>
            </>
          )}
          <button className="btn-secondary" onClick={() => toggleSort('date')}>
            日期排序 {sortBy === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
          </button>
          <button className="btn-secondary" onClick={() => toggleSort('amount')}>
            金额排序 {sortBy === 'amount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isPartialSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th>日期</th>
              <th>类型</th>
              <th>金额</th>
              <th>商家</th>
              <th>描述</th>
              <th>备注</th>
              <th>标签</th>
              <th>分类</th>
              <th>成员</th>
              <th>账户</th>
              <th>来源</th>
              <th>退款关联</th>
              <th>去重</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={15}>暂无数据</td>
              </tr>
            )}
            {transactions.map((txn) => {
              const tags: string[] = txn.tags ? (() => {
                try {
                  const parsed = JSON.parse(txn.tags);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              })() : [];
              
              return (
              <tr key={txn.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(txn.id)}
                    onChange={(e) => handleSelectTransaction(txn.id, e.target.checked)}
                  />
                </td>
                <td>{txn.date}</td>
                <td>{TYPE_LABELS[txn.type] || txn.type}</td>
                <td className={txn.type === 'income' ? 'income' : 'expense'}>
                  {txn.type === 'income' ? '+' : '-'}¥{Math.abs(txn.amount).toFixed(2)}
                </td>
                <td>{txn.counterparty || '-'}</td>
                <td>{txn.description || '-'}</td>
                <td onClick={() => startEditNotes(txn.id, txn.notes)}>
                  {editableNotes === txn.id ? (
                    <input
                      ref={inputRef}
                      className="notes-input"
                      value={tempNotes}
                      onChange={(e) => setTempNotes(e.target.value)}
                      onBlur={() => saveNotes(txn.id)}
                      onKeyDown={(e) => handleNotesKeyDown(e, txn.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="editable-notes">{txn.notes || '-'}</span>
                  )}
                </td>
                <td onClick={(e) => { e.stopPropagation(); startEditTags(txn.id, txn.tags); }}>
                  {editableTags === txn.id ? (
                    <input
                      ref={tagsInputRef}
                      className="tags-input"
                      value={tempTags}
                      onChange={(e) => setTempTags(e.target.value)}
                      onBlur={() => saveTags(txn.id)}
                      onKeyDown={(e) => handleTagsKeyDown(e, txn.id)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="标签(逗号分隔)"
                    />
                  ) : (
                    <div className="tags-container">
                      {tags.length > 0 ? (
                        tags.map((tag) => (
                          <span key={tag} className="tag-chip">
                            {tag}
                            <button
                              className="tag-remove"
                              onClick={(e) => { e.stopPropagation(); handleRemoveTag(txn.id, tag); }}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="no-tags">-</span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <select value={txn.category || '其他'} onChange={(e) => handleCategoryChange(txn.id, e.target.value)}>
                    {Object.keys(CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={txn.member_id || ''}
                    onChange={(e) => handleMemberAssignment(txn, e.target.value || null)}
                    className="member-select"
                  >
                    <option value="">-</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={txn.account_id || ''}
                    onChange={(e) => handleAccountAssignment(txn.id, e.target.value || null)}
                    className="account-select-cell"
                  >
                    <option value="">-</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{SOURCE_LABELS[txn.source] || txn.source}</td>
                <td>{isRefund(txn) ? (txn.refund_of ? `原交易: ${txn.refund_of}` : '退款(未匹配)') : '-'}</td>
                <td>{isDuplicate(txn) ? <span className="duplicate-badge">疑似重复</span> : '-'}</td>
                <td>
                  <button onClick={() => handleDelete(txn.id)} className="btn-danger">
                    删除
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div className="page-size-control">
          <span>每页</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>条</span>
        </div>

        <div className="pagination-controls">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
            上一页
          </button>
          <span>
            第 {page} / {totalPages} 页
          </span>
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            下一页
          </button>
        </div>
      </div>

      {/* Batch Assignment Prompt Modal */}
      {pendingMemberAssignment && (
        <div className="modal-overlay" onClick={handleBatchAssignCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>批量分配确认</h3>
            <p>
              检测到 <strong>{pendingMemberAssignment.memberName}</strong> 已有 2 笔或更多相似交易（相同商户/分类）。
            </p>
            <p>是否将所有相似交易都分配给 <strong>{pendingMemberAssignment.memberName}</strong>？</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleBatchAssignCancel}>
                仅分配当前交易
              </button>
              <button className="btn-primary" onClick={handleBatchAssignConfirm}>
                批量应用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
