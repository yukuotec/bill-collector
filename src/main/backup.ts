import fs from 'fs';
import path from 'path';
import { getDatabase, getDatabasePath } from './database';

export interface BackupInfo {
  id: string;
  filePath: string;
  createdAt: string;
  size: number;
  description: string;
}

export function getBackupDirectory(): string {
  const dbPath = getDatabasePath();
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

export function createBackup(description: string = 'Manual backup'): BackupInfo {
  const dbPath = getDatabasePath();
  const backupDir = getBackupDirectory();
  const id = `backup_${Date.now()}`;
  const filePath = path.join(backupDir, `${id}.db`);

  // Copy database file
  fs.copyFileSync(dbPath, filePath);

  const stats = fs.statSync(filePath);

  // Clean up old backups (keep last 30)
  cleanupOldBackups(30);

  return {
    id,
    filePath,
    createdAt: new Date().toISOString(),
    size: stats.size,
    description,
  };
}

export function listBackups(): BackupInfo[] {
  const backupDir = getBackupDirectory();
  const backups: BackupInfo[] = [];

  if (!fs.existsSync(backupDir)) {
    return backups;
  }

  const files = fs.readdirSync(backupDir);
  for (const file of files) {
    if (file.endsWith('.db')) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      backups.push({
        id: file.replace('.db', ''),
        filePath,
        createdAt: stats.mtime.toISOString(),
        size: stats.size,
        description: 'Auto backup',
      });
    }
  }

  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function restoreBackup(backupId: string): boolean {
  const backupDir = getBackupDirectory();
  const backupPath = path.join(backupDir, `${backupId}.db`);
  const dbPath = getDatabasePath();

  if (!fs.existsSync(backupPath)) {
    return false;
  }

  // Create emergency backup first
  createBackup('Pre-restore emergency backup');

  // Restore
  fs.copyFileSync(backupPath, dbPath);
  return true;
}

export function deleteBackup(backupId: string): boolean {
  const backupDir = getBackupDirectory();
  const backupPath = path.join(backupDir, `${backupId}.db`);

  if (!fs.existsSync(backupPath)) {
    return false;
  }

  fs.unlinkSync(backupPath);
  return true;
}

function cleanupOldBackups(keepCount: number): void {
  const backups = listBackups();
  if (backups.length > keepCount) {
    const toDelete = backups.slice(keepCount);
    for (const backup of toDelete) {
      fs.unlinkSync(backup.filePath);
    }
  }
}

export function scheduleAutoBackup(): void {
  // This would be called periodically (e.g., daily)
  const lastBackup = listBackups()[0];
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (!lastBackup || Date.now() - new Date(lastBackup.createdAt).getTime() > oneDayMs) {
    createBackup('Daily auto backup');
  }
}
