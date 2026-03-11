import { getDatabase } from './database';

export interface HealthIssue {
  type: 'orphaned' | 'duplicate' | 'invalid' | 'missing';
  table: string;
  recordId: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  fixable: boolean;
}

export interface HealthReport {
  issues: HealthIssue[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    fixableIssues: number;
    lastCheck: string;
  };
}

export function runHealthCheck(): HealthReport {
  const issues: HealthIssue[] = [];

  // Check for orphaned transactions (non-existent category)
  issues.push(...checkOrphanedCategories());

  // Check for duplicate categories (case variations)
  issues.push(...checkDuplicateCategories());

  // Check for invalid amounts
  issues.push(...checkInvalidAmounts());

  // Check for orphaned transaction references
  issues.push(...checkOrphanedReferences());

  const criticalIssues = issues.filter(i => i.severity === 'high').length;
  const fixableIssues = issues.filter(i => i.fixable).length;

  return {
    issues,
    summary: {
      totalIssues: issues.length,
      criticalIssues,
      fixableIssues,
      lastCheck: new Date().toISOString(),
    },
  };
}

function checkOrphanedCategories(): HealthIssue[] {
  const db = getDatabase();
  const issues: HealthIssue[] = [];

  const stmt = db.prepare(`
    SELECT id, category
    FROM transactions
    WHERE category IS NULL OR category = '' OR category = 'undefined'
  `);

  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string; category: string | null };
    issues.push({
      type: 'missing',
      table: 'transactions',
      recordId: row.id,
      description: `Transaction has no category`,
      severity: 'low',
      fixable: true,
    });
  }

  stmt.free();
  return issues;
}

function checkDuplicateCategories(): HealthIssue[] {
  const db = getDatabase();
  const issues: HealthIssue[] = [];

  // Find similar categories (case insensitive matches)
  const stmt = db.prepare(`
    SELECT DISTINCT UPPER(category) as normalized, COUNT(DISTINCT category) as count
    FROM transactions
    WHERE category IS NOT NULL
    GROUP BY normalized
    HAVING count > 1
  `);

  while (stmt.step()) {
    const row = stmt.getAsObject() as { normalized: string; count: number };
    issues.push({
      type: 'duplicate',
      table: 'transactions',
      recordId: row.normalized,
      description: `Category has ${row.count} case variations`,
      severity: 'low',
      fixable: true,
    });
  }

  stmt.free();
  return issues;
}

function checkInvalidAmounts(): HealthIssue[] {
  const db = getDatabase();
  const issues: HealthIssue[] = [];

  const stmt = db.prepare(`
    SELECT id, amount
    FROM transactions
    WHERE amount IS NULL OR amount = 0 OR amount < 0
  `);

  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string; amount: number | null };
    issues.push({
      type: 'invalid',
      table: 'transactions',
      recordId: row.id,
      description: `Invalid amount: ${row.amount}`,
      severity: 'high',
      fixable: false,
    });
  }

  stmt.free();
  return issues;
}

function checkOrphanedReferences(): HealthIssue[] {
  const db = getDatabase();
  const issues: HealthIssue[] = [];

  // Check for orphaned member references
  const memberStmt = db.prepare(`
    SELECT t.id, t.member_id
    FROM transactions t
    LEFT JOIN members m ON t.member_id = m.id
    WHERE t.member_id IS NOT NULL AND m.id IS NULL
  `);

  while (memberStmt.step()) {
    const row = memberStmt.getAsObject() as { id: string; member_id: string };
    issues.push({
      type: 'orphaned',
      table: 'transactions',
      recordId: row.id,
      description: `References non-existent member: ${row.member_id}`,
      severity: 'medium',
      fixable: true,
    });
  }

  memberStmt.free();

  // Check for orphaned account references
  const accountStmt = db.prepare(`
    SELECT t.id, t.account_id
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.account_id IS NOT NULL AND a.id IS NULL
  `);

  while (accountStmt.step()) {
    const row = accountStmt.getAsObject() as { id: string; account_id: string };
    issues.push({
      type: 'orphaned',
      table: 'transactions',
      recordId: row.id,
      description: `References non-existent account: ${row.account_id}`,
      severity: 'medium',
      fixable: true,
    });
  }

  accountStmt.free();
  return issues;
}

export function fixIssue(issue: HealthIssue): boolean {
  const db = getDatabase();

  try {
    switch (issue.type) {
      case 'missing':
        if (issue.table === 'transactions') {
          const stmt = db.prepare('UPDATE transactions SET category = ? WHERE id = ?');
          stmt.run(['其他', issue.recordId]);
          stmt.free();
        }
        return true;

      case 'orphaned':
        if (issue.table === 'transactions') {
          const stmt = db.prepare('UPDATE transactions SET member_id = NULL, account_id = NULL WHERE id = ?');
          stmt.run([issue.recordId]);
          stmt.free();
        }
        return true;

      default:
        return false;
    }
  } catch {
    return false;
  }
}
