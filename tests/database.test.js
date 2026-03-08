const test = require('node:test');
const assert = require('node:assert/strict');

// Simple database tests that don't require shared state
// These test the core database functions by checking that they throw
// appropriate errors when the database isn't initialized

test('Database throws before initialization', () => {
  // This will fail because database isn't initialized
  // which is the expected behavior
  try {
    const db = require('../dist/main/database').getDatabase();
    assert.ok(false, 'Should have thrown');
  } catch (e) {
    assert.ok(e.message.includes('not initialized'), 'Should throw initialization error');
  }
});

test('Database functions exist', () => {
  const db = require('../dist/main/database');
  
  // Check that all expected functions exist
  assert.ok(typeof db.getDatabase === 'function', 'getDatabase exists');
  assert.ok(typeof db.getDatabasePath === 'function', 'getDatabasePath exists');
  assert.ok(typeof db.saveDatabase === 'function', 'saveDatabase exists');
  assert.ok(typeof db.closeDatabase === 'function', 'closeDatabase exists');
  assert.ok(typeof db.getMembers === 'function', 'getMembers exists');
  assert.ok(typeof db.addMember === 'function', 'addMember exists');
  assert.ok(typeof db.updateMember === 'function', 'updateMember exists');
  assert.ok(typeof db.deleteMember === 'function', 'deleteMember exists');
  assert.ok(typeof db.getBudgets === 'function', 'getBudgets exists');
  assert.ok(typeof db.setBudget === 'function', 'setBudget exists');
  assert.ok(typeof db.deleteBudget === 'function', 'deleteBudget exists');
  assert.ok(typeof db.getBudgetSpending === 'function', 'getBudgetSpending exists');
  assert.ok(typeof db.getTransactionTags === 'function', 'getTransactionTags exists');
  assert.ok(typeof db.addTransactionTag === 'function', 'addTransactionTag exists');
  assert.ok(typeof db.removeTransactionTag === 'function', 'removeTransactionTag exists');
  assert.ok(typeof db.updateTransactionCurrency === 'function', 'updateTransactionCurrency exists');
  assert.ok(typeof db.setTransactionMember === 'function', 'setTransactionMember exists');
  assert.ok(typeof db.getMemberSpendingSummary === 'function', 'getMemberSpendingSummary exists');
  assert.ok(typeof db.learnAssignment === 'function', 'learnAssignment exists');
  assert.ok(typeof db.predictMember === 'function', 'predictMember exists');
  assert.ok(typeof db.getPatterns === 'function', 'getPatterns exists');
  assert.ok(typeof db.deletePattern === 'function', 'deletePattern exists');
  assert.ok(typeof db.clearAllPatterns === 'function', 'clearAllPatterns exists');
  assert.ok(typeof db.applyTriageRules === 'function', 'applyTriageRules exists');
  assert.ok(typeof db.autoApplyTriageRules === 'function', 'autoApplyTriageRules exists');
  assert.ok(typeof db.checkSimilarAssignments === 'function', 'checkSimilarAssignments exists');
  assert.ok(typeof db.batchAssignSimilar === 'function', 'batchAssignSimilar exists');
  assert.ok(typeof db.getEmailAccounts === 'function', 'getEmailAccounts exists');
  assert.ok(typeof db.addEmailAccount === 'function', 'addEmailAccount exists');
  assert.ok(typeof db.deleteEmailAccount === 'function', 'deleteEmailAccount exists');
  assert.ok(typeof db.getEmailMessages === 'function', 'getEmailMessages exists');
  assert.ok(typeof db.saveEmailMessage === 'function', 'saveEmailMessage exists');
  assert.ok(typeof db.markEmailAsProcessed === 'function', 'markEmailAsProcessed exists');
  assert.ok(typeof db.getUnprocessedEmails === 'function', 'getUnprocessedEmails exists');
  // Account functions
  assert.ok(typeof db.getAccounts === 'function', 'getAccounts exists');
  assert.ok(typeof db.addAccount === 'function', 'addAccount exists');
  assert.ok(typeof db.updateAccount === 'function', 'updateAccount exists');
  assert.ok(typeof db.deleteAccount === 'function', 'deleteAccount exists');
  assert.ok(typeof db.setTransactionAccount === 'function', 'setTransactionAccount exists');
  assert.ok(typeof db.getAccountSpendingSummary === 'function', 'getAccountSpendingSummary exists');
  assert.ok(typeof db.updateAccountBalance === 'function', 'updateAccountBalance exists');
});

test('initDatabase function exists', () => {
  const db = require('../dist/main/database');
  assert.ok(typeof db.initDatabase === 'function', 'initDatabase exists');
});

test('memorized database module', () => {
  // The first require should have created the database module
  // Now we can check if the functions work with a mock
  const db = require('../dist/main/database');
  
  // After initDatabase is called (in other tests), these should work
  // For this test, we just verify the structure
  assert.ok(db, 'Database module loads correctly');
});
