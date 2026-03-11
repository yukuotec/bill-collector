// Round 13: Fraud Detection - Identify suspicious transactions
import { getDatabase } from './database';

export interface FraudAlert {
  transactionId: string;
  date: string;
  amount: number;
  merchant: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export function detectSuspiciousTransactions(): FraudAlert[] {
  const db = getDatabase();
  const alerts: FraudAlert[] = [];

  // Check for unusually large amounts (3x average)
  const largeAmountStmt = db.prepare(`
    SELECT t.id, t.date, t.amount, t.counterparty
    FROM transactions t
    JOIN (
      SELECT AVG(ABS(amount)) * 3 as threshold FROM transactions
    ) avg ON ABS(t.amount) > avg.threshold
    WHERE t.type = 'expense'
    ORDER BY ABS(t.amount) DESC
    LIMIT 10
  `);

  while (largeAmountStmt.step()) {
    const row = largeAmountStmt.getAsObject() as { id: string; date: string; amount: number; counterparty: string | null };
    alerts.push({
      transactionId: row.id,
      date: row.date,
      amount: Math.abs(row.amount),
      merchant: row.counterparty || 'Unknown',
      reason: 'Unusually large amount (3x average)',
      severity: 'medium',
    });
  }
  largeAmountStmt.free();

  // Check for duplicate transactions within 1 minute
  const duplicateStmt = db.prepare(`
    SELECT t1.id, t1.date, t1.amount, t1.counterparty
    FROM transactions t1
    JOIN transactions t2 ON t1.id != t2.id
      AND t1.amount = t2.amount
      AND t1.counterparty = t2.counterparty
      AND ABS(julianday(t1.date) - julianday(t2.date)) < 0.001
    WHERE t1.type = 'expense'
    LIMIT 10
  `);

  while (duplicateStmt.step()) {
    const row = duplicateStmt.getAsObject() as { id: string; date: string; amount: number; counterparty: string | null };
    alerts.push({
      transactionId: row.id,
      date: row.date,
      amount: Math.abs(row.amount),
      merchant: row.counterparty || 'Unknown',
      reason: 'Potential duplicate transaction',
      severity: 'high',
    });
  }
  duplicateStmt.free();

  return alerts;
}
