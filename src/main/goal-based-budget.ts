// Round 16: Goal-Based Budgeting
import { getDatabase } from './database';

export interface BudgetGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  monthlyContribution: number;
  remainingMonths: number;
  onTrack: boolean;
}

export function calculateGoalProgress(goalId: string): BudgetGoal | null {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT id, name, target_amount, current_amount, deadline
    FROM savings_goals
    WHERE id = ?
  `);
  stmt.bind([goalId]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    deadline: string;
  };
  stmt.free();

  const deadline = new Date(row.deadline);
  const now = new Date();
  const remainingMonths = Math.max(0, (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()));

  const remaining = row.target_amount - row.current_amount;
  const monthlyContribution = remainingMonths > 0 ? remaining / remainingMonths : remaining;
  const onTrack = remainingMonths > 0 && row.current_amount / row.target_amount >= (1 - remainingMonths / 12);

  return {
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    deadline: row.deadline,
    monthlyContribution,
    remainingMonths,
    onTrack,
  };
}
