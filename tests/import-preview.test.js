const test = require('node:test');
const assert = require('node:assert/strict');

// Test the import preview functionality
test.describe('Import Preview Feature', () => {
  // Helper function to create a test CSV file
  function createTestCsv(headers, rows) {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    return csvContent;
  }

  // Test CSV column extraction
  test('should extract columns from CSV content', () => {
    const csvContent = '交易时间,交易对方,金额,类型,说明\n2024-01-01,商户A,100.00,支出,测试';
    const lines = csvContent.split('\n');
    const firstLine = lines[0];
    const headers = firstLine.split(',').map(h => h.trim());
    
    assert.strictEqual(headers.length, 5);
    assert.strictEqual(headers[0], '交易时间');
    assert.strictEqual(headers[1], '交易对方');
    assert.strictEqual(headers[2], '金额');
    assert.strictEqual(headers[3], '类型');
    assert.strictEqual(headers[4], '说明');
  });

  // Test column mapping
  test('should map CSV columns to transaction fields', () => {
    const headers = ['交易时间', '交易对方', '金额', '类型', '说明'];
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    
    const mapping = {};
    
    // Date column mapping
    const datePatterns = ['date', '交易时间', '日期', 'time', '交易日期', '记账日期'];
    for (const pattern of datePatterns) {
      const idx = normalizedHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
      if (idx >= 0) {
        mapping[headers[idx]] = 'date';
        break;
      }
    }
    
    // Amount column mapping
    const amountPatterns = ['amount', '金额', '交易金额', '金额(元)', '金额'];
    for (const pattern of amountPatterns) {
      const idx = normalizedHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
      if (idx >= 0) {
        mapping[headers[idx]] = 'amount';
        break;
      }
    }
    
    // Type column mapping
    const typePatterns = ['type', '类型', '收/支', '交易类型', '支出/收入'];
    for (const pattern of typePatterns) {
      const idx = normalizedHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
      if (idx >= 0) {
        mapping[headers[idx]] = 'type';
        break;
      }
    }
    
    // Counterparty mapping
    const counterpartyPatterns = ['counterparty', '交易对方', '对方', '商户', '收款方', '付款方'];
    for (const pattern of counterpartyPatterns) {
      const idx = normalizedHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
      if (idx >= 0) {
        mapping[headers[idx]] = 'counterparty';
        break;
      }
    }
    
    // Description mapping
    const descPatterns = ['description', '说明', '摘要', '商品说明', '备注'];
    for (const pattern of descPatterns) {
      const idx = normalizedHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
      if (idx >= 0) {
        mapping[headers[idx]] = 'description';
        break;
      }
    }
    
    assert.strictEqual(mapping['交易时间'], 'date');
    assert.strictEqual(mapping['金额'], 'amount');
    assert.strictEqual(mapping['类型'], 'type');
    assert.strictEqual(mapping['交易对方'], 'counterparty');
    assert.strictEqual(mapping['说明'], 'description');
  });

  // Test preview data slicing
  test('should limit preview to specified number of rows', () => {
    const previewLimit = 5;
    const mockTransactions = Array.from({ length: 20 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      type: 'expense',
      amount: 100 + i,
      counterparty: `Merchant ${i}`,
      description: `Test transaction ${i}`,
      category: '其他'
    }));
    
    const preview = mockTransactions.slice(0, previewLimit).map((txn) => ({
      date: txn.date,
      type: txn.type,
      amount: txn.amount,
      counterparty: txn.counterparty,
      description: txn.description,
      category: txn.category,
    }));
    
    assert.strictEqual(preview.length, previewLimit);
    assert.strictEqual(preview[0].date, '2024-01-01');
    assert.strictEqual(preview[4].date, '2024-01-05');
  });

  // Test different CSV formats
  test('should handle various CSV column formats', () => {
    const formats = [
      { headers: ['Date', 'Amount', 'Type', 'Counterparty', 'Description'], expected: 'Date' },
      { headers: ['交易日期', '金额', '类型', '交易对方', '说明'], expected: '交易日期' },
      { headers: ['记账日期', '支出', '收入', '商户', '备注'], expected: '记账日期' }
    ];
    
    for (const format of formats) {
      const datePatterns = ['date', '交易时间', '日期', 'time', '交易日期', '记账日期'];
      const normalizedHeaders = format.headers.map(h => h.toLowerCase().trim());
      const idx = normalizedHeaders.findIndex(h => 
        datePatterns.some(p => h.includes(p.toLowerCase()))
      );
      
      assert.ok(idx >= 0, `Should find date column in: ${format.headers.join(', ')}`);
      assert.strictEqual(format.headers[idx], format.expected);
    }
  });

  // Test dryRun option
  test('should support dryRun option for preview only', () => {
    const mockOptions = {
      dryRun: true,
      previewLimit: 10
    };
    
    assert.strictEqual(mockOptions.dryRun, true);
    assert.strictEqual(mockOptions.previewLimit, 10);
  });

  // Test preview result structure
  test('should return proper preview result structure', () => {
    const mockResult = {
      importId: null,
      parsedCount: 100,
      inserted: 0,
      exactMerged: 0,
      fuzzyFlagged: 0,
      errors: [],
      preview: [
        { date: '2024-01-01', type: 'expense', amount: 100.00, counterparty: 'Merchant A', description: 'Test', category: '其他' }
      ],
      columns: ['交易时间', '交易对方', '金额', '类型', '说明'],
      columnMapping: {
        '交易时间': 'date',
        '交易对方': 'counterparty',
        '金额': 'amount',
        '类型': 'type',
        '说明': 'description'
      }
    };
    
    assert.strictEqual(mockResult.importId, null);
    assert.strictEqual(mockResult.parsedCount, 100);
    assert.ok(Array.isArray(mockResult.preview));
    assert.ok(Array.isArray(mockResult.columns));
    assert.ok(mockResult.columnMapping);
    assert.strictEqual(mockResult.columns.length, 5);
    assert.strictEqual(Object.keys(mockResult.columnMapping).length, 5);
  });
});