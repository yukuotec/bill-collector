const test = require('node:test');
const assert = require('node:assert/strict');

// Test source parsing
function parseSource(source) {
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [source];
  } catch {
    return [source];
  }
}

// Test source merging
function mergeSource(currentSource, newSource) {
  const sources = parseSource(currentSource);
  if (!sources.includes(newSource)) {
    sources.push(newSource);
  }
  return sources;
}

test('parseSource returns empty array for null', () => {
  assert.deepEqual(parseSource(null), []);
});

test('parseSource parses JSON array', () => {
  assert.deepEqual(parseSource('["alipay","bank"]'), ['alipay', 'bank']);
});

test('parseSource handles plain string', () => {
  assert.deepEqual(parseSource('alipay'), ['alipay']);
});

test('mergeSource adds new source', () => {
  const result = mergeSource('alipay', 'bank');
  assert.deepEqual(result, ['alipay', 'bank']);
});

test('mergeSource avoids duplicates', () => {
  const result = mergeSource('["alipay","bank"]', 'alipay');
  assert.deepEqual(result, ['alipay', 'bank']);
});

test('mergeSource handles empty', () => {
});
