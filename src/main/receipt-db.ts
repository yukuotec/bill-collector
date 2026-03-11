import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { Receipt, ReceiptQuery, ReceiptWithTransaction } from '../shared/types';
import { getDatabase, getDatabasePath } from './database';

export function getReceiptsDirectory(): string {
  const dbDir = path.dirname(getDatabasePath());
  const receiptsDir = path.join(dbDir, 'receipts');
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }
  return receiptsDir;
}

export function generateReceiptId(): string {
  return `rcp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export interface SaveReceiptOptions {
  filePath: string;
  fileName: string;
  mimeType?: string;
  transactionId?: string;
  ocrText?: string;
  ocrConfidence?: number;
  amountDetected?: number;
  dateDetected?: string;
  merchantDetected?: string;
  itemsDetected?: string;
}

export async function saveReceipt(options: SaveReceiptOptions): Promise<Receipt> {
  const db = getDatabase();
  const receiptsDir = getReceiptsDirectory();
  const id = generateReceiptId();

  const now = new Date().toISOString();
  const ext = path.extname(options.fileName) || '.jpg';
  const storageFileName = `${id}${ext}`;
  const storagePath = path.join(receiptsDir, storageFileName);

  // Copy file to receipts directory
  await fs.promises.copyFile(options.filePath, storagePath);

  // Get file stats
  const stats = await fs.promises.stat(storagePath);

  // Generate thumbnail (simplified - just store path)
  const thumbnailPath = path.join(receiptsDir, `${id}_thumb.jpg`);

  const receipt: Receipt = {
    id,
    transaction_id: options.transactionId || undefined,
    file_path: storagePath,
    thumbnail_path: thumbnailPath,
    file_name: options.fileName,
    file_size: stats.size,
    mime_type: options.mimeType || 'image/jpeg',
    ocr_text: options.ocrText || undefined,
    ocr_confidence: options.ocrConfidence || undefined,
    amount_detected: options.amountDetected || undefined,
    date_detected: options.dateDetected || undefined,
    merchant_detected: options.merchantDetected || undefined,
    items_detected: options.itemsDetected || undefined,
    encrypted: 0,
    created_at: now,
    updated_at: now,
  };

  const stmt = db.prepare(`
    INSERT INTO receipts (
      id, transaction_id, file_path, thumbnail_path, file_name, file_size, mime_type,
      ocr_text, ocr_confidence, amount_detected, date_detected, merchant_detected, items_detected,
      encrypted, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    receipt.id,
    receipt.transaction_id,
    receipt.file_path,
    receipt.thumbnail_path,
    receipt.file_name,
    receipt.file_size,
    receipt.mime_type,
    receipt.ocr_text,
    receipt.ocr_confidence,
    receipt.amount_detected,
    receipt.date_detected,
    receipt.merchant_detected,
    receipt.items_detected,
    receipt.encrypted,
    receipt.created_at,
    receipt.updated_at,
  ]);
  stmt.free();

  return receipt;
}

export async function getTransactionsForReceiptMatching(
  amount?: number,
  date?: string,
  merchant?: string,
  windowDays: number = 7
): Promise<{ id: string; amount: number; date: string; counterparty?: string; description?: string; category?: string }[]> {
  const db = getDatabase();

  let dateFilter = '';
  const params: (string | number)[] = [];

  if (date) {
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - windowDays);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + windowDays);
    dateFilter = 'AND date >= ? AND date <= ?';
    params.push(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
  }

  let amountFilter = '';
  if (amount !== undefined) {
    amountFilter = 'AND (ABS(amount - ?) < 1 OR ABS(amount - ?) < amount * 0.1)';
    params.push(amount, amount);
  }

  const stmt = db.prepare(`
    SELECT id, amount, date, counterparty, description, category
    FROM transactions
    WHERE type = 'expense'
    ${dateFilter}
    ${amountFilter}
    ORDER BY ABS(date - ?) ASC, ABS(amount - ?) ASC
    LIMIT 50
  `);

  const queryParams = [...params, date || new Date().toISOString().split('T')[0], amount || 0];
  stmt.bind(queryParams);

  const transactions: { id: string; amount: number; date: string; counterparty?: string; description?: string; category?: string }[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    transactions.push({
      id: row.id as string,
      amount: row.amount as number,
      date: row.date as string,
      counterparty: row.counterparty as string | undefined,
      description: row.description as string | undefined,
      category: row.category as string | undefined,
    });
  }

  stmt.free();

  return transactions;
}

