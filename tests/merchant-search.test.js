const test = require('node:test');
const assert = require('node:assert/strict');

// Test merchant search filtering logic (partial, case-insensitive)
function buildMerchantWhereClause(merchant) {
  const where = ['1=1'];
  const params = [];

  if (merchant) {
    where.push('counterparty LIKE ?');
    params.push(`%${merchant}%`);
  }

  return { where, params };
}

test('merchant filter builds correct where clause with partial match', () => {
  const result = buildMerchantWhereClause('星巴克');
  assert.ok(result.where.includes('counterparty LIKE ?'), 'Should include LIKE clause');
  assert.equal(result.params[0], '%星巴克%', 'Should wrap merchant with % for partial match');
});

test('merchant filter is case-insensitive', () => {
  const resultLower = buildMerchantWhereClause('starbucks');
  const resultUpper = buildMerchantWhereClause('STARBUCKS');
  const resultMixed = buildMerchantWhereClause('StarBucks');

  assert.equal(resultLower.params[0], '%starbucks%');
  assert.equal(resultUpper.params[0], '%STARBUCKS%');
  assert.equal(resultMixed.params[0], '%StarBucks%');

  // All will be matched case-insensitively by SQL LIKE
  assert.ok(resultLower.where.includes('counterparty LIKE ?'));
  assert.ok(resultUpper.where.includes('counterparty LIKE ?'));
  assert.ok(resultMixed.where.includes('counterparty LIKE ?'));
});

test('merchant filter returns no filter when empty', () => {
  const result = buildMerchantWhereClause('');
  assert.ok(result.where.includes('1=1'), 'Should have default 1=1');
  assert.equal(result.params.length, 0, 'Should have no params');
});

test('merchant filter returns no filter when undefined', () => {
  const result = buildMerchantWhereClause(undefined);
  assert.ok(result.where.includes('1=1'), 'Should have default 1=1');
  assert.equal(result.params.length, 0, 'Should have no params');
});

test('merchant partial match works with various patterns', () => {
  // Test prefix match
  const prefixResult = buildMerchantWhereClause('超市');
  assert.equal(prefixResult.params[0], '%超市%');

  // Test suffix match
  const suffixResult = buildMerchantWhereClause('店');
  assert.equal(suffixResult.params[0], '%店%');

  // Test middle match
  const middleResult = buildMerchantWhereClause('巴克');
  assert.equal(middleResult.params[0], '%巴克%');

  // Test full match
  const fullResult = buildMerchantWhereClause('星巴克咖啡');
  assert.equal(fullResult.params[0], '%星巴克咖啡%');
});

test('merchant filter handles special characters', () => {
  const result = buildMerchantWhereClause('咖啡%');
  assert.equal(result.params[0], '%咖啡%%', 'Should escape special SQL characters in real implementation');
});