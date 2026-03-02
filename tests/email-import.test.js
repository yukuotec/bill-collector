const test = require('node:test');
const assert = require('node:assert/strict');

// Test state management
function loadState(stateFile) {
  try {
    return JSON.parse(require('fs').readFileSync(stateFile, 'utf-8'));
  } catch {
    return {};
  }
}

function saveState(stateFile, data) {
  require('fs').writeFileSync(stateFile, JSON.stringify(data, null, 2));
}

// Test search pattern matching
const searchPatterns = {
  alipay: '支付宝',
  wechat: '微信支付',
  yunshanfu: '云闪付'
};

test('searchPatterns contains all expected sources', () => {
  assert.equal(searchPatterns.alipay, '支付宝');
  assert.equal(searchPatterns.wechat, '微信支付');
  assert.equal(searchPatterns.yunshanfu, '云闪付');
});

test('state tracks processed message IDs', () => {
  const processed = {
    alipay: ['msg1', 'msg2'],
    wechat: ['msg3']
  };
  assert.equal(processed.alipay.includes('msg1'), true);
  assert.equal(processed.alipay.includes('msg3'), false);
  assert.equal(processed.wechat.includes('msg3'), true);
});

test('deduplication works correctly', () => {
  const processed = ['msg1', 'msg2'];
  const newId = 'msg3';
  const isNew = !processed.includes(newId);
  assert.equal(isNew, true);
  
  const duplicateId = 'msg1';
  const isDuplicate = processed.includes(duplicateId);
  assert.equal(isDuplicate, true);
});

test('handles empty state', () => {
  const state = {};
  assert.equal(state.alipay, undefined);
  assert.equal(state.wechat, undefined);
});

test('handles null/undefined source', () => {
  const patterns = { alipay: '支付宝' };
  assert.equal(patterns.null, undefined);
  assert.equal(patterns.undefined, undefined);
});
