import { getConfig } from './config';

export interface SourceStatus {
  source: string;
  lastDate: string | null;
  count: number;
}

export interface MonthlyCount {
  source: string;
  month: string;
  count: number;
}

let db: any = null;
let dbAvailable = false;

function tryLoadDb(): boolean {
  if (db !== null) return dbAvailable;

  try {
    // Try to import better-sqlite3 (optional dependency)
    const Database = require('better-sqlite3');
    const config = getConfig();
    db = new Database(config.dbPath, { readonly: true });
    dbAvailable = true;
  } catch (error) {
    dbAvailable = false;
  }

  return dbAvailable;
}

export function isDbAvailable(): boolean {
  return tryLoadDb();
}

export function closeDb(): void {
  if (db && dbAvailable) {
    db.close();
    db = null;
  }
}

export function getLastImportBySource(): SourceStatus[] {
  if (!tryLoadDb()) {
    return [];
  }

  try {
    const stmt = db.prepare(`
      SELECT
        source,
        MAX(date) as lastDate,
        COUNT(*) as count
      FROM transactions
      WHERE source IN ('alipay', 'wechat', 'yunshanfu', 'bank', 'manual')
      GROUP BY source
    `);
    return stmt.all() as SourceStatus[];
  } catch (error) {
    console.warn('⚠️ 无法读取数据库，使用默认状态');
    return [];
  }
}

export function getSourceCoverage(year: number): MonthlyCount[] {
  if (!tryLoadDb()) {
    return [];
  }

  try {
    const stmt = db.prepare(`
      SELECT
        source,
        strftime('%Y-%m', date) as month,
        COUNT(*) as count
      FROM transactions
      WHERE strftime('%Y', date) = ?
        AND source IN ('alipay', 'wechat', 'yunshanfu', 'bank', 'manual')
      GROUP BY source, month
      ORDER BY month DESC, source
    `);
    return stmt.all(String(year)) as MonthlyCount[];
  } catch (error) {
    return [];
  }
}

export function getMostRecentImport(): string | null {
  if (!tryLoadDb()) {
    return null;
  }

  try {
    const stmt = db.prepare(`
      SELECT MAX(date) as lastDate
      FROM transactions
    `);
    const result = stmt.get() as { lastDate: string | null };
    return result?.lastDate || null;
  } catch (error) {
    return null;
  }
}