export async function getReceiptById(id: string): Promise<ReceiptWithTransaction | null> {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT r.*, t.id as txn_id, t.amount as txn_amount, t.date as txn_date,
           t.counterparty as txn_counterparty, t.description as txn_description,
           t.category as txn_category
    FROM receipts r
    LEFT JOIN transactions t ON r.transaction_id = t.id
    WHERE r.id = ?
  `);

  stmt.bind([id]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();

  const receipt: ReceiptWithTransaction = {
    id: row.id as string,
    transaction_id: row.transaction_id as string | null,
    file_path: row.file_path as string,
    thumbnail_path: row.thumbnail_path as string | null,
    file_name: row.file_name as string,
    file_size: row.file_size as number | undefined,
    mime_type: row.mime_type as string | undefined,
    ocr_text: row.ocr_text as string | undefined,
    ocr_confidence: row.ocr_confidence as number | undefined,
    amount_detected: row.amount_detected as number | undefined,
    date_detected: row.date_detected as string | undefined,
    merchant_detected: row.merchant_detected as string | undefined,
    items_detected: row.items_detected as string | undefined,
    encrypted: row.encrypted as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };

  if (row.txn_id) {
    receipt.transaction = {
      id: row.txn_id as string,
      amount: row.txn_amount as number,
      date: row.txn_date as string,
      counterparty: row.txn_counterparty as string | undefined,
      description: row.txn_description as string | undefined,
      category: row.txn_category as string | undefined,
    } as any;
  }

  return receipt;
}

export async function searchReceipts(query: ReceiptQuery): Promise<{ items: ReceiptWithTransaction[]; total: number }> {
  const db = getDatabase();
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];
  let useFts = false;
  let receiptIds: string[] = [];

  if (query.q) {
    // Try to use FTS5 first, fallback to LIKE if not available
    try {
      const ftsQuery = db.prepare(`
        SELECT receipt_id FROM receipt_fts
        WHERE receipt_fts MATCH ?
      `);
      ftsQuery.bind([query.q]);

      while (ftsQuery.step()) {
        const row = ftsQuery.getAsObject() as { receipt_id: string };
        receiptIds.push(row.receipt_id);
      }
      ftsQuery.free();
      useFts = receiptIds.length > 0;
    } catch {
      // FTS not available, use LIKE fallback
      useFts = false;
    }

    if (useFts) {
      if (receiptIds.length === 0) {
        return { items: [], total: 0 };
      }
      whereClause += ` AND r.id IN (${receiptIds.map(() => '?').join(',')})`;
      params.push(...receiptIds);
    } else {
      // Fallback to LIKE search
      whereClause += ` AND (r.ocr_text LIKE ? OR r.merchant_detected LIKE ? OR r.items_detected LIKE ?)`;
      const likePattern = `%${query.q}%`;
      params.push(likePattern, likePattern, likePattern);
    }
  }

  if (query.transactionId) {
    whereClause += ' AND r.transaction_id = ?';
    params.push(query.transactionId);
  }

  if (query.startDate) {
    whereClause += ' AND r.date_detected >= ?';
    params.push(query.startDate);
  }

  if (query.endDate) {
    whereClause += ' AND r.date_detected <= ?';
    params.push(query.endDate);
  }

  if (query.merchant) {
    whereClause += ' AND r.merchant_detected LIKE ?';
    params.push(`%${query.merchant}%`);
  }

  // Get total count
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM receipts r ${whereClause}`);
  countStmt.bind(params);
  countStmt.step();
  const countRow = countStmt.getAsObject() as { total: number };
  const total = countRow.total;
  countStmt.free();

  // Get paginated results
  const selectParams = [...params, pageSize, offset];
  const stmt = db.prepare(`
    SELECT r.*, t.id as txn_id, t.amount as txn_amount, t.date as txn_date,
           t.counterparty as txn_counterparty, t.description as txn_description,
           t.category as txn_category
    FROM receipts r
    LEFT JOIN transactions t ON r.transaction_id = t.id
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `);

  stmt.bind(selectParams);

  const items: ReceiptWithTransaction[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;

    const receipt: ReceiptWithTransaction = {
      id: row.id as string,
      transaction_id: row.transaction_id as string | null,
      file_path: row.file_path as string,
      thumbnail_path: row.thumbnail_path as string | null,
      file_name: row.file_name as string,
      file_size: row.file_size as number | undefined,
      mime_type: row.mime_type as string | undefined,
      ocr_text: row.ocr_text as string | undefined,
      ocr_confidence: row.ocr_confidence as number | undefined,
      amount_detected: row.amount_detected as number | undefined,
      date_detected: row.date_detected as string | undefined,
      merchant_detected: row.merchant_detected as string | undefined,
      items_detected: row.items_detected as string | undefined,
      encrypted: row.encrypted as number,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };

    if (row.txn_id) {
      receipt.transaction = {
        id: row.txn_id as string,
        amount: row.txn_amount as number,
        date: row.txn_date as string,
        counterparty: row.txn_counterparty as string | undefined,
        description: row.txn_description as string | undefined,
        category: row.txn_category as string | undefined,
      } as any;
    }

    items.push(receipt);
  }

  stmt.free();

  return { items, total };
}

