import { useEffect, useState } from 'react';
import { CATEGORIES } from '../../shared/constants';

interface RecurringTransaction {
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
}

interface Member {
  id: string;
  name: string;
  color: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default function Recurring() {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    type: 'expense' as 'expense' | 'income',
    category: '其他',
    counterparty: '',
    memberId: '',
    accountId: '',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    dayOfMonth: new Date().getDate(),
    dayOfWeek: new Date().getDay(),
    isActive: true,
  });

  useEffect(() => {
    loadData();
    loadMembers();
    loadAccounts();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getRecurringTransactions();
      setRecurring(data);
    } catch (error) {
      console.error('Failed to load recurring transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await window.electronAPI.getMembers();
      setMembers(data);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      const data = await window.electronAPI.getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      amount: '',
      type: 'expense',
      category: '其他',
      counterparty: '',
      memberId: '',
      accountId: '',
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      dayOfMonth: new Date().getDate(),
      dayOfWeek: new Date().getDay(),
      isActive: true,
    });
    setEditingId(null);
  };

  const handleEdit = (item: RecurringTransaction) => {
    setFormData({
      name: item.name,
      amount: item.amount.toString(),
      type: item.type,
      category: item.category,
      counterparty: item.counterparty || '',
      memberId: item.member_id || '',
      accountId: item.account_id || '',
      frequency: item.frequency,
      startDate: item.start_date,
      endDate: item.end_date || '',
      dayOfMonth: item.day_of_month || new Date().getDate(),
      dayOfWeek: item.day_of_week || new Date().getDay(),
      isActive: item.is_active,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const amountNum = parseFloat(formData.amount);
    if (!formData.name || isNaN(amountNum) || amountNum <= 0) {
      alert('请输入名称和有效金额');
      return;
    }

    const data = {
      id: editingId || `rec-${Date.now()}`,
      name: formData.name,
      amount: amountNum,
      type: formData.type,
      category: formData.category,
      counterparty: formData.counterparty || formData.name,
      memberId: formData.memberId || null,
      accountId: formData.accountId || null,
      frequency: formData.frequency,
      startDate: formData.startDate,
      endDate: formData.endDate || null,
      dayOfMonth: formData.frequency === 'monthly' ? formData.dayOfMonth : null,
      dayOfWeek: formData.frequency === 'weekly' ? formData.dayOfWeek : null,
      isActive: formData.isActive,
    };

    try {
      if (editingId) {
        await window.electronAPI.updateRecurringTransaction(data);
      } else {
        await window.electronAPI.addRecurringTransaction(data);
      }
      await loadData();
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('Failed to save recurring transaction:', error);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个周期交易吗？')) {
      try {
        await window.electronAPI.deleteRecurringTransaction(id);
        await loadData();
      } catch (error) {
        console.error('Failed to delete recurring transaction:', error);
      }
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await window.electronAPI.toggleRecurringTransaction(id, !isActive);
      await loadData();
    } catch (error) {
      console.error('Failed to toggle recurring transaction:', error);
    }
  };

  const handleGenerate = async () => {
    try {
      const count = await window.electronAPI.generateRecurringTransactions();
      setGeneratedCount(count);
      setTimeout(() => setGeneratedCount(null), 3000);
      if (count > 0) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to generate recurring transactions:', error);
    }
  };

  const getFrequencyDescription = (item: RecurringTransaction) => {
    switch (item.frequency) {
      case 'daily':
        return '每天';
      case 'weekly':
        return `每周${WEEKDAY_LABELS[item.day_of_week || 0]}`;
      case 'monthly':
        return `每月${item.day_of_month || 1}日`;
      case 'yearly':
        const date = new Date(item.start_date);
        return `每年${date.getMonth() + 1}月${date.getDate()}日`;
      default:
        return '';
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="recurring-page">
      <div className="page-header">
        <h2>📅 周期记账</h2>
        <p className="page-subtitle">管理自动生成的周期性交易</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button
          className="btn-primary"
          onClick={() => { resetForm(); setShowForm(!showForm); }}
        >
          {showForm ? '取消' : '➕ 新增周期交易'}
        </button>
        <button
          className="btn-secondary"
          onClick={handleGenerate}
        >
          🔄 立即生成
        </button>
        {generatedCount !== null && (
          <span style={{ color: generatedCount > 0 ? '#10B981' : '#6B7280', fontSize: '14px' }}>
            {generatedCount > 0 ? `已生成 ${generatedCount} 条交易` : '没有需要生成的交易'}
          </span>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>{editingId ? '编辑周期交易' : '新增周期交易'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label>名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：房租、会员费"
              />
            </div>

            <div>
              <label>金额 *</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div>
              <label>类型</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'expense' | 'income' })}
              >
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
            </div>

            <div>
              <label>分类</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {Object.keys(CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label>频率</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly' })}
              >
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
                <option value="yearly">每年</option>
              </select>
            </div>

            {formData.frequency === 'weekly' && (
              <div>
                <label>星期几</label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                >
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <option key={idx} value={idx}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.frequency === 'monthly' && (
              <div>
                <label>每月几号</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) || 1 })}
                />
              </div>
            )}

            <div>
              <label>开始日期</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div>
              <label>结束日期 (可选)</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>

            <div>
              <label>商户</label>
              <input
                type="text"
                value={formData.counterparty}
                onChange={(e) => setFormData({ ...formData, counterparty: e.target.value })}
                placeholder="选填"
              />
            </div>

            {members.length > 0 && (
              <div>
                <label>成员</label>
                <select
                  value={formData.memberId}
                  onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                >
                  <option value="">不分配</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {accounts.length > 0 && (
              <div>
                <label>账户</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                >
                  <option value="">不分配</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn-primary" onClick={handleSubmit}>
              {editingId ? '保存修改' : '创建'}
            </button>
            <button className="btn-secondary" onClick={() => { resetForm(); setShowForm(false); }}>
              取消
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span>启用</span>
            </label>
          </div>
        </div>
      )}

      {recurring.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#6B7280', marginBottom: '16px' }}>暂无周期交易</p>
          <p style={{ fontSize: '13px', color: '#9CA3AF' }}>
            添加房租、会员费、工资等周期性收支，系统将自动为您生成交易记录
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>金额</th>
                <th>频率</th>
                <th>分类</th>
                <th>下次生成</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((item) => (
                <tr key={item.id} className={!item.is_active ? 'inactive' : ''}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                    {item.counterparty && item.counterparty !== item.name && (
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>{item.counterparty}</div>
                    )}
                  </td>
                  <td className={item.type === 'income' ? 'income' : 'expense'}>
                    {item.type === 'income' ? '+' : '-'}¥{item.amount.toFixed(2)}
                  </td>
                  <td>{getFrequencyDescription(item)}</td>
                  <td>{item.category}</td>
                  <td>
                    {item.last_generated_date ? (
                      <span style={{ fontSize: '12px', color: '#6B7280' }}>
                        上次: {item.last_generated_date}
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#10B981' }}>
                        等待首次生成
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggle(item.id, item.is_active)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        background: item.is_active ? '#10B981' : '#9CA3AF',
                        color: 'white'
                      }}
                    >
                      {item.is_active ? '已启用' : '已停用'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => handleEdit(item)}
                      >
                        编辑
                      </button>
                      <button
                        className="btn-danger"
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => handleDelete(item.id)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
