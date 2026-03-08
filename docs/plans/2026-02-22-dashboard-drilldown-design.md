# Dashboard Drill-down Analysis Design

Date: 2026-02-22
Status: ✅ Completed and Implemented

## Goal
Enable deeper analysis by letting users drill down from Dashboard visualizations into detailed transactions, carrying the active Dashboard time range and showing removable drill-down context in Transactions.

## Scope (v1)
- Drill-down sources:
  - Category pie chart
  - Top merchants chart/list
- Drill-down target:
  - Existing `Transactions` page
- Out of scope:
  - Summary card drill-down (expense/income/net)

## Approach Options

### Option 1: URL-query driven drill-down (Recommended)
Navigate from Dashboard to Transactions with URL params representing effective filters.

Pros:
- Deep-linkable and refresh-safe
- Easy to debug and test
- Supports back/forward naturally

Cons:
- Requires route/query sync logic in Transactions

### Option 2: In-memory navigation state
Pass filters via router navigation state only.

Pros:
- Simpler to wire initially

Cons:
- Lost on refresh
- Not shareable/bookmarkable

### Option 3: Global store drill context
Use global state for cross-page drill context.

Pros:
- Flexible for future complex flows

Cons:
- More architecture overhead than needed for v1

## Recommended Design
Use URL-query driven drill-down.

### Filter Contract
Query parameters:
- `from`: start date (effective Dashboard range)
- `to`: end date (effective Dashboard range)
- `category`: selected category (when drilling from pie)
- `merchant`: selected merchant (when drilling from top merchants)
- `drill=1`: marker for drill-down context treatment

Rules:
- Carry the exact effective Dashboard range to Transactions
- Use either `category` or `merchant` per drill action
- URL is source of truth after navigation

## Architecture

### Dashboard
- On category slice click: navigate to Transactions with `from,to,category,drill=1`
- On top-merchant click: navigate to Transactions with `from,to,merchant,drill=1`

### Transactions
- Parse query params at mount and URL changes
- Validate/normalize values
- Apply parsed filters to existing filter state
- Render drill-down chips above table
- Keep URL and UI state synchronized when filters change

### UI Behavior
- Show explicit removable chips for drill context
- Provide `Clear all` action to remove drill-origin filters
- Existing search/sort/pagination/filter controls continue working

## Error Handling and Edge Cases
- Malformed params:
  - Ignore invalid values, keep valid values
  - Show non-blocking notice: some filters ignored
- Empty result set:
  - Show normal empty state with active chips visible
  - Include quick action to clear drill filters
- Refresh/back-forward:
  - Preserve state via URL source of truth
- Special characters:
  - URL-encode/decode category/merchant values (including Chinese text)
- Potential state conflicts:
  - Any manual filter changes immediately update URL to avoid divergence

## Testing Strategy

### Unit
- Parser/serializer round-trip for `from,to,category,merchant,drill`
- Validation behavior for malformed/partial params

### Integration/UI
- Pie click navigates with expected query params
- Top merchant click navigates with expected query params
- Transactions loads with visible drill chips
- Removing chip updates URL and results
- `Clear all` removes drill filters and broadens results

### Regression
- Existing filtering/search/sort/pagination remains correct
- Back/forward navigation correctness
- Refresh on Transactions keeps drill state

### Manual Smoke
- Chinese category/merchant survives URL encode/decode
- Empty-state UX remains clear under narrow drill filters

## Acceptance Criteria
- User can click category/top-merchant insight and land on filtered Transactions view
- Active Dashboard date range is preserved in drill-down
- Drill context is visible and removable via chips
- URL accurately reflects active drill filters and remains stable on refresh
- No regression in existing Transactions filtering workflow
