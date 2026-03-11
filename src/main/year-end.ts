// Round 14: Year-End Tax Report Generator
import { getDatabase } from './database';

export interface TaxReport {
  year: number;
  totalIncome: number;
  totalExpense: number;
  deductibleExpenses: Record<string, number>;
  summary: {
    medicalExpenses: number;
    educationExpenses: number;
    charitableDonations: number;
    businessExpenses: number;
  };
}

export function generateTaxReport(year: number): TaxReport {
  const db = getDatabase();

  // Get total income and expenses
  const totalStmt = db.prepare(`
    SELECT
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END) as total_expense
    FROM transactions
    WHERE strftime('%Y', date) = ?
  `);
  totalStmt.bind([year.toString()]);
  totalStmt.step();
  const totals = totalStmt.getAsObject() as { total_income: number; total_expense: number };
  totalStmt.free();

  // Get deductible expenses by category
  const deductibleStmt = db.prepare(`
    SELECT category, SUM(ABS(amount)) as total
    FROM transactions
    WHERE type = 'expense'
      AND strftime('%Y', date) = ?
      AND category IN ('医疗', '教育', '住房', '交通', '通讯', 'business', 'medical', 'education')
    GROUP BY category
  `);
  deductibleStmt.bind([year.toString()]);

  const deductibleExpenses: Record<string, number> = {};
  while (deductibleStmt.step()) {
    const row = deductibleStmt.getAsObject() as { category: string; total: number };
    deductibleExpenses[row.category] = row.total;
  }
  deductibleStmt.free();

  return {
    year,
    totalIncome: totals.total_income || 0,
    totalExpense: totals.total_expense || 0,
    deductibleExpenses,
    summary: {
      medicalExpenses: deductibleExpenses['医疗'] || deductibleExpenses['medical'] || 0,
      educationExpenses: deductibleExpenses['教育'] || deductibleExpenses['education'] || 0,
      charitableDonations: 0, // Would need separate tracking
      businessExpenses: deductibleExpenses['business'] || 0,
    },
  };
}
