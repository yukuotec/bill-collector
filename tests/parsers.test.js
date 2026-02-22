const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAlipay } = require('../dist/parsers/alipay');
const { parseBank } = require('../dist/parsers/bank');
const { parseWechat } = require('../dist/parsers/wechat');
const { parseYunshanfu } = require('../dist/parsers/yunshanfu');
const { parseBillText } = require('../dist/parsers/billText');
const { parseCmbcCreditCardText } = require('../dist/parsers/pdf');
const { parseAbcCreditCardText } = require('../dist/parsers/pdf');

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
  assert.equal(rows[1].is_refund, 1);
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
  assert.equal(rows[0].is_refund, 1);
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

test('parseWechat should mark English refund keywords as refund income', () => {
  const csv = [
    '交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态,交易单号,商户单号,备注',
    '2026-02-05 11:20:00,Payment refund,麦当劳,order refund,不计收支,23.00,已退款,420000099,M20260205999,',
  ].join('\n');

  const rows = parseWechat(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'income');
  assert.equal(rows[0].is_refund, 1);
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

test('parseBank should parse common bank CSV aliases and infer income/expense', () => {
  const csv = [
    'Bank Name,Date,Description,Counterparty,Amount,Balance,Transaction ID',
    'ABC Bank,2026-02-01 10:00:00,Salary,Employer,8000.00,10000.00,B001',
    'ABC Bank,2026-02-02 12:20:00,Lunch,Cafe,-35.50,9964.50,B002',
  ].join('\n');

  const rows = parseBank(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].source, 'bank');
  assert.equal(rows[0].type, 'income');
  assert.equal(rows[0].bank_name, 'ABC Bank');
  assert.equal(rows[1].type, 'expense');
  assert.equal(rows[1].amount, 35.5);
});

test('parseBank should parse debit/credit split columns', () => {
  const csv = [
    '交易日期,摘要,交易对方,借方金额,贷方金额,余额,银行名称,交易流水号',
    '2026/02/03,转账收入,张三,,500.00,10464.50,招商银行,CN001',
    '2026/02/04,电费扣款,国家电网,120.00,,10344.50,招商银行,CN002',
  ].join('\n');

  const rows = parseBank(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].type, 'income');
  assert.equal(rows[1].type, 'expense');
  assert.equal(rows[1].bank_name, '招商银行');
});

test('parseBillText should extract counterparty/original_id/refund from PDF-like lines', () => {
  const text = [
    '2026-02-05 11:20:00 | 退款 | 麦当劳 | order refund | +23.00 | 420000099',
    '2026-02-06 12:00:00 | 消费 | 星巴克 | 咖啡 | -36.50 | 420000100',
  ].join('\n');

  const rows = parseBillText(text, 'wechat');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].type, 'income');
  assert.equal(rows[0].is_refund, 1);
  assert.equal(rows[0].counterparty, '麦当劳');
  assert.equal(rows[0].original_id, '420000099');
  assert.equal(rows[1].type, 'expense');
  assert.equal(rows[1].counterparty, '星巴克');
  assert.equal(rows[1].original_id, '420000100');
});

test('parseBillText should parse wrapped date/amount lines from PDF text extraction', () => {
  const text = [
    '2026-02-10 18:01:00 消费 美团外卖 晚餐',
    '-45.60 交易号: 20260210223344556677',
  ].join('\n');

  const rows = parseBillText(text, 'alipay');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, '2026-02-10');
  assert.equal(rows[0].type, 'expense');
  assert.equal(rows[0].amount, 45.6);
  assert.equal(rows[0].counterparty, '美团外卖');
  assert.equal(rows[0].original_id, '20260210223344556677');
});

test('parseCmbcCreditCardText should parse CMBC split-line statement rows', () => {
  const text = [
    '民生银行信用卡对账单 (2026年01月)',
    '本期财务明细 Transaction Details',
    '12/27',
    '银联扫码-山姆会员商店',
    '648.58',
    '12/27',
    '6734',
    '01/07',
    '于阔/付款尾号:3749/银联入账',
    '-11.00',
    '01/07',
    '6734',
  ].join('\n');

  const rows = parseCmbcCreditCardText(text, 'bank');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, '2025-12-27');
  assert.equal(rows[0].type, 'expense');
  assert.equal(rows[0].amount, 648.58);
  assert.equal(rows[0].counterparty, '银联扫码-山姆会员商店');
  assert.equal(rows[1].date, '2026-01-07');
  assert.equal(rows[1].type, 'income');
  assert.equal(rows[1].amount, 11);
});

test('parseAbcCreditCardText should parse ABC compact statement rows', () => {
  const text = [
    '农业银行信用卡对账单2026年02月（补）',
    '交易明细',
    '●还款',
    '2601262601268865银联入账 于阔/付款尾号:3749/387.46/CNY387.46/CNY',
    '●消费',
    '2601112601118865跨行无卡消费 肯德基(蓝湾天地KFC店)5.36/CNY-5.36/CNY',
    '2602072602078865网上消费 支付宝，杭州深度求索人工智能基础技术研究',
    '有限公司',
    '10.00/CNY-10.00/CNY',
  ].join('\n');

  const rows = parseAbcCreditCardText(text, 'bank');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].date, '2026-01-26');
  assert.equal(rows[0].type, 'income');
  assert.equal(rows[0].amount, 387.46);
  assert.equal(rows[1].type, 'expense');
  assert.equal(rows[1].counterparty, '肯德基(蓝湾天地KFC店)');
  assert.equal(rows[2].amount, 10);
  assert.equal(rows[2].type, 'expense');
});
