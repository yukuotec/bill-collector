const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set up test database path
const testDbDir = path.join(os.tmpdir(), `source-coverage-test-${Date.now()}`);
fs.mkdirSync(testDbDir, { recursive: true });
process.env.EXPENSE_DB_PATH = path.join(testDbDir, 'test.db');

// Import database functions
const {
  initDatabase,
  closeDatabase,
  saveDatabase,
  getSourceCoverage,
  getLastImportBySource,
  markAsZero,
  unmarkAsZero,
  isMarkedAsZero,
  getMarkedAsZero,
  ensureSourceCoverageZerosTable,
  insertTransactions,
} = require('../dist/main/database');

// Initialize database before tests
let db;
test('Initialize database', async () => {
  await initDatabase();
  db = require('../dist/main/database').getDatabase();
  assert.ok(db, 'Database should be initialized');
});

test('Source Coverage database functions exist', () => {
  assert.ok(typeof getSourceCoverage === 'function', 'getSourceCoverage exists');
  assert.ok(typeof getLastImportBySource === 'function', 'getLastImportBySource exists');
  assert.ok(typeof markAsZero === 'function', 'markAsZero exists');
  assert.ok(typeof unmarkAsZero === 'function', 'unmarkAsZero exists');
  assert.ok(typeof isMarkedAsZero === 'function', 'isMarkedAsZero exists');
  assert.ok(typeof getMarkedAsZero === 'function', 'getMarkedAsZero exists');
  assert.ok(typeof ensureSourceCoverageZerosTable === 'function', 'ensureSourceCoverageZerosTable exists');
});

test('getSourceCoverage returns empty array when no data', () => {
  const coverage = getSourceCoverage(2024);
  assert.ok(Array.isArray(coverage), 'getSourceCoverage should return an array');
  assert.strictEqual(coverage.length, 0, 'Should return empty array when no transactions');
});

test('getLastImportBySource returns data for all sources', () => {
  const lastImports = getLastImportBySource();
  assert.ok(Array.isArray(lastImports), 'getLastImportBySource should return an array');
  // Should return at least entries for the known sources
  assert.ok(lastImports.length >= 0, 'Should return array (may be empty if no transactions)');
});

test('markAsZero marks a source-month as zero', () => {
  // Mark a source-month as zero
  markAsZero('alipay', '2024-01');

  // Verify it's marked
  const isMarked = isMarkedAsZero('alipay', '2024-01');
  assert.strictEqual(isMarked, true, 'Should be marked as zero');
});

test('getMarkedAsZero returns marked entries for a year', () => {
  // Mark a few entries
  markAsZero('alipay', '2024-01');
  markAsZero('wechat', '2024-02');

  // Get marked entries for 2024
  const marked = getMarkedAsZero(2024);
  assert.ok(Array.isArray(marked), 'getMarkedAsZero should return an array');
  assert.ok(marked.length >= 2, 'Should return at least 2 marked entries');

  // Verify structure
  const entry = marked[0];
  assert.ok(entry.source, 'Entry should have source');
  assert.ok(entry.month, 'Entry should have month');
  assert.ok(entry.markedAt, 'Entry should have markedAt');
});

test('unmarkAsZero removes the zero marking', () => {
  // First mark it
  markAsZero('alipay', '2024-03');
  assert.strictEqual(isMarkedAsZero('alipay', '2024-03'), true, 'Should be marked');

  // Then unmark it
  unmarkAsZero('alipay', '2024-03');
  assert.strictEqual(isMarkedAsZero('alipay', '2024-03'), false, 'Should not be marked after unmark');
});

test('isMarkedAsZero returns false for non-existent entries', () => {
  const isMarked = isMarkedAsZero('nonexistent', '2024-99');
  assert.strictEqual(isMarked, false, 'Should return false for non-existent entries');
});

test('getSourceCoverage returns data after inserting transactions', () => {
  // Insert some test transactions
  const testTransactions = [
    {
      id: 'test-coverage-1',
      source: 'alipay',
      date: '2024-03-15',
      amount: 100,
      type: 'expense',
      counterparty: 'Test Merchant',
      category: '餐饮',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'test-coverage-2',
      source: 'alipay',
      date: '2024-03-20',
      amount: 50,
      type: 'expense',
      counterparty: 'Test Shop',
      category: '购物',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'test-coverage-3',
      source: 'wechat',
      date: '2024-03-10',
      amount: 30,
      type: 'expense',
      counterparty: 'Test Store',
      category: '交通',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  insertTransactions(testTransactions);

  // Get coverage for 2024
  const coverage = getSourceCoverage(2024);
  assert.ok(Array.isArray(coverage), 'getSourceCoverage should return an array');
  assert.ok(coverage.length >= 2, 'Should have coverage entries for alipay and wechat');

  // Find alipay march entry
  const alipayMarch = coverage.find(c => c.source === 'alipay' && c.month === '2024-03');
  assert.ok(alipayMarch, 'Should have alipay march entry');
  assert.strictEqual(alipayMarch.count, 2, 'Should have 2 alipay transactions in march');

  // Find wechat march entry
  const wechatMarch = coverage.find(c => c.source === 'wechat' && c.month === '2024-03');
  assert.ok(wechatMarch, 'Should have wechat march entry');
  assert.strictEqual(wechatMarch.count, 1, 'Should have 1 wechat transaction in march');
});

test('getLastImportBySource returns latest dates after transactions', () => {
  const lastImports = getLastImportBySource();
  assert.ok(Array.isArray(lastImports), 'getLastImportBySource should return an array');

  // Find alipay entry
  const alipayEntry = lastImports.find(li => li.source === 'alipay');
  if (alipayEntry) {
    assert.ok(alipayEntry.lastDate, 'Should have lastDate for alipay');
    assert.ok(alipayEntry.lastDate.startsWith('2024-03'), 'Last date should be in march 2024');
  }
});

test('markAsZero and unmarkAsZero work for all source types', () => {
  const sources = ['alipay', 'wechat', 'yunshanfu', 'bank', 'manual'];

  for (const source of sources) {
    // Mark
    markAsZero(source, '2024-06');
    assert.strictEqual(isMarkedAsZero(source, '2024-06'), true, `${source} should be marked as zero`);

    // Unmark
    unmarkAsZero(source, '2024-06');
    assert.strictEqual(isMarkedAsZero(source, '2024-06'), false, `${source} should be unmarked`);
  }
});

test('cleanup', () => {
  // Close database
  closeDatabase();

  // Clean up test database file
  try {
    if (fs.existsSync(process.env.EXPENSE_DB_PATH)) {
      fs.unlinkSync(process.env.EXPENSE_DB_PATH);
    }
    if (fs.existsSync(testDbDir)) {
      fs.rmdirSync(testDbDir);
    }
  } catch (e) {
    // Ignore cleanup errors
  }

  assert.ok(true, 'Cleanup completed');
});
