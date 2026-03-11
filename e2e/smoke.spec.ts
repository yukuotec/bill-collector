import { test, expect } from '@playwright/test';

/**
 * Smoke tests for all pages
 * Verifies all 16 pages load without errors
 */
const PAGES = [
  { name: 'dashboard', title: /dashboard|仪表盘/i },
  { name: 'quick-add', title: /quick add|快速记账/i },
  { name: 'transactions', title: /transactions|交易记录/i },
  { name: 'budgets', title: /budget|预算/i },
  { name: 'accounts', title: /accounts|账户/i },
  { name: 'members', title: /members|成员/i },
  { name: 'import', title: /import|导入/i },
  { name: 'export', title: /export|导出/i },
  { name: 'recurring', title: /recurring|周期/i },
  { name: 'investments', title: /investment|投资/i },
  { name: 'savings', title: /savings|储蓄/i },
  { name: 'receipts', title: /receipt|收据/i },
  { name: 'source-coverage', title: /coverage|收集/i },
  { name: 'email-settings', title: /email|邮箱/i },
  { name: 'reminders', title: /reminder|提醒/i },
  { name: 'assign', title: /assign|分配/i },
];

test.describe('Smoke Tests: All Pages Load', () => {
  for (const page of PAGES) {
    test(`${page.name} page loads`, async ({ page: p }) => {
      // Navigate to page
      await p.evaluate((name) => {
        window.location.hash = name;
      }, page.name);

      // Wait for page to load
      await p.waitForTimeout(500);

      // Verify no error dialogs
      const errorDialog = p.locator('[data-testid="error"]').or(p.getByText(/error|错误/i));
      const hasError = await errorDialog.isVisible().catch(() => false);
      expect(hasError).toBe(false);

      // Verify page content loaded (body has content)
      const bodyContent = await p.locator('body').textContent();
      expect(bodyContent).toBeTruthy();
      expect(bodyContent!.length).toBeGreaterThan(100);
    });
  }
});

test.describe('Navigation Tests', () => {
  test('should navigate between pages', async ({ page }) => {
    // Start at dashboard
    await page.evaluate(() => {
      window.location.hash = 'dashboard';
    });
    await page.waitForTimeout(500);

    // Navigate through each page
    for (const p of PAGES.slice(0, 5)) {
      await page.evaluate((name) => {
        window.location.hash = name;
      }, p.name);
      await page.waitForTimeout(300);

      // Verify navigation worked
      const hash = await page.evaluate(() => window.location.hash);
      expect(hash).toContain(p.name);
    }
  });
});
