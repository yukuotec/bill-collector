import { useEffect, useMemo, useState } from 'react';
import { BudgetAlert, Summary } from '../../shared/types';
import { DrilldownQuery, getYearDateRange } from '../../shared/drilldown';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CategorySummary {
  category: string;
  total: number;
  percentage: number;
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

export default function Dashboard({ onDrilldown }: DashboardProps) {
  const currentYear = new Date().getFullYear();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [loading, setLoading] = useState<boolean>(true);

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
