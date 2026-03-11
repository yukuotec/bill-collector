// Round 12: Advanced Trend Analysis
import { getDatabase } from './database';

export interface TrendAnalysis {
  category: string;
  currentMonth: number;
  previousMonth: number;
  changePercent: number;
  trendDirection: 'up' | 'down' | 'stable';
  average3Months: number;
  projectedNextMonth: number;
}

export function analyzeCategoryTrends(months: number = 3): TrendAnalysis[] {
  const db = getDatabase();
  const results: TrendAnalysis[] = [];

  const stmt = db.prepare(`
    SELECT
      category,
      strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END) as total
    FROM transactions
    WHERE date >= date('now', '-${months} months')
    GROUP BY category, month
    ORDER BY category, month DESC
  `);

  const data: Record<string, number[]> = {};
  while (stmt.step()) {
    const row = stmt.getAsObject() as { category: string; month: string; total: number };
    if (!data[row.category]) data[row.category] = [];
    data[row.category].push(row.total);
  }
  stmt.free();

  for (const [category, totals] of Object.entries(data)) {
    if (totals.length >= 2) {
      const current = totals[0];
      const previous = totals[1];
      const changePercent = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      const avg3 = totals.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(totals.length, 3);

      results.push({
        category,
        currentMonth: current,
        previousMonth: previous,
        changePercent,
        trendDirection: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
        average3Months: avg3,
        projectedNextMonth: avg3 * (1 + changePercent / 200),
      });
    }
  }

  return results;
}
