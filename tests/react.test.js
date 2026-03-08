const test = require('node:test');
const assert = require('node:assert/strict');

test('testing-library is available', () => {
  const { render, screen, fireEvent, waitFor } = require('@testing-library/react');
  assert.ok(render !== undefined, 'render should be available');
  assert.ok(screen !== undefined, 'screen should be available');
  assert.ok(fireEvent !== undefined, 'fireEvent should be available');
  assert.ok(waitFor !== undefined, 'waitFor should be available');
});

test('Electron API mock can be defined', () => {
  global.window = global.window || {};
  global.window.electronAPI = {
    getTransactions: () => Promise.resolve({ items: [], totalCount: 0 }),
  };
  assert.ok(global.window.electronAPI !== undefined, 'electronAPI should be defined');
  assert.ok(global.window.electronAPI.getTransactions !== undefined, 'getTransactions should be defined');
});
