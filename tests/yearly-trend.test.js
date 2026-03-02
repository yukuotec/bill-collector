const test = require('node:test');
const assert = require('node:assert/strict');

function transformMonthlyTrend(rows) {
  if (!rows || rows.length === 0) return { currentMonth: null, previousMonth: null, data: [] };
  const sorted = [...rows].sort((a, b) => b.month.localeCompare(a.month));
  return {
    currentMonth: sorted[0]?.month || null,
    previousMonth: sorted[1]?.month || null,
    data: sorted.slice(0, 12).map((row, idx) => ({
      month: row.month,
      expense: row.expense || 0,
      income: row.income || 0,
      change: idx === 0 ? null : (row.expense || 0) - (sorted[idx + 1]?.expense || 0)
    }))
  };
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount);
}

function calculateChange(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

test('transformMonthlyTrend returns empty for empty input', () => {
  const result = transformMonthlyTrend([]);
  assert.equal(result.currentMonth, null);
});

test('transformMonthlyTrend first month has null changes', () => {
  const rows = [
    { month: '2026-02', expense: 1200 },
    { month: '2026-01', expense: 1000 }
  ];
  const result = transformMonthlyTrend(rows);
  assert.equal(result.data[0].change, null);
});

test('transformMonthlyTrend handles zero previous expense', () => {
  const rows = [
    { month: '2026-02', expense: 1000 },
    { month: '2026-01', expense: 0 }
  ];
  const result = transformMonthlyTrend(rows);
  // First item always has null change
  assert.equal(result.data[0].change, null);
  // Second item has the change
  assert.equal(result.data[1].change, 0);
});

test('formatCurrency formats correctly', () => {
  assert.equal(formatCurrency(1000), '¥1,000.00');
});

test('calculateChange returns null for zero previous', () => {
  assert.equal(calculateChange(1000, 0), null);
});

test('calculateChange calculates positive change', () => {
  assert.equal(calculateChange(1200, 1000), 20);
});

test('calculateChange calculates negative change', () => {
  assert.equal(calculateChange(800, 1000), -20);
});

test('calculateChange handles equal values', () => {
  assert.equal(calculateChange(1000, 1000), 0);
});

test('transformMonthlyTrend handles multiple months', () => {
  const rows = [
    { month: '2026-03', expense: 1500, income: 500 },
    { month: '2026-02', expense: 1200, income: 400 },
    { month: '2026-01', expense: 1000, income: 300 }
  ];
  const result = transformMonthlyTrend(rows);
  assert.equal(result.data.length, 3);
});

test('transformMonthlyTrend returns current and previous month', () => {
  const rows = [
    { month: '2026-02', expense: 1200 },
    { month: '2026-01', expense: 1000 }
  ];
  const result = transformMonthlyTrend(rows);
  assert.equal(result.currentMonth, '2026-02');
  assert.equal(result.previousMonth, '2026-01');
});

test('transformMonthlyTrend handles single month', () => {
  const rows = [{ month: '2026-01', expense: 1000 }];
  const result = transformMonthlyTrend(rows);
  assert.equal(result.currentMonth, '2026-01');
  assert.equal(result.previousMonth, null);
});
