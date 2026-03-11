import { getDatabase } from './database';
import { getRecurringTransactions } from './database';

export interface CashFlowPrediction {
  date: string;
  predictedBalance: number;
  predictedIncome: number;
  predictedExpense: number;
  confidence: number;
  factors: string[];
}

export interface CashFlowAlert {
  type: 'overdraft' | 'low_balance' | 'high_expense' | 'bill_due';
  date: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestedAction?: string;
  balance?: number;
}

export interface CashFlowForecast {
  predictions: CashFlowPrediction[];
  alerts: CashFlowAlert[];
  summary: {
    startingBalance: number;
    projectedLow: number;
    projectedHigh: number;
    averageDailyChange: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
}

interface HistoricalPattern {
  category: string;
  averageAmount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  confidence: number;
}

/**
 * Generate 30-day cash flow forecast
 */
export async function generateCashFlowForecast(
  accountId?: string,
  days: number = 30
): Promise<CashFlowForecast> {
  const db = getDatabase();
  const today = new Date();
  const predictions: CashFlowPrediction[] = [];
  const alerts: CashFlowAlert[] = [];

  // Get current balance
  const currentBalance = await getCurrentBalance(accountId);

  // Get historical patterns (last 90 days)
  const patterns = await analyzeHistoricalPatterns(90);

  // Get recurring transactions
  const recurring = getRecurringTransactions();

  // Generate daily predictions
  let runningBalance = currentBalance;
  let projectedLow = currentBalance;
  let projectedHigh = currentBalance;
  let totalChange = 0;

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // Calculate predicted income and expense for this day
    const predictedIncome = predictIncomeForDate(date, patterns);
    const predictedExpense = predictExpenseForDate(date, patterns, recurring);

    // Calculate confidence based on data quality
    const confidence = calculateConfidence(date, patterns, i);

    // Update running balance
    const dailyChange = predictedIncome - predictedExpense;
    runningBalance += dailyChange;
    totalChange += dailyChange;

    // Track min/max
    projectedLow = Math.min(projectedLow, runningBalance);
    projectedHigh = Math.max(projectedHigh, runningBalance);

    predictions.push({
      date: dateStr,
      predictedBalance: runningBalance,
      predictedIncome,
      predictedExpense,
      confidence,
      factors: getPredictionFactors(date, patterns, recurring),
    });

    // Check for alerts
    const alert = checkForAlert(dateStr, runningBalance, predictedExpense, i);
    if (alert) {
      alerts.push(alert);
    }
  }

  // Determine trend
  const trendDirection = totalChange > 50 ? 'up' : totalChange < -50 ? 'down' : 'stable';

  return {
    predictions,
    alerts,
    summary: {
      startingBalance: currentBalance,
      projectedLow,
      projectedHigh,
      averageDailyChange: totalChange / days,
      trendDirection,
    },
  };
}

