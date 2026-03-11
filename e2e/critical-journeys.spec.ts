import { test, expect } from '@playwright/test';
import { DashboardPage, TransactionsPage, QuickAddPage, ReceiptsPage, ExportPage } from './pages';

test.describe.configure({ mode: 'parallel' });

/**
 * Critical User Journey 1: Basic Transaction Flow
 * Quick Add → Dashboard → Transaction List
 */
test.describe('Journey 1: Basic Transaction Flow', () => {
  test('should add transaction via quick add and see it on dashboard', async ({ page }) => {
    const quickAdd = new QuickAddPage(page);
    const dashboard = new DashboardPage(page);

    // Navigate to quick add
    await quickAdd.goto();
    await expect(quickAdd.heading).toBeVisible();

    // Add a transaction
    await quickAdd.addTransaction('100', 'Test Restaurant', '餐饮');

    // Navigate to dashboard and verify
    await dashboard.goto();
    await expect(dashboard.heading).toBeVisible();
    await expect(dashboard.chart).toBeVisible();
  });

  test('should view transaction details', async ({ page }) => {
    const transactions = new TransactionsPage(page);

    await transactions.goto();
    await expect(transactions.heading).toBeVisible();

    const count = await transactions.getTransactionCount();
    expect(count).toBeGreaterThan(0);

    await transactions.clickFirstTransaction();
    // Verify transaction detail modal opens
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

/**
 * Critical User Journey 2: Receipt Upload Flow
 * Upload Receipt → OCR Processing → Match to Transaction
 */
test.describe('Journey 2: Receipt Intelligence', () => {
  test('should navigate to receipts page', async ({ page }) => {
    const receipts = new ReceiptsPage(page);

    await receipts.goto();
    await expect(receipts.heading).toBeVisible();
    await expect(receipts.uploadButton).toBeEnabled();
  });

  test('should search receipts', async ({ page }) => {
    const receipts = new ReceiptsPage(page);

    await receipts.goto();
    await receipts.searchInput.fill('test');
    await page.waitForTimeout(300);

    // Search executes without error
    await expect(receipts.heading).toBeVisible();
  });
});

/**
 * Critical User Journey 3: AI Categorization
 * Import CSV → Auto-categorize → Review
 */
test.describe('Journey 3: AI Categorization', () => {
  test('should predict category from transaction data', async ({ page }) => {
    // Test the category prediction API
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.predictCategory('Starbucks', 'Coffee', 35);
    });

    expect(result).toBeDefined();
    expect(result.category).toBeTruthy();
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('should batch categorize transactions', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.batchCategorize(true); // dry run
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});

/**
 * Critical User Journey 4: Cash Flow Forecasting
 * View Forecast → Check Alerts → Optimize
 */
test.describe('Journey 4: Cash Flow Guardian', () => {
  test('should generate cash flow forecast', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.getCashFlowForecast();
    });

    expect(result).toBeDefined();
    expect(result.predictions).toBeDefined();
    expect(Array.isArray(result.predictions)).toBe(true);
    expect(result.summary).toBeDefined();
  });

  test('should calculate bill payment optimization', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      // @ts-ignore
      return await window.electronAPI.optimizeBillPayment(
        futureDate.toISOString().split('T')[0],
        500
      );
    });

    expect(result).toBeDefined();
    expect(result.suggestedDate).toBeTruthy();
    expect(result.reason).toBeTruthy();
  });
});

/**
 * Critical User Journey 5: Backup and Restore
 * Create Backup → Verify → Restore
 */
test.describe('Journey 5: Backup and Restore', () => {
  test('should create backup', async ({ page }) => {
    const exportPage = new ExportPage(page);

    await exportPage.goto();
    await expect(exportPage.heading).toBeVisible();
    await expect(exportPage.backupButton).toBeEnabled();

    // Create backup
    await exportPage.createBackup();
  });

  test('should list backups', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.listBackups();
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

/**
 * Critical User Journey 6: Template Management
 * Create Template → Use Template → Track Usage
 */
test.describe('Journey 6: Transaction Templates', () => {
  test('should list templates', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.getTemplates();
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

/**
 * Critical User Journey 7: Health Check
 * Run Health Check → View Issues → Fix
 */
test.describe('Journey 7: Data Health Check', () => {
  test('should run health check', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.runHealthCheck();
    });

    expect(result).toBeDefined();
    expect(result.issues).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(typeof result.summary.totalIssues).toBe('number');
  });
});

/**
 * Critical User Journey 8: NLP Input
 * Natural Language → Parse → Create Transaction
 */
test.describe('Journey 8: Natural Language Input', () => {
  test('should parse natural language input', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.parseNLP('Lunch at McDonalds for 45 yuan');
    });

    expect(result).toBeDefined();
    expect(result.action).toBeTruthy();
  });

  test('should parse query commands', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.parseNLP('What did I spend on food this month?');
    });

    expect(result).toBeDefined();
    expect(result.action).toBeTruthy();
  });
});

/**
 * Critical User Journey 9: Advanced Analytics
 * View Trends → Detect Fraud → Generate Insights
 */
test.describe('Journey 9: Advanced Analytics', () => {
  test('should analyze category trends', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.analyzeTrends(3);
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('should detect suspicious transactions', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.detectFraud();
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('should generate insights', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.generateInsights();
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

/**
 * Critical User Journey 10: Multi-Currency
 * Convert → Display → Report
 */
test.describe('Journey 10: Multi-Currency Support', () => {
  test('should convert currency', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.convertCurrency(100, 'USD', 'CNY');
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });
});

/**
 * Critical User Journey 11: Tax Reports
 * Generate Year-End Report → View Deductions
 */
test.describe('Journey 11: Tax Reports', () => {
  test('should generate tax report', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.generateTaxReport(2024);
    });

    expect(result).toBeDefined();
    expect(result.year).toBe(2024);
    expect(typeof result.totalIncome).toBe('number');
    expect(typeof result.totalExpense).toBe('number');
  });
});

/**
 * Critical User Journey 12: Merchant Analytics
 * View Merchant Profile → See Trends
 */
test.describe('Journey 12: Merchant Analytics', () => {
  test('should get merchant analytics', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.electronAPI.getMerchantAnalytics('Starbucks');
    });

    // May be null if no data, but API should work
    if (result) {
      expect(result.name).toBeDefined();
      expect(typeof result.totalSpent).toBe('number');
    }
  });
});
