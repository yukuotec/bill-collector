const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set up test database path
const testDbDir = path.join(os.tmpdir(), `account-test-${Date.now()}`);
fs.mkdirSync(testDbDir, { recursive: true });
process.env.EXPENSE_DB_PATH = path.join(testDbDir, 'test.db');

// Import database functions
const {
  initDatabase,
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  setTransactionAccount,
  getAccountSpendingSummary,
  updateAccountBalance,
  insertTransactions,
  closeDatabase,
} = require('../dist/main/database');

// Initialize database before tests
let db;
test('Initialize database', async () => {
  await initDatabase();
  db = require('../dist/main/database').getDatabase();
  assert.ok(db, 'Database should be initialized');
});

test('Account CRUD operations', async () => {
  // Test getAccounts returns empty array initially
  const initialAccounts = getAccounts();
  assert.ok(Array.isArray(initialAccounts), 'getAccounts should return an array');

  // Test addAccount
  const testAccount = {
    id: 'test-account-1',
    name: 'Test Bank Account',
    type: 'bank',
    balance: 1000.50,
    color: '#3B82F6',
  };

  addAccount(testAccount.id, testAccount.name, testAccount.type, testAccount.balance, testAccount.color);

  // Verify account was added
  let accounts = getAccounts();
  assert.strictEqual(accounts.length, 1, 'Should have one account');
  assert.strictEqual(accounts[0].id, testAccount.id, 'Account ID should match');
  assert.strictEqual(accounts[0].name, testAccount.name, 'Account name should match');
  assert.strictEqual(accounts[0].type, testAccount.type, 'Account type should match');
  assert.strictEqual(accounts[0].balance, testAccount.balance, 'Account balance should match');
  assert.strictEqual(accounts[0].color, testAccount.color, 'Account color should match');

  // Test updateAccount
  const newName = 'Updated Bank Account';
  const newType = 'credit';
  const newBalance = 2000.75;
  const newColor = '#EF4444';

  updateAccount(testAccount.id, newName, newType, newBalance, newColor);

  accounts = getAccounts();
  assert.strictEqual(accounts[0].name, newName, 'Account name should be updated');
  assert.strictEqual(accounts[0].type, newType, 'Account type should be updated');
  assert.strictEqual(accounts[0].balance, newBalance, 'Account balance should be updated');
  assert.strictEqual(accounts[0].color, newColor, 'Account color should be updated');

  // Test updateAccountBalance
  const updatedBalance = 5000.00;
  updateAccountBalance(testAccount.id, updatedBalance);

  accounts = getAccounts();
  assert.strictEqual(accounts[0].balance, updatedBalance, 'Account balance should be updated via updateAccountBalance');

  // Test deleteAccount
  deleteAccount(testAccount.id);

  accounts = getAccounts();
  assert.strictEqual(accounts.length, 0, 'Account should be deleted');
});

