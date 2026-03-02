const test = require('node:test');
const assert = require('node:assert/strict');

// Mock duplicate map
function generateDuplicateReport(totalCount, duplicateMap) {
  let exact = 0;
  let samePeriod = 0;
  let crossPlatform = 0;
  
  for (const dup of duplicateMap.values()) {
    if (dup.type === 'exact') exact++;
    else if (dup.type === 'same_period') samePeriod++;
    else if (dup.type === 'cross_platform') crossPlatform++;
  }
  
  const duplicateCount = exact + samePeriod + crossPlatform;
  const ratio = totalCount > 0 ? (duplicateCount / totalCount) * 100 : 0;
  
  return { exact, samePeriod, crossPlatform, ratio: Math.round(ratio) };
}

test('generateDuplicateReport returns zero for empty map', () => {
  const map = new Map();
  const result = generateDuplicateReport(10, map);
  assert.equal(result.exact, 0);
  assert.equal(result.samePeriod, 0);
  assert.equal(result.crossPlatform, 0);
  assert.equal(result.ratio, 0);
});

test('generateDuplicateReport counts exact duplicates', () => {
  const map = new Map();
  map.set(0, { type: 'exact', targetId: 'id1' });
  map.set(1, { type: 'exact', targetId: 'id2' });
  const result = generateDuplicateReport(10, map);
  assert.equal(result.exact, 2);
  assert.equal(result.ratio, 20);
});

test('generateDuplicateReport counts same period duplicates', () => {
  const map = new Map();
  map.set(0, { type: 'same_period', targetId: 'id1' });
  map.set(1, { type: 'same_period', targetId: 'id2' });
  const result = generateDuplicateReport(10, map);
  assert.equal(result.samePeriod, 2);
  assert.equal(result.ratio, 20);
});

test('generateDuplicateReport counts cross platform duplicates', () => {
  const map = new Map();
  map.set(0, { type: 'cross_platform', targetId: 'id1' });
  const result = generateDuplicateReport(10, map);
  assert.equal(result.crossPlatform, 1);
  assert.equal(result.ratio, 10);
});

test('generateDuplicateReport calculates 80 percent threshold', () => {
  const map = new Map();
  for (let i = 0; i < 8; i++) {
    map.set(i, { type: 'exact', targetId: `id${i}` });
  }
  const result = generateDuplicateReport(10, map);
  assert.equal(result.ratio, 80);
});

test('generateDuplicateReport calculates above 80 percent', () => {
  const map = new Map();
  for (let i = 0; i < 9; i++) {
    map.set(i, { type: 'exact', targetId: `id${i}` });
  }
  const result = generateDuplicateReport(10, map);
  assert.equal(result.ratio, 90);
});

test('generateDuplicateReport handles mixed types', () => {
  const map = new Map();
  map.set(0, { type: 'exact', targetId: 'id1' });
  map.set(1, { type: 'same_period', targetId: 'id2' });
  map.set(2, { type: 'cross_platform', targetId: 'id3' });
  const result = generateDuplicateReport(10, map);
  assert.equal(result.exact, 1);
  assert.equal(result.samePeriod, 1);
  assert.equal(result.crossPlatform, 1);
  assert.equal(result.ratio, 30);
});

test('generateDuplicateReport handles zero total', () => {
  const map = new Map();
  const result = generateDuplicateReport(0, map);
  assert.equal(result.ratio, 0);
});
