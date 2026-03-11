const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set up test environment
process.env.NODE_ENV = 'test';
const testDbPath = path.join(os.tmpdir(), `expense-test-export-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;

describe('Export Feature Tests', () => {
  before(async () => {
    const { initDatabase } = require('../dist/main/database.js');
    await initDatabase();
  });

  after(() => {
    const { closeDatabase } = require('../dist/main/database.js');
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should have database module', () => {
    const db = require('../dist/main/database.js');
    assert.ok(db);
    assert.ok(typeof db.initDatabase === 'function');
    assert.ok(typeof db.closeDatabase === 'function');
  });

  it('should have export module', () => {
    // Check that export.ts exists and compiles
    const exportPath = path.join(__dirname, '../dist/main/export.js');
    assert.ok(fs.existsSync(exportPath), 'Export module should exist');
  });

  it('should have PDF export function', () => {
    // Verify export functions exist
    const exportPath = path.join(__dirname, '../dist/main/export.js');
    const exportContent = fs.readFileSync(exportPath, 'utf-8');
    assert.ok(exportContent.includes('generatePDFReport'), 'PDF export function should exist');
  });
});
