const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function row(idSuffix, date, counterparty, amount) {
  return `20260101000${idSuffix},ORD-R${idSuffix},${date} 10:00:00,${date} 10:00:10,消费,${counterparty},自动扣费,${amount.toFixed(2)},支出,`;
}

test('recurring command classifies cadence using strict average-interval rule', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expense-recurring-test-'));
  const dbPath = path.join(rootDir, 'recurring.db');
  const csvPath = path.join(rootDir, 'input.csv');

  const rows = [
    '交易号,商家订单号,交易创建时间,付款时间,类型,交易对方,商品名称,金额（元）,收/支,备注',
    // weekly: avg interval 7
    row(1, '2026-01-01', 'Weekly Service', 10),
    row(2, '2026-01-08', 'Weekly Service', 10),
    row(3, '2026-01-15', 'Weekly Service', 10),
    row(4, '2026-01-22', 'Weekly Service', 10),
    // monthly: avg interval 30
    row(5, '2026-01-01', 'Monthly Service', 20),
    row(6, '2026-01-31', 'Monthly Service', 20),
    row(7, '2026-03-02', 'Monthly Service', 20),
    // other: avg interval 10
    row(8, '2026-01-01', 'Other Service', 30),
    row(9, '2026-01-06', 'Other Service', 30),
    row(10, '2026-01-21', 'Other Service', 30),
  ];
  fs.writeFileSync(csvPath, rows.join('\n'), 'utf-8');

  const env = { ...process.env, EXPENSE_DB_PATH: dbPath };
  execFileSync('node', ['dist/cli.js', 'import', csvPath, '--source', 'alipay'], { cwd: process.cwd(), env, stdio: 'pipe' });
  const recurringRaw = execFileSync('node', ['dist/cli.js', 'recurring'], { cwd: process.cwd(), env, encoding: 'utf-8' });
  const recurring = JSON.parse(recurringRaw);

  const byMerchant = new Map(recurring.items.map((item) => [item.counterparty, item.cadence]));
  assert.equal(byMerchant.get('Weekly Service'), 'weekly');
  assert.equal(byMerchant.get('Monthly Service'), 'monthly');
  assert.equal(byMerchant.get('Other Service'), 'other');

  fs.rmSync(rootDir, { recursive: true, force: true });
});
