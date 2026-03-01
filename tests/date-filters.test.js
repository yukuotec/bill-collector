const test = require('node:test');
const assert = require('node:assert/strict');

// Test date utilities for quick date filters
function getWeekRange(date, which = 'this') {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  
  const start = new Date(d);
  start.setDate(diff);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  
  if (which === 'last') {
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() - 7);
  }
  
  const format = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  
  return { start: format(start), end: format(end) };
}

function getMonthRange(date, which = 'this') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  
  let start, end;
  if (which === 'this') {
    start = new Date(year, month, 1);
    end = new Date(year, month + 1, 0);
  } else {
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 0);
  }
  
  const format = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  
  return { start: format(start), end: format(end) };
}

function getYearRange(date, which = 'this') {
  const d = new Date(date);
  const year = d.getFullYear();
  
  if (which === 'last') {
    return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
  }
  
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

test('getWeekRange returns correct this week range', () => {
  const now = new Date('2026-03-02'); // Monday
  const result = getWeekRange(now, 'this');
  assert.equal(result.start, '2026-03-02');
  assert.equal(result.end, '2026-03-08');
});

test('getWeekRange returns correct last week range', () => {
  const now = new Date('2026-03-02');
  const result = getWeekRange(now, 'last');
  assert.equal(result.start, '2026-02-23');
  assert.equal(result.end, '2026-03-01');
});

test('getMonthRange returns correct this month range', () => {
  const now = new Date('2026-03-15');
  const result = getMonthRange(now, 'this');
  assert.equal(result.start, '2026-03-01');
  assert.equal(result.end, '2026-03-31');
});

test('getMonthRange returns correct last month range', () => {
  const now = new Date('2026-03-15');
  const result = getMonthRange(now, 'last');
  assert.equal(result.start, '2026-02-01');
  assert.equal(result.end, '2026-02-28');
});

test('getMonthRange handles January correctly', () => {
  const now = new Date('2026-01-15');
  const result = getMonthRange(now, 'last');
  assert.equal(result.start, '2025-12-01');
  assert.equal(result.end, '2025-12-31');
});

test('getYearRange returns correct this year range', () => {
  const now = new Date('2026-06-15');
  const result = getYearRange(now, 'this');
  assert.equal(result.start, '2026-01-01');
  assert.equal(result.end, '2026-12-31');
});

test('getYearRange returns correct last year range', () => {
  const now = new Date('2026-06-15');
  const result = getYearRange(now, 'last');
  assert.equal(result.start, '2025-01-01');
  assert.equal(result.end, '2025-12-31');
});
