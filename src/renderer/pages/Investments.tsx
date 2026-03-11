import { useEffect, useState } from 'react';

interface InvestmentAccount {
  id: string;
  name: string;
  type: 'stock' | 'fund' | 'bond' | 'crypto';
  symbol?: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  currency?: string;
  broker?: string;
  notes?: string;
  totalValue: number;
  totalCost: number;
  gain: number;
  gainPercentage: number;
  created_at: string;
  updated_at: string;
}

interface InvestmentTransaction {
  id: string;
  account_id: string;
  type: 'buy' | 'sell' | 'dividend';
  shares: number;
  price: number;
  amount: number;
  fee?: number;
  date: string;
  notes?: string;
  created_at: string;
}

interface InvestmentSummary {
  totalCost: number;
  totalValue: number;
  totalGain: number;
  gainPercentage: number;
}

const TYPE_ICONS: Record<string, string> = {
  stock: '📈',
  fund: '📊',
  bond: '📋',
  crypto: '₿',
};

export default function Investments() {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  // Form states
  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'stock' as 'stock' | 'fund' | 'bond' | 'crypto',
    symbol: '',
    currency: 'CNY',
    broker: '',
    notes: '',
  });

  const [transactionForm, setTransactionForm] = useState({
    accountId: '',
    type: 'buy' as 'buy' | 'sell' | 'dividend',
    shares: '',
    price: '',
    fee: '0',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsData, summaryData] = await Promise.all([
        window.electronAPI.getInvestmentAccounts(),
        window.electronAPI.getInvestmentSummary(),
      ]);
      setAccounts(accountsData);
      setSummary(summaryData);

      if (accountsData.length > 0) {
        const txns = await window.electronAPI.getInvestmentTransactions();
        setTransactions(txns);
      }
    } catch (error) {
      console.error('Failed to load investment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!accountForm.name) {
      alert('请输入账户名称');
      return;
    }

    try {
      await window.electronAPI.addInvestmentAccount({
        id: `inv-${Date.now()}`,
        ...accountForm,
      });
      await loadData();
      setShowAccountForm(false);
      setAccountForm({ name: '', type: 'stock', symbol: '', currency: 'CNY', broker: '', notes: '' });
    } catch (error) {
      console.error('Failed to add account:', error);
    }
  };

  const handleAddTransaction = async () => {
    const shares = parseFloat(transactionForm.shares);
    const price = parseFloat(transactionForm.price);
    const fee = parseFloat(transactionForm.fee) || 0;

    if (!shares || !price || !transactionForm.accountId) {
      alert('请填写完整信息');
      return;
    }

    try {
      await window.electronAPI.addInvestmentTransaction({
        id: `inv-txn-${Date.now()}`,
        ...transactionForm,
        shares,
        price,
        fee,
      });
      await loadData();
      setShowTransactionForm(false);
      setTransactionForm({
        accountId: '',
        type: 'buy',
        shares: '',
        price: '',
        fee: '0',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('确定要删除这个投资账户吗？相关的交易记录也将被删除。')) return;

    try {
      await window.electronAPI.deleteInvestmentAccount(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleUpdatePrice = async (id: string, newPrice: string) => {
    const price = parseFloat(newPrice);
    if (!price || price <= 0) return;

    try {
      await window.electronAPI.updateInvestmentPrice(id, price);
      await loadData();
    } catch (error) {
      console.error('Failed to update price:', error);
    }
  };

  const formatCurrency = (value: number) => `¥${value.toFixed(2)}`;

  if (loading) return <div>加载中...</div>;

  return (
    <div className="investments">
      <div className="page-header">
        <h2>📈 投资追踪</h2>
        <p className="page-subtitle">管理股票、基金、加密货币等投资账户</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="summary-cards" style={{ marginBottom: '24px' }}>
          <div className="summary-card">
            <span className="summary-icon">💰</span>
            <p>总成本</p>
            <h3>{formatCurrency(summary.totalCost)}</h3>
          </div>
          <div className="summary-card">
            <span className="summary-icon">📊</span>
            <p>总市值</p>
            <h3>{formatCurrency(summary.totalValue)}</h3>
          </div>
          <div className={`summary-card ${summary.totalGain >= 0 ? 'income' : 'expense'}`}>
            <span className="summary-icon">{summary.totalGain >= 0 ? '📈' : '📉'}</span>
            <p>总盈亏</p>
            <h3 className={summary.totalGain >= 0 ? 'income' : 'expense'}>
              {summary.totalGain >= 0 ? '+' : ''}{formatCurrency(summary.totalGain)}
              ({summary.gainPercentage >= 0 ? '+' : ''}{summary.gainPercentage.toFixed(2)}%)
            </h3>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button className="btn-primary" onClick={() => setShowAccountForm(true)}>
          ➕ 添加投资账户
        </button>
        {accounts.length > 0 && (
          <button className="btn-secondary" onClick={() => setShowTransactionForm(true)}>
            💱 记录交易
          </button>
        )}
      </div>

      {/* Account Form Modal */}
      {showAccountForm && (
        <div className="modal-overlay" onClick={() => setShowAccountForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>添加投资账户</h3>
            <div className="form-group">
              <label>账户名称 *</label>
              <input
                type="text"
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                placeholder="例如：招商银行股票账户"
              />
            </div>
            <div className="form-group">
              <label>投资类型</label>
              <select
                value={accountForm.type}
                onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value as any })}
              >
                <option value="stock">股票</option>
                <option value="fund">基金</option>
                <option value="bond">债券</option>
                <option value="crypto">加密货币</option>
              </select>
            </div>
            <div className="form-group">
              <label>代码/ symbol</label>
              <input
                type="text"
                value={accountForm.symbol}
                onChange={(e) => setAccountForm({ ...accountForm, symbol: e.target.value })}
                placeholder="例如：000001.SZ"
              />
            </div>
            <div className="form-group">
              <label>券商/平台</label>
              <input
                type="text"
                value={accountForm.broker}
                onChange={(e) => setAccountForm({ ...accountForm, broker: e.target.value })}
                placeholder="例如：招商证券"
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAccountForm(false)}>取消</button>
              <button className="btn-primary" onClick={handleAddAccount}>添加</button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <div className="modal-overlay" onClick={() => setShowTransactionForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>记录投资交易</h3>
            <div className="form-group">
              <label>投资账户 *</label>
              <select
                value={transactionForm.accountId}
                onChange={(e) => setTransactionForm({ ...transactionForm, accountId: e.target.value })}
              >
                <option value="">请选择</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {TYPE_ICONS[acc.type]} {acc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>交易类型</label>
              <select
                value={transactionForm.type}
                onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value as any })}
              >
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
                <option value="dividend">分红</option>
              </select>
            </div>
            <div className="form-group">
              <label>数量/份额 *</label>
              <input
                type="number"
                step="0.0001"
                value={transactionForm.shares}
                onChange={(e) => setTransactionForm({ ...transactionForm, shares: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>价格 *</label>
              <input
                type="number"
                step="0.0001"
                value={transactionForm.price}
                onChange={(e) => setTransactionForm({ ...transactionForm, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>手续费</label>
              <input
                type="number"
                step="0.01"
                value={transactionForm.fee}
                onChange={(e) => setTransactionForm({ ...transactionForm, fee: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>交易日期</label>
              <input
                type="date"
                value={transactionForm.date}
                onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowTransactionForm(false)}>取消</button>
              <button className="btn-primary" onClick={handleAddTransaction}>记录</button>
            </div>
          </div>
        </div>
      )}

      {/* Investment Accounts List */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">投资账户</h3>
        </div>

        {accounts.length === 0 ? (
          <div className="empty-state">
            <p>暂无投资账户</p>
            <p className="empty-hint">点击上方按钮添加股票、基金或加密货币账户</p>
          </div>
        ) : (
          <div className="investment-list">
            {accounts.map((account) => {
              const currentValue = account.shares * account.currentPrice;
              const costValue = account.shares * account.costBasis;
              const gain = currentValue - costValue;
              const gainPercent = account.costBasis > 0 ? (gain / costValue) * 100 : 0;

              return (
                <div key={account.id} className="investment-item" style={{
                  padding: '16px',
                  borderBottom: '1px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span>{TYPE_ICONS[account.type]}</span>
                      <strong>{account.name}</strong>
                      <span style={{ fontSize: '12px', color: '#6B7280' }}>({account.symbol})</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#6B7280' }}>
                      持仓: {account.shares.toFixed(4)} 股 | 成本: {formatCurrency(account.costBasis)} |
                      市值: {formatCurrency(currentValue)}
                    </div>
                    {account.shares > 0 && (
                      <div style={{
                        fontSize: '13px',
                        color: gain >= 0 ? '#10B981' : '#EF4444',
                        marginTop: '4px'
                      }}>
                        盈亏: {gain >= 0 ? '+' : ''}{formatCurrency(gain)} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="现价"
                      defaultValue={account.currentPrice || ''}
                      onBlur={(e) => handleUpdatePrice(account.id, e.target.value)}
                      style={{ width: '80px', padding: '4px 8px', fontSize: '13px' }}
                    />
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => handleDeleteAccount(account.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">最近交易</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>日期</th>
                <th>账户</th>
                <th>类型</th>
                <th>数量</th>
                <th>价格</th>
                <th>金额</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((txn) => {
                const account = accounts.find(a => a.id === txn.account_id);
                return (
                  <tr key={txn.id}>
                    <td>{txn.date}</td>
                    <td>{account?.name || '-'}</td>
                    <td>{txn.type === 'buy' ? '买入' : txn.type === 'sell' ? '卖出' : '分红'}</td>
                    <td>{txn.shares}</td>
                    <td>{formatCurrency(txn.price)}</td>
                    <td>{formatCurrency(txn.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
