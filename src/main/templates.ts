import { getDatabase } from './database';

export interface TransactionTemplate {
  id: string;
  name: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  counterparty?: string;
  description?: string;
  accountId?: string;
  memberId?: string;
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
}

export function createTemplateFromTransaction(
  transactionId: string,
  name: string
): TransactionTemplate | null {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT amount, type, category, counterparty, description, account_id, member_id
    FROM transactions
    WHERE id = ?
  `);
  stmt.bind([transactionId]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as {
    amount: number;
    type: 'expense' | 'income';
    category: string;
    counterparty: string | null;
    description: string | null;
    account_id: string | null;
    member_id: string | null;
  };
  stmt.free();

  const template: TransactionTemplate = {
    id: `tmp_${Date.now()}`,
    name,
    amount: Math.abs(row.amount),
    type: row.type,
    category: row.category,
    counterparty: row.counterparty || undefined,
    description: row.description || undefined,
    accountId: row.account_id || undefined,
    memberId: row.member_id || undefined,
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };

  // Save template
  const insertStmt = db.prepare(`
    INSERT INTO transaction_templates (id, name, amount, type, category, counterparty, description, account_id, member_id, is_favorite, usage_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertStmt.run([
    template.id, template.name, template.amount, template.type, template.category,
    template.counterparty, template.description, template.accountId, template.memberId,
    template.isFavorite ? 1 : 0, template.usageCount, template.createdAt,
  ]);
  insertStmt.free();

  return template;
}

export function getTemplates(category?: string, favoritesOnly?: boolean): TransactionTemplate[] {
  const db = getDatabase();

  let query = 'SELECT * FROM transaction_templates WHERE 1=1';
  const params: (string | number)[] = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (favoritesOnly) {
    query += ' AND is_favorite = 1';
  }

  query += ' ORDER BY usage_count DESC, created_at DESC';

  const stmt = db.prepare(query);
  stmt.bind(params);

  const templates: TransactionTemplate[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    templates.push({
      id: row.id as string,
      name: row.name as string,
      amount: row.amount as number,
      type: row.type as 'expense' | 'income',
      category: row.category as string,
      counterparty: row.counterparty as string | undefined,
      description: row.description as string | undefined,
      accountId: row.account_id as string | undefined,
      memberId: row.member_id as string | undefined,
      isFavorite: (row.is_favorite as number) === 1,
      usageCount: row.usage_count as number,
      createdAt: row.created_at as string,
    });
  }

  stmt.free();
  return templates;
}

export function deleteTemplate(id: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM transaction_templates WHERE id = ?');
  stmt.run([id]);
  stmt.free();
}

export function toggleFavorite(id: string): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE transaction_templates SET is_favorite = NOT is_favorite WHERE id = ?');
  stmt.run([id]);
  stmt.free();
}

export function incrementUsage(id: string): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE transaction_templates SET usage_count = usage_count + 1 WHERE id = ?');
  stmt.run([id]);
  stmt.free();
}
