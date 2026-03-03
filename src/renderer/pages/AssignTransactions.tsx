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
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [memberSummary, setMemberSummary] = useState<Record<string, { total: number; count: number }>>({});
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptData, setPromptData] = useState<SimilarAssignmentResult | null>(null);

  // Fetch unassigned transactions
  const fetchUnassignedTransactions = useCallback(async () => {
    try {
      const query: TransactionQuery = {
        memberId: '', // Empty string means unassigned
      };
      const result = await window.electronAPI.getTransactions(query);
      setUnassignedTransactions(result.items);
    } catch (error) {
      console.error('Failed to fetch unassigned transactions:', error);
    }
  }, []);

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

      // Refresh data
      await handleRefresh();
    } catch (error) {
      console.error('Failed to assign transaction:', error);
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

      {/* Unassigned Transactions List */}
      <div className="assign-content">
        <div className="unassigned-list">
          {unassignedTransactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <p>所有交易已分配完毕！</p>
            </div>
          ) : (
            <div className="transaction-cards">
              {unassignedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={`transaction-card ${draggingId === transaction.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, transaction)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="transaction-card-header">
                    <span className="transaction-amount">{formatCurrency(transaction.amount)}</span>
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
          )}
        </div>

        {/* Member Boxes */}
        <div className="member-boxes">
          {members.map((member) => (
            <div
              key={member.id}
              className={`member-box ${draggingId ? 'droppable' : ''}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, member.id)}
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