test('Account with transaction assignment', async () => {
  // Create test account
  const accountId = 'account-transaction-test';
  addAccount(accountId, 'Transaction Test Account', 'bank', 0, '#10B981');

  // Insert a test transaction
  const testTransaction = {
    id: 'txn-test-1',
    source: 'alipay',
    date: '2024-03-01',
    amount: 100,
    type: 'expense',
    counterparty: 'Test Merchant',
    category: 'Test Category',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  insertTransactions([testTransaction]);

  // Test setTransactionAccount
  setTransactionAccount(testTransaction.id, accountId);

  // Verify transaction has account_id set
  const db = require('../dist/main/database').getDatabase();
  const stmt = db.prepare('SELECT account_id FROM transactions WHERE id = ?');
  stmt.bind([testTransaction.id]);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();

  assert.strictEqual(row.account_id, accountId, 'Transaction should have account_id set');

  // Test unassigning account
  setTransactionAccount(testTransaction.id, null);

  const stmt2 = db.prepare('SELECT account_id FROM transactions WHERE id = ?');
  stmt2.bind([testTransaction.id]);
  stmt2.step();
  const row2 = stmt2.getAsObject();
  stmt2.free();

  assert.strictEqual(row2.account_id, null, 'Transaction account_id should be null after unassigning');

  // Clean up
  deleteAccount(accountId);
  db.run('DELETE FROM transactions WHERE id = ?', [testTransaction.id]);
});

test('Account spending summary', async () => {
  // Create test accounts
  const account1Id = 'account-summary-1';
  const account2Id = 'account-summary-2';

  addAccount(account1Id, 'Account One', 'bank', 0, '#3B82F6');
  addAccount(account2Id, 'Account Two', 'alipay', 0, '#EF4444');

  // Insert test transactions with different accounts
  const testDate = '2024-03-15';
  const transactions = [
    {
      id: 'txn-summary-1',
      source: 'alipay',
      date: testDate,
      amount: 100,
      type: 'expense',
      counterparty: 'Merchant A',
      category: 'Category A',
      account_id: account1Id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'txn-summary-2',
      source: 'alipay',
      date: testDate,
      amount: 200,
      type: 'expense',
      counterparty: 'Merchant B',
      category: 'Category B',
      account_id: account1Id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'txn-summary-3',
      source: 'wechat',
      date: testDate,
      amount: 150,
      type: 'expense',
      counterparty: 'Merchant C',
      category: 'Category C',
      account_id: account2Id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  insertTransactions(transactions);

  // Test getAccountSpendingSummary for year
  const yearSummary = getAccountSpendingSummary(2024);

  assert.ok(Array.isArray(yearSummary), 'Year summary should be an array');
  assert.strictEqual(yearSummary.length, 2, 'Should have two accounts in summary');

  // Find account summaries
  const account1Summary = yearSummary.find(s => s.accountId === account1Id);
  const account2Summary = yearSummary.find(s => s.accountId === account2Id);

  assert.ok(account1Summary, 'Account 1 should be in summary');
  assert.ok(account2Summary, 'Account 2 should be in summary');
  assert.strictEqual(account1Summary.total, 300, 'Account 1 should have total of 300');
  assert.strictEqual(account2Summary.total, 150, 'Account 2 should have total of 150');
  assert.strictEqual(account1Summary.accountName, 'Account One', 'Account name should match');
  assert.strictEqual(account1Summary.accountType, 'bank', 'Account type should match');

  // Test month-specific summary
  const monthSummary = getAccountSpendingSummary(2024, 3);

  assert.ok(Array.isArray(monthSummary), 'Month summary should be an array');
  const account1MonthSummary = monthSummary.find(s => s.accountId === account1Id);
  assert.ok(account1MonthSummary, 'Account 1 should be in month summary');
  assert.strictEqual(account1MonthSummary.total, 300, 'Account 1 month total should be 300');

  // Clean up
  const db = require('../dist/main/database').getDatabase();
  transactions.forEach(txn => {
    db.run('DELETE FROM transactions WHERE id = ?', [txn.id]);
  });
  deleteAccount(account1Id);
  deleteAccount(account2Id);
});

test('Account types', async () => {
  // Test all account types
  const accountTypes = ['bank', 'credit', 'cash', 'alipay', 'wechat', 'other'];

  accountTypes.forEach((type, index) => {
    const accountId = `account-type-${type}`;
    addAccount(accountId, `Test ${type}`, type, 0, '#3B82F6');

    const accounts = getAccounts();
    const account = accounts.find(a => a.id === accountId);
    assert.ok(account, `Account with type ${type} should exist`);
    assert.strictEqual(account.type, type, `Account type should be ${type}`);

    deleteAccount(accountId);
  });
});

test('Delete account preserves transactions', async () => {
  // Create account and assign transaction
  const accountId = 'account-delete-test';
  addAccount(accountId, 'Delete Test Account', 'bank', 0, '#8B5CF6');

  const testTransaction = {
    id: 'txn-delete-test',
    source: 'alipay',
    date: '2024-03-01',
    amount: 50,
    type: 'expense',
    counterparty: 'Test',
    category: 'Test',
    account_id: accountId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  insertTransactions([testTransaction]);
  setTransactionAccount(testTransaction.id, accountId);

  // Delete account
  deleteAccount(accountId);

  // Verify account is deleted
  const accounts = getAccounts();
  assert.strictEqual(accounts.find(a => a.id === accountId), undefined, 'Account should be deleted');

  // Verify transaction still exists but account_id is null
  const db = require('../dist/main/database').getDatabase();
  const stmt = db.prepare('SELECT account_id FROM transactions WHERE id = ?');
  stmt.bind([testTransaction.id]);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();

  assert.strictEqual(row.account_id, null, 'Transaction account_id should be null after account deletion');

  // Clean up
  db.run('DELETE FROM transactions WHERE id = ?', [testTransaction.id]);
});

test('Cleanup', () => {
  closeDatabase();

  // Clean up test database file
  if (fs.existsSync(process.env.EXPENSE_DB_PATH)) {
    fs.unlinkSync(process.env.EXPENSE_DB_PATH);
  }
});
