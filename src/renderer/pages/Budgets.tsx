import { useEffect, useMemo, useState } from 'react';
import { Budget, BudgetAlert } from '../../shared/types';

const CATEGORIES = ['餐饮', '购物', '交通', '住宿', '娱乐', '教育', '医疗', '通讯', '住房', '投资', '其他'];

interface BudgetWithUsage extends Budget {
  spent?: number;
  remaining?: number;
  percentage?: number;
  status?: 'safe' | 'warning' | 'danger';
  dailyAverage?: number;
  projectedTotal?: number;
  daysRemaining?: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function getDaysRemaining(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return 0; // Past month
  }
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    return getDaysInMonth(yearMonth); // Future month
  }

  // Current month
  const lastDay = getDaysInMonth(yearMonth);
  const currentDay = now.getDate();
  return lastDay - currentDay + 1;
}

export default function Budgets() {
  const [budgets, setBudgets] = useState<BudgetWithUsage[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [, setMonthlySpending] = useState<Record<string, number>>({});

  useEffect(() => {
    loadBudgets();
    loadAlerts();
    loadMonthlySpending();
  }, []);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getBudgets();
      setBudgets(data.map(b => ({ ...b, spent: 0, remaining: b.amount, percentage: 0 })));
    } catch (error) {
      console.error('Failed to load budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const data = await window.electronAPI.getBudgetAlerts(yearMonth);
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load budget alerts:', error);
    }
  };

  const loadMonthlySpending = async () => {
    try {
      const [year, _month] = yearMonth.split('-').map(Number);
      const summary = await window.electronAPI.getSummary({ year, months: 1 });
      const spending: Record<string, number> = {};
      summary.byCategory.forEach((item: { category: string; total: number }) => {
        spending[item.category] = item.total;
      });
      setMonthlySpending(spending);
    } catch (error) {
      console.error('Failed to load monthly spending:', error);
    }
  };

  // Calculate budget usage with alerts
  const budgetsWithUsage = useMemo(() => {
    const alertMap = new Map(alerts.map(a => [a.budget.id, a]));
    return budgets.map(budget => {
      const alert = alertMap.get(budget.id);
      const spent = alert?.spent || 0;
      const remaining = budget.amount - spent;
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      // Determine status
      let status: 'safe' | 'warning' | 'danger' = 'safe';
      if (percentage >= 100) status = 'danger';
      else if (percentage >= 80) status = 'warning';

      // Calculate projection for current month
      const daysInMonth = getDaysInMonth(budget.year_month);
      const daysRemaining = getDaysRemaining(budget.year_month);
      const daysElapsed = daysInMonth - daysRemaining;
      const dailyAverage = daysElapsed > 0 ? spent / daysElapsed : 0;
      const projectedTotal = dailyAverage * daysInMonth;

      return {
        ...budget,
        spent,
        remaining,
        percentage,
        status,
        dailyAverage,
        projectedTotal,
        daysRemaining,
      };
    });
  }, [budgets, alerts]);

  const filteredBudgets = budgetsWithUsage.filter(b => b.year_month === yearMonth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      setMessage('请输入有效的预算金额');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const id = generateId();
      const categoryValue = category || null;
      await window.electronAPI.setBudget(id, yearMonth, parseFloat(amount), categoryValue);

      // Reload budgets and alerts
      const [budgetsData, alertsData] = await Promise.all([
        window.electronAPI.getBudgets(),
        window.electronAPI.getBudgetAlerts(yearMonth),
      ]);
      setBudgets(budgetsData);
      setAlerts(alertsData);

      // Reset form
      setAmount('');
      setCategory('');
      setMessage('预算设置成功！');
    } catch (error) {
      setMessage(`设置失败: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个预算吗？')) return;

    try {
      await window.electronAPI.deleteBudget(id);
      setBudgets(budgets.filter(b => b.id !== id));
      setMessage('预算已删除');
      await loadAlerts();
    } catch (error) {
      setMessage(`删除失败: ${String(error)}`);
    }
  };

  const formatCurrency = (value: number) => `¥${value.toFixed(2)}`;

  const yearMonthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = -1; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    return options;
  }, []);

  if (loading) return <div>加载中...</div>;

  return (
    <div className="budgets">
      <div className="page-header">
        <h2>预算管理</h2>
        <p className="page-subtitle">设置预算并跟踪支出，预防超支</p>
      </div>

      <div className="budgets-layout">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📊 设置预算</h3>
            <span className="card-subtitle">为指定月份设置支出预算</span>
          </div>
          
          <form onSubmit={handleSubmit} className="budget-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="year-month">月份</label>
                <select
                  id="year-month"
                  value={yearMonth}
                  onChange={(e) => setYearMonth(e.target.value)}
                >
                  {yearMonthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="category">分类（可选）</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">全部（总体预算）</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="amount">预算金额</label>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="请输入预算金额"
                step="0.01"
                min="0"
              />
            </div>
            
            {message && (
              <div className={`message ${message.includes('失败') || message.includes('错误') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}
            
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中...' : '保存预算'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 当前预算</h3>
            <span className="card-subtitle">{yearMonthOptions.find(o => o.value === yearMonth)?.label}</span>
          </div>

          {filteredBudgets.length === 0 ? (
            <div className="empty-state">
              <p>暂无预算设置</p>
              <p className="empty-hint">请在上方设置预算</p>
            </div>
          ) : (
            <div className="budget-list">
              {filteredBudgets.map(budget => (
                <div
                  key={budget.id}
                  className={`budget-item ${budget.status}`}
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid #E5E7EB',
                    background: budget.status === 'danger' ? '#FEF2F2' : budget.status === 'warning' ? '#FFFBEB' : 'white'
                  }}
                >
                  {/* Header: Name and Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {budget.category ? (
                        <span className="category-badge">{budget.category}</span>
                      ) : (
                        <span className="category-badge overall">总体预算</span>
                      )}
                      {budget.status === 'danger' && (
                        <span style={{ color: '#DC2626', fontSize: '12px', fontWeight: 600 }}>
                          ⚠️ 已超支
                        </span>
                      )}
                      {budget.status === 'warning' && (
                        <span style={{ color: '#D97706', fontSize: '12px', fontWeight: 600 }}>
                          ⚡ 即将超支
                        </span>
                      )}
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(budget.id)}
                    >
                      删除
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                      <span>已用 {budget.percentage?.toFixed(1)}%</span>
                      <span>{formatCurrency(budget.spent || 0)} / {formatCurrency(budget.amount)}</span>
                    </div>
                    <div style={{
                      height: '8px',
                      background: '#E5E7EB',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(budget.percentage || 0, 100)}%`,
                        background: budget.status === 'danger' ? '#EF4444' : budget.status === 'warning' ? '#F59E0B' : '#10B981',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '12px',
                    fontSize: '13px'
                  }}>
                    <div>
                      <span style={{ color: '#6B7280' }}>剩余: </span>
                      <span style={{
                        color: (budget.remaining || 0) < 0 ? '#DC2626' : '#059669',
                        fontWeight: 600
                      }}>
                        {formatCurrency(budget.remaining || 0)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#6B7280' }}>日均: </span>
                      <span>{formatCurrency(budget.dailyAverage || 0)}</span>
                    </div>
                    {yearMonth === getCurrentYearMonth() && budget.daysRemaining !== undefined && budget.daysRemaining > 0 && (
                      <div>
                        <span style={{ color: '#6B7280' }}>剩余天数: </span>
                        <span>{budget.daysRemaining}天</span>
                      </div>
                    )}
                  </div>

                  {/* Prediction Warning */}
                  {budget.status !== 'danger' && budget.projectedTotal && budget.projectedTotal > budget.amount && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      background: '#FEF3C7',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#92400E'
                    }}>
                      📈 预测：按当前消费趋势，本月可能超支
                      {formatCurrency(budget.projectedTotal - budget.amount)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {budgets.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📜 历史预算</h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>月份</th>
                  <th>类型</th>
                  <th>金额</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map(budget => (
                  <tr key={budget.id}>
                    <td>{budget.year_month}</td>
                    <td>
                      {budget.category ? (
                        <span className="category-badge">{budget.category}</span>
                      ) : (
                        <span className="category-badge overall">总体预算</span>
                      )}
                    </td>
                    <td className="amount expense">{formatCurrency(budget.amount)}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(budget.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}