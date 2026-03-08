import { useEffect, useState } from 'react';
import { Account, AccountType } from '../../shared/types';

interface AccountsProps {
  locationSearch: string;
}

const ACCOUNT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#EF4444', // red
  '#8B5CF6', // purple
  '#F59E0B', // orange
  '#EC4899', // pink
  '#14B8A6', // teal
  '#6366F1', // indigo
];

const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'bank', label: '银行卡', icon: '🏦' },
  { value: 'credit', label: '信用卡', icon: '💳' },
  { value: 'cash', label: '现金', icon: '💵' },
  { value: 'alipay', label: '支付宝', icon: '💙' },
  { value: 'wechat', label: '微信支付', icon: '💚' },
  { value: 'other', label: '其他', icon: '📦' },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function Accounts({ locationSearch }: AccountsProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('bank');
  const [newBalance, setNewBalance] = useState('');
  const [newColor, setNewColor] = useState(ACCOUNT_COLORS[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState<string | null>(null);

  const loadAccounts = async () => {
    try {
      const data = await window.electronAPI.getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleAddAccount = async () => {
    if (!newName.trim()) return;

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const balance = parseFloat(newBalance) || 0;
    await window.electronAPI.addAccount(id, newName.trim(), newType, balance, newColor);

    setNewName('');
    setNewType('bank');
    setNewBalance('');
    setNewColor(ACCOUNT_COLORS[0]);
    setShowAddForm(false);
    await loadAccounts();
  };

  const handleUpdateAccount = async () => {
    if (!editingAccount || !newName.trim()) return;

    const balance = parseFloat(newBalance) || 0;
    await window.electronAPI.updateAccount(editingAccount.id, newName.trim(), newType, balance, newColor);

    setEditingAccount(null);
    setNewName('');
    setNewType('bank');
    setNewBalance('');
    setNewColor(ACCOUNT_COLORS[0]);
    await loadAccounts();
  };

  const handleDeleteAccount = async (id: string) => {
    await window.electronAPI.deleteAccount(id);
    setDeleteConfirm(null);
    await loadAccounts();
  };

  const handleUpdateBalance = async (id: string, balanceStr: string) => {
    const balance = parseFloat(balanceStr) || 0;
    await window.electronAPI.updateAccountBalance(id, balance);
    setEditingBalance(null);
    await loadAccounts();
  };

  const startEdit = (account: Account) => {
    setEditingAccount(account);
    setNewName(account.name);
    setNewType(account.type);
    setNewBalance(String(account.balance || 0));
    setNewColor(account.color);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingAccount(null);
    setNewName('');
    setNewType('bank');
    setNewBalance('');
    setNewColor(ACCOUNT_COLORS[0]);
    setShowAddForm(false);
  };

  const getAccountTypeLabel = (type: AccountType) => {
    return ACCOUNT_TYPES.find(t => t.value === type)?.label || type;
  };

  const getAccountTypeIcon = (type: AccountType) => {
    return ACCOUNT_TYPES.find(t => t.value === type)?.icon || '📦';
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div className="accounts-page">
      <div className="page-header">
        <h2>账户管理</h2>
        <p className="page-subtitle">管理您的账户，追踪各账户的支出情况</p>
      </div>

      <div className="accounts-toolbar">
        <button className="btn-primary" onClick={() => { setShowAddForm(true); cancelEdit(); }}>
          + 添加账户
        </button>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingAccount) && (
        <div className="account-form card">
          <h3>{editingAccount ? '编辑账户' : '添加账户'}</h3>
          <div className="form-row">
            <label>账户名称</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如：招商银行"
              autoFocus
            />
          </div>
          <div className="form-row">
            <label>账户类型</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as AccountType)}
            >
              {ACCOUNT_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>当前余额</label>
            <input
              type="number"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="0.00"
              step="0.01"
            />
          </div>
          <div className="form-row">
            <label>颜色标识</label>
            <div className="color-picker">
              {ACCOUNT_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${newColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewColor(color)}
                />
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={cancelEdit}>
              取消
            </button>
            <button
              className="btn-primary"
              onClick={editingAccount ? handleUpdateAccount : handleAddAccount}
              disabled={!newName.trim()}
            >
              {editingAccount ? '保存' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* Accounts List */}
      <div className="accounts-list">
        {accounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💳</div>
            <p>还没有账户</p>
            <p className="empty-subtitle">添加您的第一个账户来开始追踪支出</p>
          </div>
        ) : (
          accounts.map(account => (
            <div key={account.id} className="account-card card">
              <div className="account-header">
                <div
                  className="account-color-indicator"
                  style={{ backgroundColor: account.color }}
                />
                <div className="account-info">
                  <div className="account-name-row">
                    <span className="account-icon">{getAccountTypeIcon(account.type)}</span>
                    <span className="account-name">{account.name}</span>
                    <span className="account-type-badge">{getAccountTypeLabel(account.type)}</span>
                  </div>
                </div>
                <div className="account-actions">
                  <button
                    className="btn-icon"
                    onClick={() => startEdit(account)}
                    title="编辑"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => setDeleteConfirm(account.id)}
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="account-balance-section">
                <div className="balance-label">当前余额</div>
                {editingBalance === account.id ? (
                  <div className="balance-edit">
                    <input
                      type="number"
                      defaultValue={account.balance || 0}
                      autoFocus
                      onBlur={(e) => handleUpdateBalance(account.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateBalance(account.id, (e.target as HTMLInputElement).value);
                        }
                        if (e.key === 'Escape') {
                          setEditingBalance(null);
                        }
                      }}
                      step="0.01"
                    />
                  </div>
                ) : (
                  <div
                    className="account-balance"
                    onClick={() => setEditingBalance(account.id)}
                    title="点击编辑余额"
                  >
                    {formatCurrency(account.balance || 0)}
                  </div>
                )}
              </div>

              {/* Delete Confirmation */}
              {deleteConfirm === account.id && (
                <div className="delete-confirm">
                  <p>确定要删除账户 "{account.name}" 吗？</p>
                  <p className="delete-warning">关联的交易记录将变为未分配状态</p>
                  <div className="confirm-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      取消
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleDeleteAccount(account.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
