import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES } from '../../shared/constants';
import { DuplicateReviewItem, SortOrder, Transaction, TransactionQuery, TransactionSortBy } from '../../shared/types';
import { parseDrilldownQuery, removeDrilldownField, shouldApplyLatestResponse } from '../../shared/drilldown';

interface FilterState {
  startDate: string;
  endDate: string;
  category: string;
  merchant: string;
  source: string;
  type: string;
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

function isDuplicate(txn: Transaction): boolean {
  return txn.is_duplicate === 1 || txn.is_duplicate === true;
}

function isRefund(txn: Transaction): boolean {
  return txn.is_refund === 1 || txn.is_refund === true;
}

export default function Transactions({ locationSearch, onReplaceSearch }: TransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<TransactionSortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const requestIdRef = useRef(0);
  const [editableNotes, setEditableNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<FilterState>({
    startDate: '',
    endDate: '',
    category: '',
    merchant: '',
    source: '',
    type: '',
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

      <div className="filters filters-wrap">
        <input
          className="search-input"
          value={filter.q}
          placeholder="搜索描述/备注"
          onChange={(e) => updateFilter({ q: e.target.value })}
        />

        <label className="filter-inline">
          开始日期
          <input type="date" value={filter.startDate} onChange={(e) => updateFilter({ startDate: e.target.value })} />
        </label>

        <label className="filter-inline">
          结束日期
          <input type="date" value={filter.endDate} onChange={(e) => updateFilter({ endDate: e.target.value })} />
        </label>

        <select value={filter.category} onChange={(e) => updateFilter({ category: e.target.value })}>
          <option value="">所有分类</option>
          {Object.keys(CATEGORIES).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
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
            setFilter({ startDate: '', endDate: '', category: '', merchant: '', source: '', type: '', q: '' });
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
          <h3>待确认重复记录 ({duplicates.length})</h3>
          <table className="table">
            <thead>
              <tr>
                <th>当前记录</th>
                <th>建议记录</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {duplicates.map((txn) => (
                <tr key={txn.id}>
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
        <div className="table-meta">共 {total} 条</div>
        <div className="sort-controls">
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
              <th>日期</th>
              <th>类型</th>
              <th>金额</th>
              <th>商家</th>
              <th>描述</th>
              <th>备注</th>
              <th>分类</th>
              <th>来源</th>
              <th>退款关联</th>
              <th>去重</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={11}>暂无数据</td>
              </tr>
            )}
            {transactions.map((txn) => (
              <tr key={txn.id}>
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
                <td>
                  <select value={txn.category || '其他'} onChange={(e) => handleCategoryChange(txn.id, e.target.value)}>
                    {Object.keys(CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
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
            ))}
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
    </div>
  );
}
