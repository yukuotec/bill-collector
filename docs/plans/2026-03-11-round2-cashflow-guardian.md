# Round 2: Smart Cash Flow Guardian

## Feature: 30-Day Balance Forecasting with Local AI

### Core Functionality
- Predict account balance 30 days into the future
- Warn users 7 days before potential overdrafts
- Suggest optimal bill payment dates based on cash flow
- All processing happens locally (privacy-preserving)

### Implementation Plan

1. **Cash Flow Engine** (`src/main/cashflow.ts`)
   - Analyze historical income/expense patterns
   - Project recurring transactions forward
   - Account for seasonal patterns (monthly/quarterly)
   - Calculate running balance forecast

2. **Prediction Algorithm**
   - Weighted moving average for income prediction
   - Category-based expense forecasting
   - Confidence intervals (optimistic/pessimistic scenarios)
   - Recurring transaction integration

3. **Alert System**
   - Overdraft warnings (7-day lookahead)
   - Low balance alerts
   - Bill payment optimization suggestions
   - Cash flow trend notifications

4. **UI Components**
   - Cash flow chart (30-day projection)
   - Balance prediction card on dashboard
   - Alert settings page
   - Forecast details modal

5. **Database Schema**
   - `cashflow_predictions` table (optional caching)
   - `cashflow_alerts` table (alert history)

### Technical Approach
- Time-series analysis using simple algorithms (no ML libraries needed)
- Exponential smoothing for trend detection
- Pattern matching for recurring items
- Local SQLite for all data storage

### Privacy
- All calculations happen on-device
- No external API calls
- No cloud data transmission
