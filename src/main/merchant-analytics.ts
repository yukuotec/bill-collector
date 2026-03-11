// Round 17: Merchant Analytics - Deep dive into spending by merchant
import { getDatabase } from './database';

export interface MerchantProfile {
  name: string;
  totalSpent: number;
  transactionCount: number;
  averageTransaction: number;
  firstPurchase: string;
  lastPurchase: string;
  categories: string[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

export function getMerchantAnalytics(merchantName: string): MerchantProfile | null {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      counterparty,
      SUM(ABS(amount)) as total,
      COUNT(*) as count,
      AVG(ABS(amount)) as avg,
      MIN(date) as first,
      MAX(date) as last,
      GROUP_CONCAT(DISTINCT category) as categories
    FROM transactions
    WHERE counterparty = ? AND type = 'expense'
    GROUP BY counterparty
  `);
  stmt.bind([merchantName]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as {
    counterparty: string;
    total: number;
    count: number;
    avg: number;
    first: string;
    last: string;
    categories: string;
  };
  stmt.free();

  // Calculate trend (compare first half to second half)
  const trendStmt = db.prepare(`
    SELECT
      CASE
        WHEN date < date('now', '-6 months') THEN 'first'
        ELSE 'second'
      END as period,
      SUM(ABS(amount)) as total
    FROM transactions
    WHERE counterparty = ? AND type = 'expense'
    GROUP BY period
  `);
  trendStmt.bind([merchantName]);

  const totals: Record<string, number> = {};
  while (trendStmt.step()) {
    const trow = trendStmt.getAsObject() as { period: string; total: number };
    totals[trow.period] = trow.total;
  }
  trendStmt.free();

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (totals.first && totals.second) {
    const change = (totals.second - totals.first) / totals.first;
    trend = change > 0.1 ? 'increasing' : change < -0.1 ? 'decreasing' : 'stable';
  }

  return {
    name: row.counterparty,
    totalSpent: row.total,
    transactionCount: row.count,
    averageTransaction: row.avg,
    firstPurchase: row.first,
    lastPurchase: row.last,
    categories: row.categories.split(',').filter(Boolean),
    trend,
  };
}
