import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDatabase, getDatabasePath } from './database';

export interface SyncDevice {
  id: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  pairedAt: string;
  lastSyncAt?: string;
}

export interface SyncPackage {
  version: number;
  deviceId: string;
  timestamp: string;
  checksum: string;
  encryptedData: string;
  nonce: string;
}

export interface SyncState {
  lastSyncAt: string | null;
  devices: SyncDevice[];
  pendingChanges: number;
}

const SYNC_VERSION = 1;

/**
 * Generate device identity
 */
export function generateDeviceIdentity(): { id: string; publicKey: string; privateKey: string } {
  const id = `dev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // Generate ECDH key pair for sync
  const ecdh = crypto.createECDH('secp256k1');
  ecdh.generateKeys();

  return {
    id,
    publicKey: ecdh.getPublicKey('base64'),
    privateKey: ecdh.getPrivateKey('base64'),
  };
}

/**
 * Get device fingerprint for QR code
 */
export function getDeviceFingerprint(publicKey: string): string {
  return crypto.createHash('sha256')
    .update(publicKey)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
}

/**
 * Create sync package for export
 */
export async function createSyncPackage(deviceId: string, password: string): Promise<SyncPackage> {
  const db = getDatabase();

  // Export all data
  const tables = ['transactions', 'accounts', 'budgets', 'members', 'recurring_transactions', 'savings_goals', 'investment_accounts'];
  const data: Record<string, unknown[]> = {};

  for (const table of tables) {
    const stmt = db.prepare(`SELECT * FROM ${table}`);
    const rows: unknown[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    data[table] = rows;
  }

  // Serialize and encrypt
  const jsonData = JSON.stringify(data);
  const checksum = crypto.createHash('sha256').update(jsonData).digest('hex');

  // Derive key from password
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

  // Encrypt
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(jsonData, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return {
    version: SYNC_VERSION,
    deviceId,
    timestamp: new Date().toISOString(),
    checksum,
    encryptedData: `${salt.toString('base64')}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`,
    nonce: crypto.randomBytes(16).toString('base64'),
  };
}

/**
 * Import sync package
 */
export async function importSyncPackage(
  pkg: SyncPackage,
  password: string,
  mergeStrategy: 'replace' | 'merge' = 'merge'
): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Decrypt
    const [saltB64, ivB64, authTagB64, encrypted] = pkg.encryptedData.split(':');
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    // Verify checksum
    const checksum = crypto.createHash('sha256').update(decrypted).digest('hex');
    if (checksum !== pkg.checksum) {
      return { success: false, imported: 0, errors: ['Checksum mismatch - data may be corrupted'] };
    }

    const data = JSON.parse(decrypted) as Record<string, Array<Record<string, unknown>>>;
    const db = getDatabase();
    let imported = 0;

    // Import each table
    for (const [table, rows] of Object.entries(data)) {
      for (const row of rows) {
        try {
          const columns = Object.keys(row);
          const placeholders = columns.map(() => '?').join(', ');

          if (mergeStrategy === 'replace') {
            const stmt = db.prepare(
              `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
            );
            stmt.run(Object.values(row));
            stmt.free();
          } else {
            // Merge: skip if ID exists
            const idColumn = columns.find(c => c === 'id');
            if (idColumn && row[idColumn]) {
              const checkStmt = db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`);
              checkStmt.bind([row[idColumn]]);
              const exists = checkStmt.step();
              checkStmt.free();

              if (!exists) {
                const stmt = db.prepare(
                  `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
                );
                stmt.run(Object.values(row));
                stmt.free();
                imported++;
              }
            }
          }
        } catch (err) {
          errors.push(`Failed to import row in ${table}: ${err}`);
        }
      }
    }

    return { success: true, imported, errors };
  } catch (err) {
    return { success: false, imported: 0, errors: [`Decryption failed: ${err}`] };
  }
}

/**
 * Export sync package to file
 */
export async function exportSyncFile(deviceId: string, password: string, filePath: string): Promise<void> {
  const pkg = await createSyncPackage(deviceId, password);
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2));
}

/**
 * Import sync package from file
 */
export async function importSyncFile(filePath: string, password: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const pkg = JSON.parse(content) as SyncPackage;
  return importSyncPackage(pkg, password);
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<SyncState> {
  const db = getDatabase();

  // Get last sync time
  const stmt = db.prepare("SELECT value FROM settings WHERE key = 'last_sync_at'");
  const lastSyncAt = stmt.step() ? (stmt.getAsObject() as { value: string }).value : null;
  stmt.free();

  // Count pending changes (transactions modified since last sync)
  let pendingChanges = 0;
  if (lastSyncAt) {
    const pendingStmt = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE updated_at > ?');
    pendingStmt.bind([lastSyncAt]);
    pendingStmt.step();
    pendingChanges = (pendingStmt.getAsObject() as { count: number }).count;
    pendingStmt.free();
  }

  return {
    lastSyncAt,
    devices: [], // TODO: Load from devices table
    pendingChanges,
  };
}

/**
 * Save device info
 */
export async function saveDevice(device: SyncDevice): Promise<void> {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sync_devices (id, name, public_key, fingerprint, paired_at, last_sync_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    device.id,
    device.name,
    device.publicKey,
    device.fingerprint,
    device.pairedAt,
    device.lastSyncAt || null,
  ]);
  stmt.free();
}
