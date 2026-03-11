import { Page, Locator } from '@playwright/test';

/**
 * Base page object for common operations
 */
export class BasePage {
  constructor(protected page: Page) {}

  async navigateTo(pageName: string) {
    await this.page.evaluate((name) => {
      window.location.hash = name;
    }, pageName);
    await this.page.waitForTimeout(500); // Wait for navigation
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async clickButton(text: string) {
    await this.page.getByRole('button', { name: text }).click();
  }

  async fillInput(placeholder: string, value: string) {
    await this.page.getByPlaceholder(placeholder).fill(value);
  }

  async expectToSee(text: string) {
    await this.page.getByText(text).waitFor({ state: 'visible' });
  }
}

/**
 * Dashboard page object
 */
export class DashboardPage extends BasePage {
  readonly heading: Locator;
  readonly summaryCards: Locator;
  readonly chart: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /dashboard|仪表盘/i });
    this.summaryCards = page.locator('[data-testid="summary-card"]');
    this.chart = page.locator('[data-testid="dashboard-chart"]').or(page.locator('canvas'));
  }

  async goto() {
    await this.navigateTo('dashboard');
    await this.heading.waitFor();
  }

  async getTotalExpense(): Promise<string> {
    const card = this.page.getByTestId('total-expense');
    return card.textContent() || '';
  }

  async drillDownToTransactions(category: string) {
    await this.page.getByText(category).click();
    await this.page.waitForURL(/#transactions/);
  }
}

/**
 * Transactions page object
 */
export class TransactionsPage extends BasePage {
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;
  readonly transactionList: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /transactions|交易记录/i });
    this.addButton = page.getByRole('button', { name: /add|新增/i });
    this.searchInput = page.getByPlaceholder(/search|搜索/i);
    this.transactionList = page.locator('[data-testid="transaction-list"]').or(page.locator('table tbody tr'));
  }

  async goto() {
    await this.navigateTo('transactions');
    await this.heading.waitFor();
  }

  async getTransactionCount(): Promise<number> {
    return this.transactionList.count();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(300);
  }

  async clickFirstTransaction() {
    await this.transactionList.first().click();
  }
}

/**
 * Receipts page object
 */
export class ReceiptsPage extends BasePage {
  readonly heading: Locator;
  readonly uploadButton: Locator;
  readonly searchInput: Locator;
  readonly receiptGrid: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /receipts|收据/i });
    this.uploadButton = page.getByRole('button', { name: /upload|上传/i });
    this.searchInput = page.getByPlaceholder(/search|搜索/i);
    this.receiptGrid = page.locator('[data-testid="receipt-grid"]').or(page.locator('img[alt="Receipt"]'));
  }

  async goto() {
    await this.navigateTo('receipts');
    await this.heading.waitFor();
  }

  async uploadReceipt(filePath: string) {
    // Mock file selection and upload
    await this.page.evaluate((path) => {
      // @ts-ignore
      window.electronAPI.selectReceiptFile = async () => path;
    }, filePath);
    await this.uploadButton.click();
    await this.page.waitForTimeout(2000); // Wait for OCR
  }

  async getReceiptCount(): Promise<number> {
    return this.receiptGrid.count();
  }
}

/**
 * Quick Add page object
 */
export class QuickAddPage extends BasePage {
  readonly heading: Locator;
  readonly amountInput: Locator;
  readonly merchantInput: Locator;
  readonly categorySelect: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /quick add|快速记账/i });
    this.amountInput = page.getByPlaceholder(/amount|金额/i);
    this.merchantInput = page.getByPlaceholder(/merchant|商家/i);
    this.categorySelect = page.getByLabel(/category|分类/i);
    this.submitButton = page.getByRole('button', { name: /save|保存|add|添加/i });
  }

  async goto() {
    await this.navigateTo('quick-add');
    await this.heading.waitFor();
  }

  async addTransaction(amount: string, merchant: string, category: string) {
    await this.amountInput.fill(amount);
    await this.merchantInput.fill(merchant);
    await this.categorySelect.selectOption(category);
    await this.submitButton.click();
    await this.page.waitForTimeout(500);
  }
}

/**
 * Settings/Export page object
 */
export class ExportPage extends BasePage {
  readonly heading: Locator;
  readonly backupButton: Locator;
  readonly restoreButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /export|导出|backup|备份/i });
    this.backupButton = page.getByRole('button', { name: /backup|备份/i });
    this.restoreButton = page.getByRole('button', { name: /restore|恢复/i });
  }

  async goto() {
    await this.navigateTo('export');
    await this.heading.waitFor();
  }

  async createBackup() {
    await this.backupButton.click();
    await this.page.waitForTimeout(1000);
  }
}
