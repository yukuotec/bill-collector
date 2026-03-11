const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set up test environment
process.env.NODE_ENV = 'test';
const testDbPath = path.join(os.tmpdir(), `expense-test-investment-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;

// Import after setting env
const {
  initDatabase,
  closeDatabase,
  getInvestmentAccounts,
  addInvestmentAccount,
  updateInvestmentAccount,
  updateInvestmentPrice,
  deleteInvestmentAccount,
  getInvestmentTransactions,
  addInvestmentTransaction,
  deleteInvestmentTransaction,
  getInvestmentSummary
} = require('../dist/main/database.js');

describe('Investment Feature Tests', () => {
  before(async () => {
    await initDatabase();
  });

  after(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Investment Account Management', () => {
    it('should add, update, price, and delete an investment account', async () => {
      const id = `inv-test-${Date.now()}`;

      // Add
      addInvestmentAccount(id, 'Test Stock', 'stock', 'TEST', 'CNY', 'Test Broker', 'Test investment');
      let accounts = getInvestmentAccounts();
      assert.strictEqual(accounts.length, 1);
      assert.strictEqual(accounts[0].name, 'Test Stock');

      // Update
      updateInvestmentAccount(id, 'Updated Stock', 'stock', 'UPDATED', 'CNY', 'New Broker', 'Updated notes');
      accounts = getInvestmentAccounts();
      assert.strictEqual(accounts[0].name, 'Updated Stock');
      assert.strictEqual(accounts[0].symbol, 'UPDATED');

      // Update price
      updateInvestmentPrice(id, 60.00);
      accounts = getInvestmentAccounts();
      assert.strictEqual(accounts[0].current_price, 60.00);

      // Summary (should be 0 since no transactions)
      const summary = getInvestmentSummary();
      assert.strictEqual(summary.totalCost, 0);

      // Delete
      deleteInvestmentAccount(id);
      accounts = getInvestmentAccounts();
      assert.strictEqual(accounts.length, 0);
    });
  });

  describe('Investment Transaction Management', () => {
    it('should handle buy/sell transactions', async () => {
      const accountId = `inv-txn-${Date.now()}`;

      // Add account
      addInvestmentAccount(accountId, 'Transaction Test', 'stock', 'TXN', 'CNY', 'Test Broker', '');

      // Buy transaction
      const buyId = `txn-buy-${Date.now()}`;
      addInvestmentTransaction(buyId, accountId, 'buy', 10, 100.00, 5.00, '2024-01-15', 'Test buy');
      let transactions = getInvestmentTransactions(accountId);
      assert.strictEqual(transactions.length, 1);
      assert.strictEqual(transactions[0].type, 'buy');

      // Sell transaction
      const sellId = `txn-sell-${Date.now()}`;
      addInvestmentTransaction(sellId, accountId, 'sell', 5, 110.00, 5.00, '2024-02-15', 'Test sell');
      transactions = getInvestmentTransactions(accountId);
      assert.strictEqual(transactions.length, 2);

      // Delete transactions
      deleteInvestmentTransaction(buyId);
      deleteInvestmentTransaction(sellId);
      transactions = getInvestmentTransactions(accountId);
      assert.strictEqual(transactions.length, 0);

      // Cleanup
      deleteInvestmentAccount(accountId);
    });
  });

  describe('Investment Calculations', () => {
    it('should calculate gains correctly', async () => {
      const acc1 = `calc-1-${Date.now()}`;
      const acc2 = `calc-2-${Date.now()}`;

      // Add accounts
      addInvestmentAccount(acc1, 'Stock A', 'stock', 'STKA', 'CNY', 'Broker A', '');
      addInvestmentAccount(acc2, 'Fund B', 'fund', 'FNDB', 'CNY', 'Broker B', '');

      // Buy transactions
      addInvestmentTransaction(`txn-1-${Date.now()}`, acc1, 'buy', 100, 50, 0, '2024-01-01', '');
      addInvestmentTransaction(`txn-2-${Date.now()}`, acc2, 'buy', 200, 25, 0, '2024-01-01', '');

      // Update prices
      updateInvestmentPrice(acc1, 60);
      updateInvestmentPrice(acc2, 30);

      const summary = getInvestmentSummary();
      // Both accounts: Cost 5000, Value 6000 each
      assert.strictEqual(summary.totalCost, 10000);
      assert.strictEqual(summary.totalValue, 12000);
      assert.strictEqual(summary.totalGain, 2000);

      // Cleanup
      deleteInvestmentAccount(acc1);
      deleteInvestmentAccount(acc2);
    });
  });
});
