const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function buildAlipayCsv(amount, orderSuffix) {
  return [
    '交易号,商家订单号,交易创建时间,付款时间,类型,交易对方,商品名称,金额（元）,收/支,备注',
    `20260101000${orderSuffix},ORD-A${orderSuffix},2026-01-02 10:05:00,2026-01-02 10:05:10,消费,麦当劳,早餐,${amount.toFixed(
      2
    )},支出,`,
  ].join('\n');
}

function waitForOutput(state, pattern, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (state.output.includes(pattern)) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for output "${pattern}".\nOutput:\n${state.output}`));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

function waitForExit(child, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for watch process to exit')), timeoutMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}

test('import --watch-dir imports only new CSV files and exits gracefully on Ctrl+C', { timeout: 25000 }, async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expense-watch-test-'));
  const watchDir = path.join(rootDir, 'watch');
  const sourceDir = path.join(rootDir, 'source');
  const dbPath = path.join(rootDir, 'watch.db');
  fs.mkdirSync(watchDir, { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });

  const existingCsvPath = path.join(watchDir, 'existing_alipay.csv');
  fs.writeFileSync(existingCsvPath, buildAlipayCsv(10, 1), 'utf-8');

  const newCsvOutsidePath = path.join(sourceDir, 'new_AlIPaY.csv');
  fs.writeFileSync(newCsvOutsidePath, buildAlipayCsv(20, 2), 'utf-8');

  const child = spawn('node', ['dist/cli.js', 'import', '--watch-dir', watchDir], {
    cwd: process.cwd(),
    env: { ...process.env, EXPENSE_DB_PATH: dbPath },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const state = { output: '' };
  child.stdout.setEncoding('utf-8');
  child.stderr.setEncoding('utf-8');
  child.stdout.on('data', (chunk) => {
    state.output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    state.output += chunk;
  });

  try {
    await waitForOutput(state, 'watching dir=');

    const copiedPath = path.join(watchDir, 'copied_AlIPaY.csv');
    fs.copyFileSync(newCsvOutsidePath, copiedPath);

    await waitForOutput(state, 'file=copied_AlIPaY.csv');
    await waitForOutput(state, 'imported=1');

    child.kill('SIGINT');
    const exited = await waitForExit(child);
    assert.equal(exited.signal, null);
    assert.equal(exited.code, 0);
    assert.match(state.output, /shutting down watcher/i);

    const listResult = spawn('node', ['dist/cli.js', 'list', '--limit', '10'], {
      cwd: process.cwd(),
      env: { ...process.env, EXPENSE_DB_PATH: dbPath },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let listOut = '';
    listResult.stdout.setEncoding('utf-8');
    listResult.stderr.setEncoding('utf-8');
    listResult.stdout.on('data', (chunk) => {
      listOut += chunk;
    });
    listResult.stderr.on('data', (chunk) => {
      listOut += chunk;
    });
    const listExit = await waitForExit(listResult);
    assert.equal(listExit.code, 0);
    assert.match(listOut, /count=1/);
    assert.doesNotMatch(listOut, /10(\.0+)?/);
    assert.match(listOut, /20(\.0+)?/);
  } finally {
    if (!child.killed) {
      child.kill('SIGINT');
    }
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
