const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAlipay } = require('../dist/parsers/alipay');
const { parseWechat } = require('../dist/parsers/wechat');
const { parseYunshanfu } = require('../dist/parsers/yunshanfu');

test('parseAlipay should parse real-world style CSV with preface and mixed transaction types', () => {
  const csv = [
    '\ufeff支付宝交易记录明细查询',
    '账号: test@example.com',
    '开始时间: 2026-01-01 结束时间: 2026-01-31',
    '交易号,商家订单号,交易创建时间,付款时间,类型,交易对方,商品名称,金额（元）,收/支,备注',
    '202601010001,ORD-A1,2026-01-02 10:05:00,2026-01-02 10:05:10,消费,麦当劳,早餐,18.50,支出,',
    '202601010002,ORD-A2,2026-01-03 08:10:00,2026-01-03 08:10:10,退款,麦当劳,退款,18.50,收入,',
    '202601010003,ORD-A3,2026/01/04 12:00:00,2026-01-04 12:00:05,转账,张三,转账,100.00,不计收支,',
  ].join('\n');

  const rows = parseAlipay(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].source, 'alipay');
  assert.equal(rows[0].date, '2026-01-02');
  assert.equal(rows[0].amount, 18.5);
  assert.equal(rows[0].type, 'expense');
  assert.equal(rows[1].type, 'income');
  assert.equal(rows[2].type, 'transfer');
});

test('parseAlipay should treat refund rows with 不计收支 as income', () => {
  const csv = [
    '导出信息：',
    '交易时间,交易分类,交易对方,商品说明,收/支,金额,交易状态,交易订单号',
    '2025-11-17 21:44:54,退款,高德顺风车,退款-高德顺风车订单,不计收支,57.87,退款成功,2025111722001460081449975742',
    '2025-11-17 09:00:00,餐饮美食,麦当劳,早餐,支出,18.50,交易成功,2025111722001460081000000000',
  ].join('\n');

  const rows = parseAlipay(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].type, 'income');
  assert.equal(rows[0].amount, 57.87);
  assert.equal(rows[1].type, 'expense');
});

test('parseWechat should find header after summary lines and infer flow type from 收/支', () => {
  const csv = [
    '\ufeff微信支付账单明细,,,,,,,,,,',
    '------------------------------------',
    '微信昵称：测试用户,,,,,,,,,,',
    '共3笔记录,,,,,,,,,,',
    '------------------------------------',
    '交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态,交易单号,商户单号,备注',
    '2026-02-01 09:01:00,二维码收款,李四,午饭,支出,23.00,支付成功,420000001,M20260201001,',
    '2026-02-02 18:20:00,转账收款,王五,转账,收入,88.00,已收款,420000002,M20260201002,',
    '2026-02-03 11:30:00,中性交易,微信零钱提现,提现,不计收支,50.00,提现成功,420000003,M20260201003,',
    '------------------------------------',
  ].join('\n');

  const rows = parseWechat(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].source, 'wechat');
  assert.equal(rows[0].date, '2026-02-01');
  assert.equal(rows[0].type, 'expense');
  assert.equal(rows[1].type, 'income');
  assert.equal(rows[2].type, 'transfer');
  assert.equal(rows[0].original_id, '420000001');
});

test('parseYunshanfu should parse header aliases and ignore non-data rows', () => {
  const csv = [
    '云闪付交易明细',
    '导出时间,2026-02-10',
    '交易时间,交易类型,交易对方,交易说明,收/支,交易金额,交易流水号,备注',
    '2026-02-08 13:20:00,消费,便利店,午餐,支出,12.80,YSF0001,',
    '2026-02-08 21:10:00,转账,朋友,AA收款,收入,45.00,YSF0002,',
    '2026-02-09 09:00:00,中性交易,银行卡,还款,不计收支,200.00,YSF0003,',
    '合计,3笔,,,,,,',
  ].join('\n');

  const rows = parseYunshanfu(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].source, 'yunshanfu');
  assert.equal(rows[0].type, 'expense');
  assert.equal(rows[1].type, 'income');
  assert.equal(rows[2].type, 'transfer');
  assert.equal(rows[2].original_id, 'YSF0003');
});
