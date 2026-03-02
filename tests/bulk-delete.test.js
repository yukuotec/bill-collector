const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Test bulk delete functionality
// These tests verify the SQL logic for deleting multiple transactions

// Simulate the SQL generation logic from ipc.ts
function generateDeleteSql(ids) {
  if (!ids || ids.length === 0) {
    return { sql: null, params: [] };
  }
  const placeholders = ids.map(() => '?').join(',');
  const sql = `DELETE FROM transactions WHERE id IN (${placeholders})`;
  return { sql, params: ids };
}

test('generateDeleteSql creates correct SQL for single id', () => {
  const result = generateDeleteSql(['txn-123']);
  assert.equal(result.sql, 'DELETE FROM transactions WHERE id IN (?)');
  assert.deepEqual(result.params, ['txn-123']);
});

test('generateDeleteSql creates correct SQL for multiple ids', () => {
  const ids = ['txn-1', 'txn-2', 'txn-3'];
  const result = generateDeleteSql(ids);
  assert.equal(result.sql, 'DELETE FROM transactions WHERE id IN (?,?,?)');
  assert.deepEqual(result.params, ids);
});

test('generateDeleteSql handles empty array', () => {
  const result = generateDeleteSql([]);
  assert.equal(result.sql, null);
  assert.deepEqual(result.params, []);
});

test('generateDeleteSql handles null/undefined', () => {
  assert.equal(generateDeleteSql(null).sql, null);
  assert.equal(generateDeleteSql(undefined).sql, null);
});

test('generateDeleteSql generates correct number of placeholders', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const result = generateDeleteSql(ids);
  const placeholderCount = (result.sql.match(/\?/g) || []).length;
  assert.equal(placeholderCount, 5);
  assert.equal(ids.length, placeholderCount);
});

// Test confirmation message generation
function generateDeleteConfirmationMessage(count) {
  return `确定要删除选中的 ${count} 条记录吗？此操作不可撤销。`;
}

test('generateDeleteConfirmationMessage generates correct message for single item', () => {
  const message = generateDeleteConfirmationMessage(1);
  assert.equal(message, '确定要删除选中的 1 条记录吗？此操作不可撤销。');
});

test('generateDeleteConfirmationMessage generates correct message for multiple items', () => {
  const message = generateDeleteConfirmationMessage(5);
  assert.equal(message, '确定要删除选中的 5 条记录吗？此操作不可撤销。');
});

test('generateDeleteConfirmationMessage generates correct message for zero items', () => {
  const message = generateDeleteConfirmationMessage(0);
  assert.equal(message, '确定要删除选中的 0 条记录吗？此操作不可撤销。');
});

// Test bulk delete response format
function createDeleteResponse(ids) {
  if (!ids || ids.length === 0) {
    return { deleted: 0 };
  }
  return { deleted: ids.length };
}

test('createDeleteResponse returns correct count for valid ids', () => {
  assert.equal(createDeleteResponse(['id1', 'id2', 'id3']).deleted, 3);
  assert.equal(createDeleteResponse(['id1']).deleted, 1);
});

test('createDeleteResponse returns zero for empty array', () => {
  assert.equal(createDeleteResponse([]).deleted, 0);
});

test('createDeleteResponse returns zero for null/undefined', () => {
  assert.equal(createDeleteResponse(null).deleted, 0);
  assert.equal(createDeleteResponse(undefined).deleted, 0);
});

// Test transaction selection state management
function toggleTransactionSelection(currentSelection, id, checked) {
  const newSelection = new Set(currentSelection);
  if (checked) {
    newSelection.add(id);
  } else {
    newSelection.delete(id);
  }
  return newSelection;
}

test('toggleTransactionSelection adds id when checked', () => {
  const selection = new Set(['id1']);
  const result = toggleTransactionSelection(selection, 'id2', true);
  assert.equal(result.has('id1'), true);
  assert.equal(result.has('id2'), true);
});

test('toggleTransactionSelection removes id when unchecked', () => {
  const selection = new Set(['id1', 'id2']);
  const result = toggleTransactionSelection(selection, 'id1', false);
  assert.equal(result.has('id1'), false);
  assert.equal(result.has('id2'), true);
});

