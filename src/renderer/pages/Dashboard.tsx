import { useEffect, useMemo, useState } from 'react';
import { Summary } from '../../shared/types';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const [summary, setSummary] = useState<Summary | null>(null);
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

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>月度汇总</h2>
        <div className="filter-inline">
          <label htmlFor="summary-year">年份</label>
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
        <div className="summary-card">
          <p>{summary.currentMonth} 支出</p>
          <h3 className="expense">{formatCurrency(summary.currentMonthExpense)}</h3>
        </div>
        <div className="summary-card">
          <p>{summary.currentMonth} 收入</p>
          <h3 className="income">{formatCurrency(summary.currentMonthIncome)}</h3>
        </div>
      </div>

      <h2>月度趋势（最近12个月）</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="expense" stroke="#f44336" name="支出" />
            <Line type="monotone" dataKey="income" stroke="#4caf50" name="收入" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h2>分类占比</h2>
      <div className="chart-container">
        {pieData.length === 0 ? (
          <div>暂无分类支出数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
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

      <h2>Top 商家</h2>
      <table className="table">
        <thead>
          <tr>
            <th>商家</th>
            <th>次数</th>
            <th>总额</th>
          </tr>
        </thead>
        <tbody>
          {summary.topMerchants.map((merchant) => (
            <tr key={merchant.counterparty}>
              <td>{merchant.counterparty}</td>
              <td>{merchant.count} 次</td>
              <td>{formatCurrency(merchant.total)}</td>
            </tr>
          ))}
          {summary.topMerchants.length === 0 && (
            <tr>
              <td colSpan={3}>暂无商家数据</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
