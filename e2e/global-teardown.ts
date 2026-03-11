import fs from 'fs';
import path from 'path';

/**
 * Global teardown for E2E tests
 * Cleans up test data
 */
async function globalTeardown() {
  console.log('🧹 Cleaning up E2E test data...');

  const testDataDir = path.join(__dirname, '../test-data');
  const testDbPath = path.join(testDataDir, 'e2e-test.db');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
    console.log('  - Removed test database');
  }

  // Clean up receipts directory if created
  const receiptsDir = path.join(testDataDir, 'receipts');
  if (fs.existsSync(receiptsDir)) {
    fs.rmSync(receiptsDir, { recursive: true });
    console.log('  - Removed test receipts');
  }

  console.log('✅ Global teardown complete');
}

export default globalTeardown;