async function getCurrentBalance(accountId?: string): Promise<number> {
  const db = getDatabase();

  if (accountId) {
    // Get specific account balance
    const stmt = db.prepare('SELECT balance FROM accounts WHERE id = ?');
    stmt.bind([accountId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as { balance: number };
      stmt.free();
      return row.balance;
    }
    stmt.free();
    return 0;
  }

  // Get sum of all account balances
  const stmt = db.prepare('SELECT COALESCE(SUM(balance), 0) as total FROM accounts');
  stmt.step();
  const row = stmt.getAsObject() as { total: number };
  stmt.free();

  // If no accounts, calculate from transactions
  if (row.total === 0) {
    const txnStmt = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as net
      FROM transactions
    `);
    txnStmt.step();
    const txnRow = txnStmt.getAsObject() as { net: number };
    txnStmt.free();
    return txnRow.net;
  }

  return row.total;
}

async function analyzeHistoricalPatterns(days: number): Promise<HistoricalPattern[]> {
  const db = getDatabase();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stmt = db.prepare(`
    SELECT
      category,
      AVG(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as avg_expense,
      AVG(CASE WHEN type = 'income' THEN amount ELSE 0 END) as avg_income,
      COUNT(*) as count,
      COUNT(DISTINCT CAST(strftime('%w', date) AS INTEGER)) as unique_days
    FROM transactions
    WHERE date >= ?
    GROUP BY category
    HAVING count >= 2
  `);

  stmt.bind([startDate.toISOString().split('T')[0]]);

  const patterns: HistoricalPattern[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const count = row.count as number;
    const uniqueDays = row.unique_days as number;

    // Determine frequency based on pattern
    let frequency: 'daily' | 'weekly' | 'monthly' = 'monthly';
    if (count >= days * 0.8) {
      frequency = 'daily';
    } else if (uniqueDays <= 7 && count >= days / 7) {
      frequency = 'weekly';
    }

    if (row.avg_expense as number > 0) {
      patterns.push({
        category: row.category as string,
        averageAmount: row.avg_expense as number,
        frequency,
        confidence: Math.min(count / 10, 0.9),
      });
    }

    if (row.avg_income as number > 0) {
      patterns.push({
        category: `${row.category as string}_income`,
        averageAmount: row.avg_income as number,
        frequency,
        confidence: Math.min(count / 5, 0.95),
      });
    }
  }

  stmt.free();

  return patterns;
}

function predictIncomeForDate(date: Date, patterns: HistoricalPattern[]): number {
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  let total = 0;

  for (const pattern of patterns) {
    if (!pattern.category.endsWith('_income')) continue;

    let shouldInclude = false;

    if (pattern.frequency === 'daily') {
      shouldInclude = true;
    } else if (pattern.frequency === 'weekly' && pattern.dayOfWeek === dayOfWeek) {
      shouldInclude = true;
    } else if (pattern.frequency === 'monthly' && pattern.dayOfMonth === dayOfMonth) {
      shouldInclude = true;
    }

    if (shouldInclude) {
      total += pattern.averageAmount * pattern.confidence;
    }
  }

  return total;
}

function predictExpenseForDate(
  date: Date,
  patterns: HistoricalPattern[],
  recurring: { is_active: boolean; day_of_month?: number; amount: number; type: string }[]
): number {
  const dayOfMonth = date.getDate();
  let total = 0;

  // Add recurring transactions
  for (const item of recurring) {
    if (!item.is_active) continue;
    if (item.type === 'expense' && item.day_of_month === dayOfMonth) {
      total += Math.abs(item.amount);
    }
  }

  // Add pattern-based predictions
  for (const pattern of patterns) {
    if (pattern.category.endsWith('_income')) continue;

    let shouldInclude = false;
    const dayOfWeek = date.getDay();

    if (pattern.frequency === 'daily') {
      shouldInclude = true;
    } else if (pattern.frequency === 'weekly' && pattern.dayOfWeek === dayOfWeek) {
      shouldInclude = true;
    } else if (pattern.frequency === 'monthly' && pattern.dayOfMonth === dayOfMonth) {
      shouldInclude = true;
    }

    if (shouldInclude) {
      total += pattern.averageAmount * pattern.confidence;
    }
  }

  return total;
}

function calculateConfidence(date: Date, patterns: HistoricalPattern[], daysOut: number): number {
  // Confidence decreases as we predict further into the future
  const timeDecay = Math.max(0.3, 1 - (daysOut / 60));

  // Confidence increases with more historical data
  const dataQuality = Math.min(patterns.length / 10, 1);

  return timeDecay * dataQuality;
}

function getPredictionFactors(
  date: Date,
  patterns: HistoricalPattern[],
  recurring: { name?: string; is_active: boolean }[]
): string[] {
  const factors: string[] = [];
  const dayOfMonth = date.getDate();

  // Check for recurring items
  for (const item of recurring) {
    if (item.is_active) {
      factors.push(`Recurring: ${item.name || 'Expense'}`);
    }
  }

  // Check for historical patterns
  for (const pattern of patterns) {
    if (pattern.confidence > 0.5) {
      factors.push(`Pattern: ${pattern.category}`);
    }
  }

  return factors.slice(0, 3); // Limit to top 3
}

function checkForAlert(
  date: string,
  balance: number,
  predictedExpense: number,
  daysFromNow: number
): CashFlowAlert | null {
  const LOW_BALANCE_THRESHOLD = 500;
  const OVERDRAFT_THRESHOLD = 0;

  // Overdraft warning (7 days ahead)
  if (daysFromNow <= 7 && balance < OVERDRAFT_THRESHOLD) {
    return {
      type: 'overdraft',
      date,
      severity: 'critical',
      message: `Projected overdraft on ${date}`,
      suggestedAction: 'Reduce expenses or transfer funds',
      balance,
    };
  }

  // Low balance warning (7 days ahead)
  if (daysFromNow <= 7 && balance < LOW_BALANCE_THRESHOLD) {
    return {
      type: 'low_balance',
      date,
      severity: 'warning',
      message: `Balance will drop to ¥${balance.toFixed(2)}`,
      suggestedAction: 'Consider delaying non-essential purchases',
      balance,
    };
  }

  // High expense day
  if (predictedExpense > 2000 && daysFromNow <= 3) {
    return {
      type: 'high_expense',
      date,
      severity: 'info',
      message: `High expense day: ¥${predictedExpense.toFixed(2)}`,
      suggestedAction: 'Review upcoming payments',
    };
  }

  return null;
}

/**
 * Get optimal bill payment date to maintain cash flow
 */
export function optimizeBillPaymentDate(
  dueDate: string,
  amount: number,
  forecast: CashFlowForecast
): { suggestedDate: string; reason: string } {
  const due = new Date(dueDate);
  const today = new Date();
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Find the day with the highest balance in the window
  let bestDate = dueDate;
  let highestBalance = -Infinity;

  // Check 5 days before due date
  for (let i = 0; i <= Math.min(5, daysUntilDue); i++) {
    const checkDate = new Date(due);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    const prediction = forecast.predictions.find(p => p.date === dateStr);
    if (prediction && prediction.predictedBalance > highestBalance) {
      highestBalance = prediction.predictedBalance;
      bestDate = dateStr;
    }
  }

  if (bestDate !== dueDate) {
    return {
      suggestedDate: bestDate,
      reason: `Pay early to maintain higher balance on due date`,
    };
  }

  return {
    suggestedDate: dueDate,
    reason: `Pay on due date for optimal cash flow`,
  };
}
