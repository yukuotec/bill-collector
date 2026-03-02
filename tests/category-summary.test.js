const test = require('node:test');
const assert = require('node:assert/strict');

// Test category data transformation
function transformCategoryData(rows) {
  if (!rows || rows.length === 0) return [];
  const total = rows.reduce((sum, row) => sum + (row.total || 0), 0);
  return rows.map(row => ({
    category: row.category,
    amount: row.total || 0,
    percentage: total > 0 ? Math.round((row.total / total) * 100) : 0
  })).sort((a, b) => b.amount - a.amount);
}

test('transformCategoryData returns empty for empty input', () => {
  assert.deepEqual(transformCategoryData([]), []);
});

test('transformCategoryData returns empty for null', () => {
  assert.deepEqual(transformCategoryData(null), []);
});

test('transformCategoryData calculates percentages correctly', () => {
  const rows = [
    { category: '餐饮', total: 500 },
    { category: '交通', total: 300 },
    { category: '购物', total: 200 }
  ];
  const result = transformCategoryData(rows);
  assert.equal(result[0].percentage, 50);
  assert.equal(result[1].percentage, 30);
  assert.equal(result[2].percentage, 20);
});

test('transformCategoryData sorts by amount descending', () => {
  const rows = [
    { category: '购物', total: 100 },
    { category: '餐饮', total: 500 },
    { category: '交通', total: 300 }
  ];
  const result = transformCategoryData(rows);
  assert.equal(result[0].category, '餐饮');
  assert.equal(result[1].category, '交通');
  assert.equal(result[2].category, '购物');
});

test('transformCategoryData handles single category', () => {
  const rows = [{ category: '餐饮', total: 1000 }];
  const result = transformCategoryData(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].percentage, 100);
});

test('transformCategoryData handles zero total', () => {
  const rows = [
    { category: '餐饮', total: 0 },
    { category: '交通', total: 0 }
  ];
  const result = transformCategoryData(rows);
  assert.equal(result[0].percentage, 0);
  assert.equal(result[1].percentage, 0);
});
