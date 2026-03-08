import { TransactionQuery } from '../shared/types';

export function buildTransactionWhereClause(filters?: TransactionQuery): { where: string[]; params: (string | number)[] } {
  const where: string[] = ['1=1'];
  const params: (string | number)[] = [];

  if (filters?.category) {
    where.push('category = ?');
    params.push(filters.category);
  }
  if (filters?.merchant) {
    where.push('counterparty LIKE ?');
    params.push(`%${filters.merchant}%`);
  }
  if (filters?.source) {
    where.push('source = ?');
    params.push(filters.source);
  }
  if (filters?.type) {
    where.push('type = ?');
    params.push(filters.type);
  }
  if (filters?.startDate) {
    where.push('date >= ?');
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    where.push('date <= ?');
    params.push(filters.endDate);
  }
  if (filters?.duplicateType) {
    where.push('duplicate_type = ?');
    params.push(filters.duplicateType);
  }
  if (filters?.refundOnly) {
    where.push('COALESCE(is_refund, 0) = 1');
  }
  if (filters?.memberId !== undefined) {
    if (filters.memberId === '') {
      // Empty string means unassigned transactions (member_id IS NULL)
      where.push('member_id IS NULL');
    } else {
      where.push('member_id = ?');
      params.push(filters.memberId);
    }
  }
  if (filters?.accountId !== undefined) {
    if (filters.accountId === '') {
      // Empty string means unassigned transactions (account_id IS NULL)
      where.push('account_id IS NULL');
    } else {
      where.push('account_id = ?');
      params.push(filters.accountId);
    }
  }
  if (filters?.q) {
    where.push('(description LIKE ? OR counterparty LIKE ? OR notes LIKE ?)');
    const keyword = `%${filters.q}%`;
    params.push(keyword, keyword, keyword);
  }

  return { where, params };
}
