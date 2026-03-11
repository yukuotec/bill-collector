import { useEffect, useState } from 'react';
import { CATEGORIES } from '../../shared/constants';

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category?: string;
  color?: string;
  isActive: boolean;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

interface SavingsSummary {
  totalTarget: number;
  totalCurrent: number;
  totalRemaining: number;
  completedGoals: number;
  totalGoals: number;
}

const GOAL_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export default function SavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [summary, setSummary] = useState<SavingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [addAmount, setAddAmount] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    targetAmount: '',
    deadline: '',
    category: '',
    color: GOAL_COLORS[0],
    priority: 'medium' as 'low' | 'medium' | 'high',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [goalsData, summaryData] = await Promise.all([
        window.electronAPI.getSavingsGoals(),
        window.electronAPI.getSavingsSummary(),
      ]);
      setGoals(goalsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Failed to load savings goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async () => {
    const target = parseFloat(formData.targetAmount);
    if (!formData.name || !target || target <= 0) {
      alert('请输入目标名称和金额');
      return;
    }

    try {
      await window.electronAPI.addSavingsGoal({
        id: `goal-${Date.now()}`,
        name: formData.name,
        targetAmount: target,
        currentAmount: 0,
        deadline: formData.deadline || null,
        category: formData.category,
        color: formData.color,
        priority: formData.priority,
        isActive: true,
      });
      await loadData();
      setShowForm(false);
      setFormData({ name: '', targetAmount: '', deadline: '', category: '', color: GOAL_COLORS[0], priority: 'medium' });
    } catch (error) {
      console.error('Failed to add goal:', error);
    }
  };

  const handleAddMoney = async (goalId: string) => {
    const amount = parseFloat(addAmount[goalId] || '0');
    if (!amount || amount <= 0) {
      alert('请输入有效金额');
      return;
    }

    try {
      await window.electronAPI.addToSavingsGoal(goalId, amount);
      setAddAmount({ ...addAmount, [goalId]: '' });
      await loadData();
    } catch (error) {
      console.error('Failed to add money:', error);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('确定要删除这个目标吗？')) return;
    try {
      await window.electronAPI.deleteSavingsGoal(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  const formatCurrency = (value: number) => `¥${value.toFixed(2)}`;

  const getProgress = (current: number, target: number) => {
    if (target <= 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const getDaysRemaining = (deadline?: string) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="savings-goals">
      <div className="page-header">
        <h2>🎯 目标储蓄</h2>
        <p className="page-subtitle">设立储蓄目标，追踪存钱进度</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="summary-cards" style={{ marginBottom: '24px' }}>
          <div className="summary-card">
            <span className="summary-icon">🎯</span>
            <p>储蓄目标</p>
            <h3>{summary.totalGoals}个</h3>
          </div>
          <div className="summary-card">
            <span className="summary-icon">💰</span>
            <p>已存金额</p>
            <h3>{formatCurrency(summary.totalCurrent)}</h3>
          </div>
          <div className="summary-card">
            <span className="summary-icon">📊</span>
            <p>目标金额</p>
            <h3>{formatCurrency(summary.totalTarget)}</h3>
          </div>
          <div className="summary-card income">
            <span className="summary-icon">✅</span>
            <p>已完成</p>
            <h3 className="income">{summary.completedGoals}个</h3>
          </div>
        </div>
      )}

      {/* Add Button */}
      <div style={{ marginBottom: '24px' }}>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          ➕ 新建储蓄目标
        </button>
      </div>

      {/* Add Goal Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>新建储蓄目标</h3>
            <div className="form-group">
              <label>目标名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：买房首付、旅游基金"
              />
            </div>
            <div className="form-group">
              <label>目标金额 *</label>
              <input
                type="number"
                step="0.01"
                value={formData.targetAmount}
                onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>目标日期</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>分类</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="">无</option>
                {Object.keys(CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>颜色</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {GOAL_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: color,
                      border: formData.color === color ? '3px solid #000' : 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn-primary" onClick={handleAddGoal}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* Goals List */}
      <div className="goals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {goals.length === 0 ? (
          <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#6B7280' }}>暂无储蓄目标</p>
            <p style={{ fontSize: '13px', color: '#9CA3AF' }}>点击上方按钮创建你的第一个储蓄目标</p>
          </div>
        ) : (
          goals.map((goal) => {
            const progress = getProgress(goal.currentAmount, goal.targetAmount);
            const isCompleted = goal.currentAmount >= goal.targetAmount;
            const daysRemaining = getDaysRemaining(goal.deadline);

            return (
              <div key={goal.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Color Bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: goal.color || '#3B82F6'
                }} />

                <div style={{ padding: '20px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0' }}>{goal.name}</h3>
                      {goal.category && (
                        <span style={{ fontSize: '12px', color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: '4px' }}>
                          {goal.category}
                        </span>
                      )}
                    </div>
                    {isCompleted && (
                      <span style={{ fontSize: '20px' }}>✅</span>
                    )}
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Progress */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#6B7280' }}>进度</span>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{progress.toFixed(1)}%</span>
                    </div>
                    <div style={{
                      height: '8px',
                      background: '#E5E7EB',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: isCompleted ? '#10B981' : (goal.color || '#3B82F6'),
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* Amounts */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>已存</div>
                      <div style={{ fontSize: '18px', fontWeight: 600, color: '#10B981' }}>
                        {formatCurrency(goal.currentAmount)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>目标</div>
                      <div style={{ fontSize: '18px', fontWeight: 600 }}>
                        {formatCurrency(goal.targetAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Remaining Info */}
                  {goal.deadline && (
                    <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
                      {daysRemaining !== null && daysRemaining > 0 ? (
                        <>⏰ 还剩 {daysRemaining} 天</>
                      ) : daysRemaining === 0 ? (
                        <>⚠️ 今天截止</>
                      ) : (
                        <>📅 已过期</>
                      )}
                    </div>
                  )}

                  {/* Add Money */}
                  {!isCompleted && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="存入金额"
                        value={addAmount[goal.id] || ''}
                        onChange={(e) => setAddAmount({ ...addAmount, [goal.id]: e.target.value })}
                        style={{ flex: 1, padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      />
                      <button
                        className="btn-primary"
                        onClick={() => handleAddMoney(goal.id)}
                        style={{ padding: '8px 16px' }}
                      >
                        存入
                      </button>
                    </div>
                  )}

                  {isCompleted && (
                    <div style={{
                      padding: '8px 12px',
                      background: '#D1FAE5',
                      borderRadius: '6px',
                      textAlign: 'center',
                      color: '#059669',
                      fontWeight: 600
                    }}>
                      🎉 恭喜！目标已达成
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
