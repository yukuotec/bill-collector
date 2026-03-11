import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Global setup for E2E tests
 * Builds the app and prepares test environment
 */
async function globalSetup() {
  console.log('🔧 Building app for E2E tests...');

  // Build the application
  execSync('npm run build', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });

  // Create test data directory
  const testDataDir = path.join(__dirname, '../test-data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Clean up any previous test database
  const testDbPath = path.join(testDataDir, 'e2e-test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Seed test data
  console.log('🌱 Seeding test data...');
  const seedScript = `
    const { initDatabase } = require('./dist/main/database');
    const { addMember, addAccount, insertTransactions } = require('./dist/main/database');

    async function seed() {
      await initDatabase();

      // Add test member
      addMember('member-1', 'Test User', '#3B82F6');

      // Add test account
      addAccount('account-1', 'Test Bank', 'bank', 10000, '#EF4444');

      // Add test transactions
      const transactions = [
        {
          id: 'txn-1',
          source: 'manual',
          date: new Date().toISOString().split('T')[0],
          amount: -45.00,
          type: 'expense',
          counterparty: 'Starbucks',
          description: 'Coffee',
          category: '餐饮',
          member_id: 'member-1',
          account_id: 'account-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'txn-2',
          source: 'manual',
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          amount: -120.00,
          type: 'expense',
          counterparty: 'Grocery Store',
          description: 'Weekly groceries',
          category: '购物',
          member_id: 'member-1',
          account_id: 'account-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      insertTransactions(transactions);
      console.log('Test data seeded successfully');
    }

    seed().catch(console.error);
  `;

  fs.writeFileSync(path.join(__dirname, 'seed.js'), seedScript);
  execSync('node e2e/seed.js', { cwd: path.join(__dirname, '..') });
  fs.unlinkSync(path.join(__dirname, 'seed.js'));

  console.log('✅ Global setup complete');
}

export default globalSetup;
