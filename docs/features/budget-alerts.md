# Budget Alerts Documentation

## Overview

Budget alerts provide proactive notifications when your spending approaches or exceeds your budget limits. This feature helps users stay within their financial goals by providing visual indicators and percentage-based warnings.

## Features

### 1. Budget Creation and Management
- Create monthly budgets for specific categories or overall spending
- Set budget amounts in CNY (Chinese Yuan)
- View all active budgets in the Budgets page
- Delete budgets when no longer needed

### 2. Alert Levels
The system provides three alert levels based on spending percentage:

- **✅ Normal (0-79%)**: Green indicator, spending is within acceptable range
- **⚡ Warning (80-99%)**: Yellow/orange indicator, approaching budget limit  
- **⚠️ Exceeded (100%+)**: Red indicator, budget has been exceeded

### 3. Dashboard Integration
- Budget alerts appear prominently on the Dashboard
- Each alert shows:
  - Budget category (or "Overall" for general budgets)
  - Current spending vs budget amount
  - Percentage of budget used
  - Remaining amount (or overage if exceeded)
  - Visual progress bar with color coding

### 4. Real-time Updates
- Budget calculations update automatically as transactions are added/modified
- Alerts refresh immediately when new transactions affect budget status
- No manual refresh required

## Implementation Details

### Data Structure
Budgets are stored in the SQLite database with the following schema:

```sql
CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  year_month TEXT NOT NULL,        -- Format: YYYY-MM
  amount REAL NOT NULL,           -- Budget amount
  category TEXT,                  -- NULL for overall budget, category name for specific
  created_at TEXT NOT NULL,
  UNIQUE(year_month, category)
);
```

### Calculation Logic
For each budget, the system calculates:
- **Spent Amount**: Sum of all expense transactions matching the budget criteria
- **Remaining**: `budget.amount - spent_amount`
- **Percentage**: `(spent_amount / budget.amount) * 100`
- **Status**: Based on percentage thresholds (80% and 100%)

### Filtering Logic
When calculating spending against a budget:
- **Category-specific budgets**: Only include transactions with matching category
- **Overall budgets** (category = NULL): Include all expense transactions
- **Time period**: Only include transactions within the budget's year-month

## User Interface

### Budgets Page
- List all active budgets with edit/delete capabilities
- Form to create new budgets with year-month selector and category dropdown
- Visual indicators showing current status of each budget

### Dashboard Alerts
- Prominent alert cards at the top of the Dashboard
- Color-coded headers (green/yellow/red)
- Progress bars showing budget utilization
- Clear remaining/overage amounts
- Quick access to budget management

## API Endpoints

### Main Process IPC Handlers
- `get-budgets`: Retrieve all budgets
- `set-budget`: Create or update a budget
- `delete-budget`: Remove a budget
- `get-budget-alerts`: Get current budget alerts for display

### Renderer Components
- `Budgets.tsx`: Budget management page
- Dashboard budget alert components integrated into main Dashboard view

## Usage Examples

### Creating a Monthly Food Budget
1. Navigate to Budgets page
2. Click "Create Budget"
3. Set Year-Month: 2026-03
4. Set Category: 餐饮 (Food)
5. Set Amount: 2000
6. Save budget

### Monitoring Budget Status
- Dashboard will show alert when spending reaches 80% (¥1600) or 100% (¥2000)
- Progress bar updates in real-time as transactions are added
- Can click through to Transactions page to see detailed spending

## Technical Notes

### Performance Optimization
- Budget calculations are optimized with proper SQL indexing
- Only recalculates when relevant transactions change
- Uses efficient aggregate queries with proper WHERE clauses

### Error Handling
- Handles edge cases like zero-budget amounts
- Gracefully handles missing or invalid transaction data
- Provides user-friendly error messages for budget operations

## Future Enhancements

### Planned Features
- **Budget Templates**: Reusable budget templates for recurring periods
- **Multiple Currencies**: Support for budgets in different currencies
- **Budget History**: Historical view of past budget performance
- **Email Notifications**: Optional email alerts for budget thresholds
- **Advanced Rules**: More complex budget rules (weekly, quarterly, etc.)

### Integration Opportunities
- **Calendar Integration**: Sync budget periods with calendar events
- **Goal Tracking**: Link budgets to broader financial goals
- **Forecasting**: Predict end-of-period spending based on current trends

## Troubleshooting

### Common Issues
- **Budget not updating**: Ensure transactions have correct dates and categories
- **Incorrect calculations**: Verify that transaction types are set to "expense"
- **Missing alerts**: Check that budget year-month matches current viewing period

### Debugging Tips
- Use the browser dev tools to inspect IPC calls
- Check the database directly for budget and transaction records
- Verify that date formats are consistent (YYYY-MM-DD for transactions, YYYY-MM for budgets)