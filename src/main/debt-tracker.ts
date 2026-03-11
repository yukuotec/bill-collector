// Round 18: Debt Tracker - Loans and IOU management
import { getDatabase } from './database';

export interface Debt {
  id: string;
  person: string;
  amount: number;
  type: 'owed' | 'owing'; // owed = they owe me, owing = I owe them
  description: string;
  date: string;
  dueDate?: string;
  isSettled: boolean;
  settledAt?: string;
}

export function createDebt(person: string, amount: number, type: 'owed' | 'owing', description: string, dueDate?: string): Debt {
  const db = getDatabase();
  const id = `debt_${Date.now()}`;

  const stmt = db.prepare(`
    INSERT INTO debts (id, person, amount, type, description, date, due_date, is_settled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);
  stmt.run([id, person, amount, type, description, new Date().toISOString().split('T')[0], dueDate, new Date().toISOString()]);
  stmt.free();

  return {
    id,
    person,
    amount,
    type,
    description,
    date: new Date().toISOString().split('T')[0],
    dueDate,
    isSettled: false,
  };
}

export function getDebtSummary(): { totalOwed: number; totalOwing: number; net: number } {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT
      SUM(CASE WHEN type = 'owed' AND is_settled = 0 THEN amount ELSE 0 END) as owed,
      SUM(CASE WHEN type = 'owing' AND is_settled = 0 THEN amount ELSE 0 END) as owing
    FROM debts
  `);
  stmt.step();
  const row = stmt.getAsObject() as { owed: number; owing: number };
  stmt.free();

  return {
    totalOwed: row.owed || 0,
    totalOwing: row.owing || 0,
    net: (row.owed || 0) - (row.owing || 0),
  };
}
