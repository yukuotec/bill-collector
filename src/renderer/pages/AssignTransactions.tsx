import { useEffect, useState, useCallback } from 'react';
import { Member, Transaction, TransactionQuery } from '../../shared/types';

interface SimilarAssignmentResult {
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
}

export default function AssignTransactions() {
  const [unassignedTransactions, setUnassignedTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [memberSummary, setMemberSummary] = useState<Record<string, { total: number; count: number }>>({});
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptData, setPromptData] = useState<SimilarAssignmentResult | null>(null);

  // Date range filter
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  // Search and multi-select
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch unassigned transactions
  const fetchUnassignedTransactions = useCallback(async () => {
    try {
      const query: TransactionQuery = {
        memberId: '', // Empty string means unassigned
        startDate: startDate,
        endDate: endDate,
      };
      const result = await window.electronAPI.getTransactions(query);
      setUnassignedTransactions(result.items);
      setFilteredTransactions(result.items);
    } catch (error) {
      console.error('Failed to fetch unassigned transactions:', error);
    }
  }, [startDate, endDate]);

  // Fetch members
  const fetchMembers = useCallback(async () => {
    try {
      const data = await window.electronAPI.getMembers();
      setMembers(data);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  }, []);

  // Fetch member summary
  const fetchMemberSummary = useCallback(async () => {
    try {
      const currentYear = new Date().getFullYear();
      const summary = await window.electronAPI.getMemberSummary(currentYear);
      const summaryMap: Record<string, { total: number; count: number }> = {};
      summary.forEach((item) => {
        summaryMap[item.memberId] = {
          total: item.total,
          count: Math.floor(item.total / 100), // Approximate count based on spending
        };
      });
      setMemberSummary(summaryMap);
    } catch (error) {
      console.error('Failed to fetch member summary:', error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchUnassignedTransactions(), fetchMembers(), fetchMemberSummary()]);
      setLoading(false);
    };
    loadData();
  }, [fetchUnassignedTransactions, fetchMembers, fetchMemberSummary]);

  // Search filter effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTransactions(unassignedTransactions);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = unassignedTransactions.filter(t =>
        (t.counterparty?.toLowerCase().includes(query) || false) ||
        (t.description?.toLowerCase().includes(query) || false) ||
        (t.category?.toLowerCase().includes(query) || false)
      );
      setFilteredTransactions(filtered);
    }
  }, [searchQuery, unassignedTransactions]);

  // Toggle transaction selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select all visible transactions
  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Batch assign selected transactions to a member
  const batchAssignSelected = async (memberId: string) => {
    if (selectedIds.size === 0) return;

    const idsToAssign = Array.from(selectedIds);
    let successCount = 0;
    let totalAmount = 0;

    for (const transactionId of idsToAssign) {
      const transaction = unassignedTransactions.find(t => t.id === transactionId);
      if (transaction) {
        try {
          await window.electronAPI.setTransactionMember(transactionId, memberId);
          successCount++;
          totalAmount += transaction.amount;
        } catch (error) {
          console.error('[Assign] Failed to assign transaction:', transactionId, error);
        }
      }
    }

    // Update local state
    setUnassignedTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
    setFilteredTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));

    // Update member summary locally for immediate feedback
    setMemberSummary(prev => ({
      ...prev,
      [memberId]: {
        total: (prev[memberId]?.total || 0) + totalAmount,
        count: (prev[memberId]?.count || 0) + successCount,
      }
    }));

    setSelectedIds(new Set());

    // Refresh from server
    setTimeout(() => handleRefresh(), 100);
  };

  // Refresh data
  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchUnassignedTransactions(), fetchMemberSummary()]);
    setLoading(false);
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, transaction: Transaction) => {
    setDraggingId(transaction.id);
    e.dataTransfer.setData('text/plain', transaction.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggingId(null);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent, memberId: string) => {
    e.preventDefault();
    const transactionId = e.dataTransfer.getData('text/plain');
    if (!transactionId) return;

    const transaction = unassignedTransactions.find((t) => t.id === transactionId);
    if (!transaction) return;

    try {
      // Assign transaction to member
      await window.electronAPI.setTransactionMember(transactionId, memberId);

      // Immediately remove from local state for better UX
      setUnassignedTransactions(prev => prev.filter(t => t.id !== transactionId));
      setFilteredTransactions(prev => prev.filter(t => t.id !== transactionId));

      // Update member summary locally for immediate feedback
      setMemberSummary(prev => ({
        ...prev,
        [memberId]: {
          total: (prev[memberId]?.total || 0) + (transaction.amount || 0),
          count: (prev[memberId]?.count || 0) + 1,
        }
      }));

      // Check similar assignments
      const result: SimilarAssignmentResult = await window.electronAPI.checkSimilarAssignments(
        transaction,
        memberId,
        2
      );

      if (result.shouldPrompt && result.similarCount > 0) {
        setPromptData(result);
        setShowPrompt(true);
      }

      // Refresh data after a short delay to ensure DB is saved
      setTimeout(async () => {
        await handleRefresh();
      }, 100);
    } catch (error) {
      console.error('Failed to assign transaction:', error);
      // Restore the transaction if failed
      await fetchUnassignedTransactions();
    }

    setDraggingId(null);
  };

  // Handle batch assign
  const handleBatchAssign = async () => {
    if (!promptData || !promptData.similarTransactions.length) return;

    try {
      const transaction = unassignedTransactions.find((t) => t.id === promptData.similarTransactions[0]?.id);
      if (transaction) {
        await window.electronAPI.batchAssignSimilar(transaction, promptData.memberId);
        await handleRefresh();
      }
    } catch (error) {
      console.error('Failed to batch assign:', error);
    }

    setShowPrompt(false);
    setPromptData(null);
  };

  // Handle skip batch assign
  const handleSkipBatchAssign = () => {
    setShowPrompt(false);
    setPromptData(null);
  };

  // Get member icon by name
  const getMemberIcon = (name: string) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('老公') || nameLower.includes('爸') || nameLower.includes('夫')) return '👨';
    if (nameLower.includes('老婆') || nameLower.includes('妈') || nameLower.includes('妻')) return '👩';
    if (nameLower.includes('孩子') || nameLower.includes('儿') || nameLower.includes('女')) return '👧';
    if (nameLower.includes('家庭') || nameLower.includes('家')) return '🏠';
    return '👤';
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading && unassignedTransactions.length === 0) {
    return (
      <div className="assign-loading">
        <div className="loading-spinner">加载中...</div>
      </div>
    );
  }

  return (
    <div className="assign-page">
      {/* Header */}
      <div className="assign-header">
        <div className="assign-title">
          <span className="icon">📋</span>
          <h2>待分配交易</h2>
          <span className="badge">{unassignedTransactions.length}笔</span>
        </div>
        <div className="assign-actions">
          <button className="btn btn-secondary" onClick={handleRefresh}>
            刷新
          </button>
        </div>
      </div>

      {/* Date Range Filter & Search */}
      <div className="assign-filters card">
        <div className="filter-row">
          <label>日期范围：</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="date-input"
          />
          <span className="separator">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="date-input"
          />
          <button className="btn btn-primary btn-sm" onClick={handleRefresh}>
            应用筛选
          </button>
        </div>
        <div className="filter-row" style={{ marginTop: '12px' }}>
          <label>搜索：</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索商户、描述或分类..."
            className="search-input"
            style={{ flex: 1, maxWidth: '400px' }}
          />
          <span className="text-secondary">{filteredTransactions.length} 笔交易</span>
        </div>
      </div>

      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="batch-actions card">
          <div className="batch-info">
            已选择 <strong>{selectedIds.size}</strong> 笔交易
            {(() => {
              const total = unassignedTransactions
                .filter(t => selectedIds.has(t.id))
                .reduce((sum, t) => sum + (t.amount || 0), 0);
              return ` (${formatCurrency(total)})`;
            })()}
          </div>
          <div className="batch-buttons">
            <button className="btn btn-secondary btn-sm" onClick={clearSelection}>
              清除选择
            </button>
            {members.map(member => (
              <button
                key={member.id}
                className="btn btn-primary btn-sm"
                style={{ backgroundColor: member.color, borderColor: member.color }}
                onClick={() => batchAssignSelected(member.id)}
              >
                分配给 {member.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Transactions List */}
      <div className="assign-content">
        <div className="unassigned-list">
          {filteredTransactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <p>{searchQuery ? '没有匹配的交易' : '所有交易已分配完毕！'}</p>
            </div>
          ) : (
            <>
              <div className="selection-actions">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                    onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
                  />
                  全选
                </label>
                {selectedIds.size > 0 && (
                  <button className="btn btn-link btn-sm" onClick={clearSelection}>
                    清除选择 ({selectedIds.size})
                  </button>
                )}
              </div>
              <div className="transaction-cards">
                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`transaction-card ${draggingId === transaction.id ? 'dragging' : ''} ${selectedIds.has(transaction.id) ? 'selected' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, transaction)}
                    onDragEnd={handleDragEnd}
                    onClick={() => toggleSelection(transaction.id)}
                  >
                    <div className="transaction-card-header">
                      <div className="transaction-header-left">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(transaction.id)}
                          onChange={() => toggleSelection(transaction.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="transaction-amount">{formatCurrency(transaction.amount)}</span>
                      </div>
                      <span className="transaction-category">{transaction.category || '未分类'}</span>
                    </div>
                    <div className="transaction-card-body">
                      <span className="transaction-merchant">
                        {transaction.counterparty || transaction.description || '无商户'}
                      </span>
                    </div>
                    <div className="transaction-card-footer">
                      <span className="transaction-date">{formatDate(transaction.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Member Boxes */}
        <div className="member-boxes">
          {members.map((member) => (
            <div
              key={member.id}
              className={`member-box ${draggingId ? 'droppable' : ''} ${selectedIds.size > 0 ? 'clickable' : ''}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, member.id)}
              onClick={() => selectedIds.size > 0 && batchAssignSelected(member.id)}
              style={{ borderColor: member.color }}
            >
              <div className="member-box-header">
                <span className="member-icon">{getMemberIcon(member.name)}</span>
                <span className="member-name">{member.name}</span>
              </div>
              <div className="member-box-body">
                <div className="member-total">
                  {formatCurrency(memberSummary[member.id]?.total || 0)}
                </div>
                <div className="member-count">
                  ({memberSummary[member.id]?.count || 0}笔)
                </div>
              </div>
              {selectedIds.size > 0 && (
                <div className="member-box-hint">点击分配</div>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <div className="empty-members">
              <p>暂无成员，请先添加成员</p>
            </div>
          )}
        </div>
      </div>

      {/* Similar Assignment Prompt Modal */}
      {showPrompt && promptData && (
        <div className="modal-overlay" onClick={handleSkipBatchAssign}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>发现相似交易</h3>
            </div>
            <div className="modal-body">
              <p>
                检测到 <strong>{promptData.similarCount}</strong> 笔与{' '}
                <strong>{promptData.memberName}</strong> 分配的相似交易：
              </p>
              <div className="similar-list">
                {promptData.similarTransactions.slice(0, 5).map((t) => (
                  <div key={t.id} className="similar-item">
                    <span className="similar-merchant">
                      {t.counterparty || t.description || '无商户'}
                    </span>
                    <span className="similar-amount">{formatCurrency(t.amount)}</span>
                    <span className="similar-date">{formatDate(t.date)}</span>
                  </div>
                ))}
                {promptData.similarTransactions.length > 5 && (
                  <div className="similar-more">
                    ...还有 {promptData.similarTransactions.length - 5} 笔
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleBatchAssign}>
                批量分配
              </button>
              <button className="btn btn-secondary" onClick={handleSkipBatchAssign}>
                跳过
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}