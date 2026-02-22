# Dashboard Drill-down Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Dashboard-to-Transactions drill-down for category and merchant insights, carrying Dashboard time range and exposing removable drill-down chips in Transactions.

**Architecture:** Use URL hash/query as the canonical navigation/filter state (`#dashboard?...`, `#transactions?...`). Dashboard click actions navigate with serialized drill params; Transactions parses and applies them into filter state, keeps URL synchronized, and renders removable context chips. Merchant drill-down uses exact `merchant` filtering in IPC query.

**Tech Stack:** React 18 + TypeScript (renderer), Electron IPC (main), SQL.js query filtering, node:test for unit tests, npm scripts (`build:electron`, `test:parsers`).

---

### Task 1: Add shared drill-down query model and parser/serializer

**Files:**
- Create: `src/shared/drilldown.ts`
- Modify: `src/shared/types.ts`
- Test: `tests/drilldown.test.js`

**Step 1: Write the failing test (@test-driven-development)**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseDrilldownQuery,
  buildDrilldownQuery,
} = require('../dist/shared/drilldown');

test('parseDrilldownQuery parses category drill with date range', () => {
  const parsed = parseDrilldownQuery('?from=2026-01-01&to=2026-01-31&category=%E9%A4%90%E9%A5%AE&drill=1');
  assert.deepEqual(parsed, {
    from: '2026-01-01',
    to: '2026-01-31',
    category: '餐饮',
    drill: true,
  });
});

