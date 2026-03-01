import { useEffect, useMemo, useState } from 'react';
import { Budget } from '../../shared/types';

const CATEGORIES = ['餐饮', '购物', '交通', '住宿', '娱乐', '教育', '医疗', '通讯', '住房', '投资', '其他'];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadBudgets = async () => {
      try {
        const data = await window.electronAPI.getBudgets();
        setBudgets(data);
      } catch (error) {
        console.error('Failed to load budgets:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadBudgets();
  }, []);

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
      
      // Reload budgets
      const data = await window.electronAPI.getBudgets();
      setBudgets(data);
      
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

  const filteredBudgets = budgets.filter(b => b.year_month === yearMonth);

  if (loading) return <div>加载中...</div>;

  return (
    <div className="budgets">
      <div className="page-header">
        <h2>预算设置</h2>
        <p className="page-subtitle">设置每月预算并跟踪支出</p>
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
            <table className="table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>金额</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredBudgets.map(budget => (
                  <tr key={budget.id}>
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