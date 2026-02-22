const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseDrilldownQuery,
  buildDrilldownQuery,
  parseHashLocation,
  getYearDateRange,
  removeDrilldownField,
} = require('../dist/shared/drilldown');
const { buildTransactionWhereClause } = require('../dist/main/ipcFilters');

test('parseDrilldownQuery parses category drill with date range', () => {
  const parsed = parseDrilldownQuery('?from=2026-01-01&to=2026-01-31&category=%E9%A4%90%E9%A5%AE&drill=1');
  assert.deepEqual(parsed, {
    from: '2026-01-01',
    to: '2026-01-31',
    category: '餐饮',
    drill: true,
  });
});

test('buildDrilldownQuery round-trips merchant drill', () => {
  const q = buildDrilldownQuery({ from: '2026-01-01', to: '2026-01-31', merchant: '麦当劳', drill: true });
  assert.equal(q, '?from=2026-01-01&to=2026-01-31&merchant=%E9%BA%A6%E5%BD%93%E5%8A%B3&drill=1');
});

test('parseHashLocation returns page and search from hash', () => {
  const out = parseHashLocation('#transactions?from=2026-01-01&to=2026-01-31');
  assert.deepEqual(out, { page: 'transactions', search: '?from=2026-01-01&to=2026-01-31' });
});

test('getYearDateRange returns full year bounds', () => {
  assert.deepEqual(getYearDateRange(2026), { from: '2026-01-01', to: '2026-12-31' });
});

test('buildTransactionWhereClause adds exact merchant condition', () => {
  const out = buildTransactionWhereClause({ merchant: '麦当劳' });
  assert.equal(out.where.includes('counterparty = ?'), true);
  assert.equal(out.params[0], '麦当劳');
});

test('removeDrilldownField removes one field and keeps others', () => {
  const next = removeDrilldownField('?from=2026-01-01&to=2026-01-31&merchant=%E9%BA%A6%E5%BD%93%E5%8A%B3&drill=1', 'merchant');
  assert.equal(next, '?from=2026-01-01&to=2026-01-31&drill=1');
});
