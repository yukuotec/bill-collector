const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set up test environment
process.env.NODE_ENV = 'test';
const testDbPath = path.join(os.tmpdir(), `expense-test-savings-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;

// Import after setting env
const {
  initDatabase,
  closeDatabase,
  getSavingsGoals,
  addSavingsGoal,
  updateSavingsGoal,
  addToSavingsGoal,
  deleteSavingsGoal,
  getSavingsSummary
} = require('../dist/main/database.js');

describe('Savings Goals Feature Tests', () => {
  before(async () => {
    await initDatabase();
  });

  after(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Savings Goal CRUD', () => {
    it('should add, update, add money, and delete goals', async () => {
      const id1 = `goal-${Date.now()}-1`;
      const id2 = `goal-${Date.now()}-2`;

      // Add first goal
      addSavingsGoal(id1, 'Emergency Fund', 50000, '2024-12-31', '储蓄', '#10B981');
      let goals = getSavingsGoals();
      const goal1Added = goals.find(g => g.id === id1);
      assert.ok(goal1Added);
      assert.strictEqual(goal1Added.name, 'Emergency Fund');
      assert.strictEqual(goal1Added.target_amount, 50000);

      // Add second goal
      addSavingsGoal(id2, 'Vacation', 20000, '2024-06-30', '旅游', '#3B82F6');
      const goal2Added = getSavingsGoals().find(g => g.id === id2);
      assert.ok(goal2Added);

      // Update first goal
      updateSavingsGoal(id1, 'Emergency Fund (Updated)', 60000, 0, '2025-06-30', '储蓄', '#10B981', true);
      goals = getSavingsGoals();
      const goal1 = goals.find(g => g.id === id1);
      assert.strictEqual(goal1.name, 'Emergency Fund (Updated)');
      assert.strictEqual(goal1.target_amount, 60000);

      // Add money to goals
      addToSavingsGoal(id1, 10000);
      addToSavingsGoal(id2, 20000); // Complete this one
      goals = getSavingsGoals();
      const updatedGoal1 = goals.find(g => g.id === id1);
      const updatedGoal2 = goals.find(g => g.id === id2);
      assert.strictEqual(updatedGoal1.current_amount, 10000);
      assert.strictEqual(updatedGoal2.current_amount, 20000);

      // Delete goals
      deleteSavingsGoal(id1);
      deleteSavingsGoal(id2);
      const goal1Deleted = getSavingsGoals().find(g => g.id === id1);
      const goal2Deleted = getSavingsGoals().find(g => g.id === id2);
      assert.ok(!goal1Deleted);
      assert.ok(!goal2Deleted);
    });

    it('should calculate summary correctly', async () => {
      const id1 = `sum-1-${Date.now()}`;
      const id2 = `sum-2-${Date.now()}`;

      addSavingsGoal(id1, 'Goal 1', 50000, null, '储蓄', '#10B981');
      addSavingsGoal(id2, 'Goal 2', 20000, null, '旅游', '#3B82F6');

      // Add money to complete goal 2
      addToSavingsGoal(id2, 20000);

      const summary = getSavingsSummary();
      assert.ok(summary.totalGoals >= 2);
      assert.ok(summary.completedGoals >= 1);
      assert.ok(summary.totalTarget >= 70000);

      // Cleanup
      deleteSavingsGoal(id1);
      deleteSavingsGoal(id2);
    });
  });

  describe('Goal Features', () => {
    it('should handle goals without deadlines and over-saving', async () => {
      const id = `feature-${Date.now()}`;

      // Goal without deadline
      addSavingsGoal(id, 'General Savings', 100000, null, '储蓄', '#F59E0B');
      let goals = getSavingsGoals();
      const goal = goals.find(g => g.id === id);
      assert.ok(!goal.deadline);

      // Over-save
      addToSavingsGoal(id, 150000);
      goals = getSavingsGoals();
      const updated = goals.find(g => g.id === id);
      assert.ok(updated.current_amount > updated.target_amount);

      deleteSavingsGoal(id);
    });
  });
});