export async function linkReceiptToTransaction(receiptId: string, transactionId: string | null): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE receipts
    SET transaction_id = ?, updated_at = ?
    WHERE id = ?
  `);

  stmt.run([transactionId, now, receiptId]);
  stmt.free();
}

export async function deleteReceipt(id: string): Promise<void> {
  const db = getDatabase();

  const receipt = await getReceiptById(id);
  if (!receipt) {
    throw new Error('Receipt not found');
  }

  // Delete files
  try {
    if (fs.existsSync(receipt.file_path)) {
      fs.unlinkSync(receipt.file_path);
    }
    if (receipt.thumbnail_path && fs.existsSync(receipt.thumbnail_path)) {
      fs.unlinkSync(receipt.thumbnail_path);
    }
  } catch (err) {
    console.error('Failed to delete receipt files:', err);
  }

  // Delete from database (triggers will clean up FTS)
  const stmt = db.prepare('DELETE FROM receipts WHERE id = ?');
  stmt.run([id]);
  stmt.free();
}

export async function findPotentialDuplicateReceipts(
  amount: number,
  date: string,
  windowDays: number = 3
): Promise<ReceiptWithTransaction[]> {
  const db = getDatabase();

  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - windowDays);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + windowDays);

  const stmt = db.prepare(`
    SELECT r.*, t.id as txn_id, t.amount as txn_amount, t.date as txn_date,
           t.counterparty as txn_counterparty
    FROM receipts r
    LEFT JOIN transactions t ON r.transaction_id = t.id
    WHERE r.amount_detected = ?
      AND r.date_detected >= ?
      AND r.date_detected <= ?
  `);

  stmt.bind([amount, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

  const items: ReceiptWithTransaction[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;

    const receipt: ReceiptWithTransaction = {
      id: row.id as string,
      transaction_id: row.transaction_id as string | null,
      file_path: row.file_path as string,
      thumbnail_path: row.thumbnail_path as string | null,
      file_name: row.file_name as string,
      amount_detected: row.amount_detected as number,
      date_detected: row.date_detected as string,
      merchant_detected: row.merchant_detected as string | undefined,
      encrypted: row.encrypted as number,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };

    if (row.txn_id) {
      receipt.transaction = {
        id: row.txn_id as string,
        amount: row.txn_amount as number,
        date: row.txn_date as string,
        counterparty: row.txn_counterparty as string | undefined,
      } as any;
    }

    items.push(receipt);
  }

  stmt.free();

  return items;
}
