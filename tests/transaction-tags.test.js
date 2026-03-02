const test = require('node:test');
const assert = require('node:assert/strict');

// Test tag parsing from JSON column
function parseTags(tagsJson) {
  if (!tagsJson) return [];
  try {
    return JSON.parse(tagsJson);
  } catch {
    return [];
  }
}

// Test tag formatting for storage
function formatTags(tags) {
  if (!tags || tags.length === 0) return null;
  return JSON.stringify(tags);
}

test('parseTags returns empty array for null', () => {
  assert.deepEqual(parseTags(null), []);
});

test('parseTags returns empty array for empty string', () => {
  assert.deepEqual(parseTags(''), []);
});

test('parseTags parses JSON array', () => {
  assert.deepEqual(parseTags('["food", "dinner"]'), ['food', 'dinner']);
});

test('parseTags handles invalid JSON gracefully', () => {
  assert.deepEqual(parseTags('not json'), []);
});

test('formatTags returns null for empty array', () => {
  assert.equal(formatTags([]), null);
});

test('formatTags returns null for undefined', () => {
  assert.equal(formatTags(undefined), null);
});

test('formatTags formats array as JSON', () => {
  assert.equal(formatTags(['work', 'expense']), '["work","expense"]');
});

test('formatTags handles single tag', () => {
  assert.equal(formatTags(['important']), '["important"]');
});

test('round-trip tags work correctly', () => {
  const original = ['business trip', 'client meeting'];
  const formatted = formatTags(original);
  const parsed = parseTags(formatted);
  assert.deepEqual(parsed, original);
});
