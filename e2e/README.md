# E2E Tests for Expense Tracker

This directory contains end-to-end tests for the expense tracker application covering all 20 rounds of features.

## Test Structure

```
e2e/
├── playwright.config.ts      # Playwright configuration
├── global-setup.ts           # Test environment setup
├── global-teardown.ts        # Test cleanup
├── pages.ts                  # Page Object Models
├── smoke.spec.ts             # Smoke tests (all pages)
├── critical-journeys.spec.ts # Critical user journeys
└── README.md                 # This file
```

## Test Coverage

### Critical User Journeys (12 journeys, 25+ test cases)

1. **Basic Transaction Flow** - Add transaction → View on dashboard
2. **Receipt Intelligence** - Upload receipt → OCR → Match
3. **AI Categorization** - Predict category → Batch categorize
4. **Cash Flow Guardian** - Generate forecast → Optimize payments
5. **Backup and Restore** - Create backup → List → Restore
6. **Transaction Templates** - Create → Use template
7. **Data Health Check** - Run check → View issues → Fix
8. **Natural Language Input** - Parse text → Create transaction
9. **Advanced Analytics** - Trends → Fraud detection → Insights
10. **Multi-Currency** - Convert → Display
11. **Tax Reports** - Generate year-end report
12. **Merchant Analytics** - View profile → Trends

### Smoke Tests (16 pages)

All 16 application pages load without errors:
- Dashboard, Quick Add, Transactions
- Budgets, Accounts, Members
- Import, Export, Recurring
- Investments, Savings, Receipts
- Source Coverage, Email Settings
- Reminders, Assign Transactions

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Specific Test File
```bash
npx playwright test e2e/smoke.spec.ts
npx playwright test e2e/critical-journeys.spec.ts
```

### Run with UI (for debugging)
```bash
npx playwright test --ui
```

### Run in Headed Mode (see browser)
```bash
npx playwright test --headed
```

## Test Duration

- **Smoke tests**: ~30 seconds (16 pages)
- **Critical journeys**: ~2-3 minutes (12 journeys)
- **Total E2E suite**: ~3-4 minutes

## CI/CD Integration

Tests are configured to run in CI with:
- Automatic retries (2 retries in CI)
- Screenshots on failure
- HTML report generation
- Parallel execution (workers based on CPU)

## Adding New Tests

1. Add Page Object to `pages.ts` if needed
2. Create test file: `e2e/your-feature.spec.ts`
3. Follow naming: `Journey X: Description`
4. Test both happy path and edge cases
5. Keep tests under 30 seconds each

## Debugging

### View Test Report
```bash
npx playwright show-report
```

### Trace Viewer
```bash
npx playwright show-trace trace.zip
```

### Slow Motion
```typescript
// In test file
test.use({ launchOptions: { slowMo: 1000 } });
```

## Troubleshooting

**Test times out**
- Increase timeout in `playwright.config.ts`
- Check if app is built: `npm run build`

**Element not found**
- Add `await page.waitForTimeout(500)` after navigation
- Use more specific selectors in Page Object

**API calls fail**
- Ensure test database is seeded in global-setup
- Check IPC handler is registered

## Coverage

- ✅ Build verification
- ✅ Page load tests
- ✅ API functionality
- ✅ User interactions
- ✅ Data persistence
- ⚠️ Visual regression (not implemented)
- ⚠️ Accessibility (not implemented)