test('buildDrilldownQuery round-trips merchant drill', () => {
  const q = buildDrilldownQuery({ from: '2026-01-01', to: '2026-01-31', merchant: '麦当劳', drill: true });
  assert.equal(q, '?from=2026-01-01&to=2026-01-31&merchant=%E9%BA%A6%E5%BD%93%E5%8A%B3&drill=1');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run build:electron && node --test tests/drilldown.test.js`
Expected: FAIL with module-not-found for `dist/shared/drilldown`.

**Step 3: Write minimal implementation**

```ts
// src/shared/drilldown.ts
export interface DrilldownQuery {
  from?: string;
  to?: string;
  category?: string;
  merchant?: string;
  drill?: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDrilldownQuery(search: string): DrilldownQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const from = params.get('from') || undefined;
  const to = params.get('to') || undefined;
  const category = params.get('category') || undefined;
  const merchant = params.get('merchant') || undefined;
  const drill = params.get('drill') === '1';

  return {
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    category: category?.trim() || undefined,
    merchant: merchant?.trim() || undefined,
    drill,
  };
}

export function buildDrilldownQuery(input: DrilldownQuery): string {
  const params = new URLSearchParams();
  if (input.from) params.set('from', input.from);
  if (input.to) params.set('to', input.to);
  if (input.category) params.set('category', input.category);
  if (input.merchant) params.set('merchant', input.merchant);
  if (input.drill) params.set('drill', '1');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
```

**Step 4: Run test to verify it passes**

Run: `npm run build:electron && node --test tests/drilldown.test.js`
Expected: PASS for new drilldown helper tests.

**Step 5: Commit**

```bash
git add src/shared/drilldown.ts src/shared/types.ts tests/drilldown.test.js
git commit -m "feat: add shared drilldown query parser and serializer"
```

### Task 2: Introduce hash-based page/query state in renderer shell

**Files:**
- Modify: `src/renderer/App.tsx`
- Test: `tests/drilldown.test.js`

**Step 1: Write the failing test**

```js
const { parseHashLocation } = require('../dist/shared/drilldown');

test('parseHashLocation returns page and search from hash', () => {
  const out = parseHashLocation('#transactions?from=2026-01-01&to=2026-01-31');
  assert.deepEqual(out, { page: 'transactions', search: '?from=2026-01-01&to=2026-01-31' });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run build:electron && node --test tests/drilldown.test.js`
Expected: FAIL because `parseHashLocation` is not implemented.

**Step 3: Write minimal implementation**

```ts
// src/shared/drilldown.ts
export type AppPage = 'dashboard' | 'import' | 'transactions';

export function parseHashLocation(hash: string): { page: AppPage; search: string } {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path, qs = ''] = raw.split('?');
  const page: AppPage = path === 'import' || path === 'transactions' ? path : 'dashboard';
  return { page, search: qs ? `?${qs}` : '' };
}
```

```tsx
// src/renderer/App.tsx (core idea)
const [locationState, setLocationState] = useState(() => parseHashLocation(window.location.hash));

useEffect(() => {
  const onHashChange = () => setLocationState(parseHashLocation(window.location.hash));
  window.addEventListener('hashchange', onHashChange);
  return () => window.removeEventListener('hashchange', onHashChange);
}, []);

const navigate = (page: Page, search = '') => {
  window.location.hash = `${page}${search}`;
};
```

**Step 4: Run test to verify it passes**

Run: `npm run build:electron && node --test tests/drilldown.test.js`
Expected: PASS for hash parsing tests.

**Step 5: Commit**

```bash
git add src/shared/drilldown.ts src/renderer/App.tsx tests/drilldown.test.js
git commit -m "feat: support hash page and query state in app shell"
```

### Task 3: Add Dashboard drill-down interactions (category + merchant)

**Files:**
- Modify: `src/renderer/pages/Dashboard.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/shared/types.ts`

**Step 1: Write the failing test**

```js
test('buildDrilldownQuery creates category payload with drill marker', () => {
  const q = buildDrilldownQuery({ from: '2026-01-01', to: '2026-01-31', category: '餐饮', drill: true });
  assert.match(q, /from=2026-01-01/);
  assert.match(q, /to=2026-01-31/);
  assert.match(q, /category=/);
  assert.match(q, /drill=1/);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run build:electron && node --test tests/drilldown.test.js`
Expected: FAIL until Dashboard range mapping helper exists.

**Step 3: Write minimal implementation**

```tsx
// Dashboard.tsx (core idea)
interface DashboardProps {
  onDrilldown: (query: { from: string; to: string; category?: string; merchant?: string; drill: true }) => void;
}

const yearRange = { from: `${summary.year}-01-01`, to: `${summary.year}-12-31` };

<Pie onClick={(entry) => onDrilldown({ ...yearRange, category: entry.name, drill: true })} />

<tr onClick={() => onDrilldown({ ...yearRange, merchant: merchant.counterparty, drill: true })}>
```

```tsx
// App.tsx (core idea)
<Dashboard onDrilldown={(q) => navigate('transactions', buildDrilldownQuery(q))} />
```

**Step 4: Run test to verify it passes**

Run: `npm run build:electron && node --test tests/drilldown.test.js`
Expected: PASS for drill query generation tests.

**Step 5: Commit**

```bash
git add src/renderer/pages/Dashboard.tsx src/renderer/App.tsx src/shared/types.ts tests/drilldown.test.js
git commit -m "feat: add dashboard category and merchant drilldown navigation"
```

### Task 4: Add exact merchant filtering in transaction query path

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/ipc.ts`

**Step 1: Write the failing test**

```js
const { buildTransactionWhereClause } = require('../dist/main/ipcFilters');

test('merchant filter adds exact counterparty condition', () => {
  const out = buildTransactionWhereClause({ merchant: '麦当劳' });
  assert.equal(out.where.includes('counterparty = ?'), true);
  assert.equal(out.params[0], '麦当劳');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run build:electron && node --test tests/drilldown.test.js`
Expected: FAIL because helper or merchant field is missing.

**Step 3: Write minimal implementation**

```ts
// src/shared/types.ts
export interface TransactionQuery {
  // existing...
  merchant?: string;
}
```

```ts
// src/main/ipc.ts inside get-transactions
if (filters?.merchant) {
  where.push('counterparty = ?');
  params.push(filters.merchant);
}
```

Note: if extractable, move where-building into `src/main/ipcFilters.ts` for testability.

**Step 4: Run test to verify it passes**

Run: `npm run build:electron && node --test tests/drilldown.test.js`
Expected: PASS for merchant condition coverage.

**Step 5: Commit**

```bash
git add src/shared/types.ts src/main/ipc.ts tests/drilldown.test.js
git commit -m "feat: support exact merchant filtering in transactions query"
```

### Task 5: Bootstrap Transactions from drill query and render removable chips

**Files:**
- Modify: `src/renderer/pages/Transactions.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles/index.css`

**Step 1: Write the failing test**

```js
test('parseDrilldownQuery ignores malformed date and keeps merchant', () => {
  const parsed = parseDrilldownQuery('?from=bad-date&to=2026-01-31&merchant=%E6%98%9F%E5%B7%B4%E5%85%8B&drill=1');
  assert.deepEqual(parsed, { to: '2026-01-31', merchant: '星巴克', drill: true });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run build:electron && node --test tests/drilldown.test.js`
Expected: FAIL until invalid-date filtering behavior is implemented.

**Step 3: Write minimal implementation**

```tsx
// Transactions.tsx (core idea)
interface TransactionsProps {
  locationSearch: string;
  onReplaceSearch: (search: string) => void;
}

const drill = parseDrilldownQuery(locationSearch);
useEffect(() => {
  setFilter((prev) => ({
    ...prev,
    startDate: drill.from ?? prev.startDate,
    endDate: drill.to ?? prev.endDate,
    category: drill.category ?? prev.category,
    merchant: drill.merchant ?? prev.merchant,
  }));
}, [locationSearch]);

// chip remove updates both local filter and URL query
```

```css
/* src/renderer/styles/index.css */
.drilldown-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.drilldown-chip { background: #eef6ff; border: 1px solid #c7e0ff; border-radius: 999px; padding: 4px 10px; }
```

**Step 4: Run test to verify it passes**

Run: `npm run build:electron && node --test tests/drilldown.test.js`
Expected: PASS for drill-query validation behavior.

**Step 5: Commit**

```bash
git add src/renderer/pages/Transactions.tsx src/renderer/App.tsx src/renderer/styles/index.css tests/drilldown.test.js
git commit -m "feat: apply drilldown filters in transactions with removable context chips"
```

### Task 6: Verification and docs update

**Files:**
- Modify: `SPEC.md`
- Modify: `docs/plans/2026-02-22-dashboard-drilldown-design.md` (optional status note)

**Step 1: Write verification checklist (@verification-before-completion)**

```md
- Drill from category pie -> transactions URL has from/to/category/drill
- Drill from merchant table -> transactions URL has from/to/merchant/drill
- Chips visible and removable
- Clear-all removes drill context
- Existing filters/sort/pagination unaffected
```

**Step 2: Run full relevant tests**

Run: `npm run build:electron && node --test tests/parsers.test.js tests/drilldown.test.js`
Expected: PASS for all listed tests.

**Step 3: Manual smoke test**

Run: `npm run dev`
Expected:
- Click category/merchant on Dashboard opens Transactions with expected filters
- Refresh keeps state
- Back/forward works
- Chinese merchant/category remain intact

**Step 4: Update docs**

- Add a short line in `SPEC.md` Phase section describing dashboard drill-down capability.

**Step 5: Commit**

```bash
git add SPEC.md docs/plans/2026-02-22-dashboard-drilldown-design.md
git commit -m "docs: record dashboard drilldown analysis capability"
```

## Notes and Constraints
- Keep v1 strictly to category + merchant drill-down only (no summary-card drill).
- Preserve existing reset behavior in Transactions; `Reset` should clear drill-origin filters too.
- Do not add new persistence tables; URL + existing query API is sufficient.
- Prefer extracting pure helper functions for query parse/serialize to keep tests stable and fast.
