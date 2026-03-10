import { useEffect, useMemo, useState } from 'react';
import { BudgetAlert, Summary } from '../../shared/types';
import { DrilldownQuery, getYearDateRange } from '../../shared/drilldown';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { SOURCES, SourceId } from '../../shared/sources';

// Transaction Template interface (synced with QuickAdd)
interface TransactionTemplate {
  id: string;
  name: string;
  amount: number;
  category: string;
  counterparty: string;
  type: 'expense' | 'income';
  memberId: string;
  createdAt: string;
}

interface CategorySummary {
  category: string;
  total: number;
  percentage: number;
}

interface MonthlyTrendData {
  month: string;
  expense: number;
  income: number;
  expenseChange: number | null;
  incomeChange: number | null;
}

interface SourceCoverageWidgetItem {
  source: string;
  month: string;
  count: number;
}

interface LastImportItem {
  source: string;
  lastDate: string | null;
}

interface CategorySummary {
  category: string;
  total: number;
  percentage: number;
}

interface MonthlyTrendData {
  month: string;
  expense: number;
  income: number;
  expenseChange: number | null;
  incomeChange: number | null;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

const CATEGORY_ICONS: Record<string, string> = {
  '餐饮': '🍽️',
  '购物': '🛍️',
  '交通': '🚗',
  '住宿': '🏨',
  '娱乐': '🎮',
  '教育': '📚',
  '医疗': '💊',
  '通讯': '📱',
  '住房': '🏠',
  '投资': '💰',
  '工资': '💵',
  '奖金': '🎁',
  '转账': '🔄',
  '其他': '📦',
};

interface DashboardProps {
  onDrilldown: (query: DrilldownQuery) => void;
}

// Quick Actions Widget Component
interface QuickActionsWidgetProps {
  onDrilldown: (query: DrilldownQuery) => void;
}

function QuickActionsWidget({ onDrilldown }: QuickActionsWidgetProps) {
  const [frequentTransactions, setFrequentTransactions] = useState<Array<{
    counterparty: string;
    category: string;
    type: 'expense' | 'income';
    count: number;
  }>>([]);
  const [quickTemplates, setQuickTemplates] = useState<TransactionTemplate[]>([]);

  useEffect(() => {
    // Load frequent transactions from recent history
    const loadFrequent = async () => {
      try {
        const result = await window.electronAPI.getTransactions({
          page: 1,
          pageSize: 100,
          sortBy: 'date',
          sortOrder: 'desc',
        });

        // Count occurrences and get most frequent
        const counts: Record<string, { counterparty: string; category: string; type: 'expense' | 'income'; count: number }> = {};
        result.items.forEach((txn) => {
          if (txn.counterparty) {
            const key = `${txn.counterparty}-${txn.category}`;
            if (!counts[key]) {
              counts[key] = {
                counterparty: txn.counterparty,
                category: txn.category || '其他',
                type: txn.type as 'expense' | 'income',
                count: 0,
              };
            }
            counts[key].count++;
          }
        });

        const sorted = Object.values(counts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);
        setFrequentTransactions(sorted);
      } catch (error) {
        console.error('Failed to load frequent transactions:', error);
      }
    };

    // Load templates from localStorage
    const savedTemplates = localStorage.getItem('expense-templates');
    if (savedTemplates) {
      try {
        const parsed = JSON.parse(savedTemplates);
        setQuickTemplates(parsed.slice(0, 4));
      } catch (e) {
        console.error('Failed to load templates:', e);
      }
    }

    loadFrequent();
  }, []);

  const handleQuickAdd = () => {
    window.location.hash = '#quick-add';
  };

  const handleViewTransactions = (filter: { category?: string; counterparty?: string }) => {
    const query: DrilldownQuery = { drill: 'transactions' };
    if (filter.category) query.category = filter.category;
    if (filter.counterparty) query.merchant = filter.counterparty;
    onDrilldown(query);
  };

  const handleImport = () => {
    window.location.hash = '#import';
  };

  return (
    <div className="quick-actions-widget" style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>⚡ 快捷操作</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleQuickAdd}
            style={{
              padding: '6px 12px',
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ➕ 快速记账
          </button>
          <button
            onClick={handleImport}
            style={{
              padding: '6px 12px',
              background: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            📥 导入账单
          </button>
        </div>
      </div>

      {/* Quick Templates */}
      {quickTemplates.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px', fontWeight: 500 }}>
            📋 快速模板
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {quickTemplates.map(template => (
              <button
                key={template.id}
                onClick={handleQuickAdd}
                style={{
                  padding: '6px 12px',
                  background: '#F3F4F6',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{template.type === 'expense' ? '💸' : '💰'}</span>
                <span>{template.name}</span>
                <span style={{ color: '#6B7280', fontWeight: 600 }}>¥{template.amount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Frequent Transactions */}
      {frequentTransactions.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px', fontWeight: 500 }}>
            🏪 常用商户
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {frequentTransactions.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleViewTransactions({ counterparty: item.counterparty, category: item.category })}
                style={{
                  padding: '6px 12px',
                  background: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{CATEGORY_ICONS[item.category] || '📦'}</span>
                <span>{item.counterparty}</span>
                <span style={{ color: '#92400E', fontSize: '11px' }}>({item.count}次)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Filters */}
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px', fontWeight: 500 }}>
          🔍 快速筛选
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onDrilldown({ drill: 'transactions', from: new Date().toISOString().slice(0, 7) + '-01' })}
            style={{
              padding: '4px 10px',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#1E40AF'
            }}
          >
            📅 本月交易
          </button>
          <button
            onClick={() => onDrilldown({ drill: 'transactions', category: '餐饮' })}
            style={{
              padding: '4px 10px',
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#166534'
            }}
          >
            🍽️ 餐饮支出
          </button>
          <button
            onClick={() => onDrilldown({ drill: 'transactions', category: '购物' })}
            style={{
              padding: '4px 10px',
              background: '#FDF2F8',
              border: '1px solid #FBCFE8',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#9D174D'
            }}
          >
            🛍️ 购物记录
          </button>
          <button
            onClick={() => window.location.hash = '#transactions?duplicates=true'}
            style={{
              padding: '4px 10px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#991B1B'
            }}
          >
            ⚠️ 重复记录
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ onDrilldown }: DashboardProps) {
  const currentYear = new Date().getFullYear();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [loading, setLoading] = useState<boolean>(true);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendData[]>([]);
  const [currentMonth, setCurrentMonth] = useState<string>('');
  const [previousMonth, setPreviousMonth] = useState<string>('');
  const [sourceCoverage, setSourceCoverage] = useState<SourceCoverageWidgetItem[]>([]);
  const [lastImports, setLastImports] = useState<LastImportItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      setLoading(true);
      try {
        const data = await window.electronAPI.getSummary({ year: selectedYear, months: 12 });
        if (!cancelled) {
          setSummary(data);
        }
      } catch (error) {
        console.error('Failed to load summary:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  useEffect(() => {
    if (!summary || summary.availableYears.length === 0) return;
    if (summary.availableYears.includes(selectedYear)) return;

    setSelectedYear(summary.availableYears[0]);
  }, [summary, selectedYear]);

  useEffect(() => {
    const loadBudgetAlerts = async () => {
      try {
        const alerts = await window.electronAPI.getBudgetAlerts();
        setBudgetAlerts(alerts);
      } catch (error) {
        console.error('Failed to load budget alerts:', error);
      }
    };

    void loadBudgetAlerts();
  }, []);

  useEffect(() => {
    const loadCategorySummary = async () => {
      try {
        const data = await window.electronAPI.getCategorySummary(selectedYear);
        setCategorySummary(data);
      } catch (error) {
        console.error('Failed to load category summary:', error);
      }
    };

    void loadCategorySummary();
  }, [selectedYear]);

  useEffect(() => {
    const loadMonthlyTrend = async () => {
      try {
        const data = await window.electronAPI.getMonthlyTrend(12);
        setMonthlyTrend(data.data);
        setCurrentMonth(data.currentMonth);
        setPreviousMonth(data.previousMonth);
      } catch (error) {
        console.error('Failed to load monthly trend:', error);
      }
    };

    void loadMonthlyTrend();

    // Load source coverage data
    const loadSourceCoverage = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const [coverageData, lastImportData] = await Promise.all([
          window.electronAPI.getSourceCoverage(currentYear),
          window.electronAPI.getLastImportBySource(),
        ]);
        setSourceCoverage(coverageData);
        setLastImports(lastImportData);
      } catch (error) {
        console.error('Failed to load source coverage:', error);
      }
    };
    void loadSourceCoverage();
  }, []);

  const formatCurrency = (value: number) => `¥${value.toFixed(2)}`;

  const pieData = useMemo(
    () =>
      (summary?.byCategory ?? []).map((item, index) => ({
        name: item.category,
        value: item.total,
        color: COLORS[index % COLORS.length],
      })),
    [summary]
  );

  const lineData = useMemo(
    () =>
      [...(summary?.monthly ?? [])].reverse().map((item) => ({
        month: item.month.slice(5),
        expense: item.expense,
        income: item.income,
      })),
    [summary]
  );

  const memberData = useMemo(
    () =>
      (summary?.byMember ?? []).map((item) => ({
        name: item.memberName,
        value: item.total,
        color: item.memberColor,
      })),
    [summary]
  );

  const accountData = useMemo(
    () =>
      (summary?.byAccount ?? []).map((item) => ({
        name: item.accountName,
        value: item.total,
        color: item.accountColor,
      })),
    [summary]
  );

  // Calculate source coverage status for widget
  const getSourceStatus = (sourceId: string): { count: number; status: 'fresh' | 'stale' | 'missing' } => {
    const lastImport = lastImports.find(li => li.source === sourceId);
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const currentMonthCount = sourceCoverage.filter(c => c.source === sourceId && c.month === currentMonthStr).length;

    if (!lastImport?.lastDate) {
      return { count: currentMonthCount, status: 'missing' };
    }

    const lastDate = new Date(lastImport.lastDate);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 7) return { count: currentMonthCount, status: 'fresh' };
    if (daysDiff <= 30) return { count: currentMonthCount, status: 'stale' };
    return { count: currentMonthCount, status: 'missing' };
  };

  const missingSourcesCount = SOURCES.filter(s => getSourceStatus(s.id).status === 'missing').length;
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const hasCurrentMonthData = sourceCoverage.some(c => c.month === currentMonthStr);

  if (loading && !summary) return <div>加载中...</div>;
  if (!summary) return <div>暂无数据</div>;

  const range = getYearDateRange(summary.year);

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>仪表盘</h2>
        <p className="page-subtitle">查看您的支出概览和统计</p>
      </div>
      
      <div className="dashboard-header">
        <div className="filter-inline">
          <label htmlFor="summary-year">📅 选择年份</label>
          <select id="summary-year" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {summary.availableYears.map((year) => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card expense">
          <span className="summary-icon">💸</span>
          <p>{summary.year} 年支出</p>
          <h3 className="expense">{formatCurrency(summary.yearlyExpense)}</h3>
        </div>
        <div className="summary-card income">
          <span className="summary-icon">💰</span>
          <p>{summary.year} 年收入</p>
          <h3 className="income">{formatCurrency(summary.yearlyIncome)}</h3>
        </div>
        <div className={`summary-card ${summary.yearlyNet >= 0 ? 'income' : 'expense'}`}>
          <span className="summary-icon">{summary.yearlyNet >= 0 ? '📈' : '📉'}</span>
          <p>{summary.year} 年净额</p>
          <h3 className={summary.yearlyNet >= 0 ? 'income' : 'expense'}>{formatCurrency(summary.yearlyNet)}</h3>
        </div>
        <div className="summary-card expense">
          <span className="summary-icon">🍽️</span>
          <p>{summary.currentMonth} 支出</p>
          <h3 className="expense">{formatCurrency(summary.currentMonthExpense)}</h3>
        </div>
        <div className="summary-card income">
          <span className="summary-icon">🎁</span>
          <p>{summary.currentMonth} 收入</p>
          <h3 className="income">{formatCurrency(summary.currentMonthIncome)}</h3>
        </div>
      </div>

      {/* Quick Actions Widget */}
      <QuickActionsWidget onDrilldown={onDrilldown} />

      {budgetAlerts.length > 0 && (
        <div className="budget-alerts">
          <h3 className="chart-title">⚠️ 预算提醒</h3>
          {budgetAlerts.map((alert) => (
            <div key={alert.budget.id} className={`budget-alert ${alert.status}`}>
              <div className="budget-alert-header">
                <span className="budget-alert-title">
                  {alert.budget.category ? `${alert.budget.category} 分类预算` : '总体预算'}
                </span>
                <span className={`budget-alert-status ${alert.status}`}>
                  {alert.status === 'exceeded' ? '⚠️ 已超支' : alert.status === 'warning' ? '⚡ 接近预算' : '✅ 正常'}
                </span>
              </div>
              <div className="budget-progress">
                <div className="budget-progress-bar">
                  <div 
                    className={`budget-progress-fill ${alert.status}`} 
                    style={{ width: `${Math.min(alert.percentage, 100)}%` }}
                  />
                </div>
                <span className="budget-progress-text">
                  {formatCurrency(alert.spent)} / {formatCurrency(alert.budget.amount)} ({alert.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="budget-alert-footer">
                <span className={alert.remaining >= 0 ? 'remaining-positive' : 'remaining-negative'}>
                  {alert.remaining >= 0 
                    ? `剩余 ${formatCurrency(alert.remaining)}` 
                    : `超支 ${formatCurrency(Math.abs(alert.remaining))}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Source Coverage Widget */}
      <div
        className={`source-coverage-widget ${missingSourcesCount > 0 ? 'has-missing' : ''}`}
        onClick={() => window.location.hash = '#source-coverage'}
        style={{ cursor: 'pointer' }}
      >
        <div className="widget-header">
          <h3 className="widget-title">📅 数据收集状态</h3>
          <span className="widget-link">查看详情 →</span>
        </div>
        <div className="widget-content">
          <div className="coverage-overview">
            {missingSourcesCount === 0 ? (
              <div className="coverage-status good">
                <span className="status-icon">✅</span>
                <span>本月数据已收集完整</span>
              </div>
            ) : (
              <div className="coverage-status warning">
                <span className="status-icon">⚠️</span>
                <span>{missingSourcesCount} 个来源需要更新</span>
              </div>
            )}
          </div>
          <div className="source-mini-list">
            {SOURCES.map((source) => {
              const { count, status } = getSourceStatus(source.id);
              return (
                <div key={source.id} className={`mini-source-item ${status}`}>
                  <span className="mini-source-name">{source.name}</span>
                  <span className={`mini-status ${status}`}>
                    {status === 'fresh' ? '✓' : status === 'stale' ? '~' : '✗'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">📈 月度趋势（最近12个月）</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="expense" stroke="#f44336" name="支出" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="income" stroke="#4caf50" name="收入" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">📊 月度支出明细（近12个月）</h3>
          <span className="chart-subtitle">与上月对比</span>
        </div>
        {monthlyTrend.length === 0 ? (
          <div className="empty-state">暂无月度数据</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={(value) => value.slice(5)} />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="expense" fill="#f44336" name="支出" />
              </BarChart>
            </ResponsiveContainer>
            <div className="monthly-trend-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>月份</th>
                    <th>支出</th>
                    <th>环比变化</th>
                    <th>收入</th>
                    <th>环比变化</th>
                  </tr>
                </thead>
                <tbody>
                  {[...monthlyTrend].reverse().map((item) => (
                    <tr key={item.month} className={item.month === currentMonth ? 'current-month' : ''}>
                      <td>
                        <span className="month-label">{item.month}</span>
                        {item.month === currentMonth && <span className="current-badge">本月</span>}
                      </td>
                      <td className="amount expense">{formatCurrency(item.expense)}</td>
                      <td>
                        {item.expenseChange !== null ? (
                          <span className={`change-indicator ${item.expenseChange >= 0 ? 'negative' : 'positive'}`}>
                            {item.expenseChange >= 0 ? '↑' : '↓'} {Math.abs(item.expenseChange).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="change-indicator neutral">-</span>
                        )}
                      </td>
                      <td className="amount income">{formatCurrency(item.income)}</td>
                      <td>
                        {item.incomeChange !== null ? (
                          <span className={`change-indicator ${item.incomeChange >= 0 ? 'positive' : 'negative'}`}>
                            {item.incomeChange >= 0 ? '↑' : '↓'} {Math.abs(item.incomeChange).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="change-indicator neutral">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">🥧 分类占比</h3>
          <span className="chart-subtitle">点击分类查看详情</span>
        </div>
        {pieData.length === 0 ? (
          <div className="empty-state">暂无分类支出数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${CATEGORY_ICONS[name] || ''} ${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
                onClick={(entry: { name?: string }) => {
                  if (!entry?.name) return;
                  onDrilldown({
                    ...range,
                    category: entry.name,
                    drill: true,
                  });
                }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {memberData.length > 0 && (
        <div className="chart-container">
          <div className="chart-header">
            <h3 className="chart-title">👥 成员支出统计</h3>
            <span className="chart-subtitle">各成员支出占比</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={memberData} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={70} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="value" name="支出" radius={[0, 4, 4, 0]}>
                {memberData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {accountData.length > 0 && (
        <div className="chart-container">
          <div className="chart-header">
            <h3 className="chart-title">💳 账户支出统计</h3>
            <span className="chart-subtitle">各账户支出占比</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={accountData} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={70} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="value" name="支出" radius={[0, 4, 4, 0]}>
                {accountData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📊 分类统计</h3>
          <span className="card-subtitle">Top 5 支出分类及占比</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>排名</th>
              <th>分类</th>
              <th>支出总额</th>
              <th>占比</th>
            </tr>
          </thead>
          <tbody>
            {categorySummary.map((item, index) => (
              <tr
                key={item.category}
                onClick={() =>
                  onDrilldown({
                    ...range,
                    category: item.category,
                    drill: true,
                  })
                }
                className="drillable-row"
              >
                <td><span className="rank-badge">{index + 1}</span></td>
                <td className="category-cell">
                  <span className="category-icon">{CATEGORY_ICONS[item.category] || '📦'}</span>
                  {item.category}
                </td>
                <td className="amount expense">{formatCurrency(item.total)}</td>
                <td>
                  <div className="percentage-cell">
                    <span className="percentage-text">{item.percentage.toFixed(1)}%</span>
                    <div className="percentage-bar">
                      <div 
                        className="percentage-fill" 
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {categorySummary.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-cell">暂无分类数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏪 Top 商家</h3>
          <span className="card-subtitle">消费频次最高的商家</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>商家</th>
              <th>交易次数</th>
              <th>消费总额</th>
            </tr>
          </thead>
          <tbody>
            {summary.topMerchants.map((merchant) => (
              <tr
                key={merchant.counterparty}
                onClick={() =>
                  onDrilldown({
                    ...range,
                    merchant: merchant.counterparty,
                    drill: true,
                  })
                }
                className="drillable-row"
              >
                <td className="merchant-cell">
                  <span className="merchant-icon">🏪</span>
                  {merchant.counterparty}
                </td>
                <td><span className="count-badge">{merchant.count} 次</span></td>
                <td className="amount expense">{formatCurrency(merchant.total)}</td>
              </tr>
            ))}
            {summary.topMerchants.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-cell">暂无商家数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
