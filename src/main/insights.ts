// Round 20: Smart Insights - Automated financial insights
import { getDatabase } from './database';

export interface FinancialInsight {
  id: string;
  type: 'spending' | 'saving' | 'warning' | 'tip';
  title: string;
  description: string;
  actionText?: string;
  actionData?: any;
  priority: number; // 1-10, higher = more important
}

export function generateInsights(): FinancialInsight[] {
  const insights: FinancialInsight[] = [];
  const db = getDatabase();

  // Insight 1: Top spending category this month
  const topCategoryStmt = db.prepare(`
    SELECT category, SUM(ABS(amount)) as total
    FROM transactions
    WHERE type = 'expense'
      AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    GROUP BY category
    ORDER BY total DESC
    LIMIT 1
  `);

  if (topCategoryStmt.step()) {
    const row = topCategoryStmt.getAsObject() as { category: string; total: number };
    insights.push({
      id: 'insight_top_category',
      type: 'spending',
      title: 'Top Spending Category',
      description: `You've spent ¥${row.total.toFixed(2)} on ${row.category} this month.`,
      priority: 5,
    });
  }
  topCategoryStmt.free();

  // Insight 2: Compare to last month
  const compareStmt = db.prepare(`
    SELECT
      SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now') THEN ABS(amount) ELSE 0 END) as this_month,
      SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month') THEN ABS(amount) ELSE 0 END) as last_month
    FROM transactions
    WHERE type = 'expense'
  `);
  compareStmt.step();
  const compareRow = compareStmt.getAsObject() as { this_month: number; last_month: number };
  compareStmt.free();

  if (compareRow.this_month && compareRow.last_month) {
    const change = ((compareRow.this_month - compareRow.last_month) / compareRow.last_month) * 100;
    if (Math.abs(change) > 10) {
      insights.push({
        id: 'insight_monthly_change',
        type: change > 0 ? 'warning' : 'saving',
        title: change > 0 ? 'Spending Increased' : 'Spending Decreased',
        description: `Your spending is ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'higher' : 'lower'} than last month.`,
        priority: change > 0 ? 8 : 6,
      });
    }
  }

  // Insight 3: Recurring subscription check
  const recurringStmt = db.prepare(`
    SELECT name, amount
    FROM recurring_transactions
    WHERE is_active = 1 AND type = 'expense'
    ORDER BY amount DESC
    LIMIT 1
  `);
  if (recurringStmt.step()) {
    const row = recurringStmt.getAsObject() as { name: string; amount: number };
    insights.push({
      id: 'insight_top_subscription',
      type: 'spending',
      title: 'Largest Recurring Expense',
      description: `Your largest subscription is ${row.name} at ¥${Math.abs(row.amount).toFixed(2)}/month.`,
      priority: 4,
    });
  }
  recurringStmt.free();

  // Sort by priority
  return insights.sort((a, b) => b.priority - a.priority);
}
