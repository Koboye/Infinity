import { describe, it, expect } from 'vitest';
import {
  DAY, formatNumber, accountInfo, itemStatus, isExpiringSoon,
  periodTotals, saleProfit, calcStreak, bestSellers,
} from './format';

describe('formatNumber', () => {
  it('formats with thousands separators', () => {
    expect(formatNumber(128950)).toBe('128,950');
  });
  it('treats missing/NaN as zero', () => {
    expect(formatNumber(undefined)).toBe('0');
    expect(formatNumber(null)).toBe('0');
  });
});

describe('accountInfo — customer/supplier balance math', () => {
  const now = Date.now();

  it('is zero for a person with no ledger rows', () => {
    expect(accountInfo([], 'p1').balance).toBe(0);
  });

  it('reflects an unpaid charge as the full balance', () => {
    const ledger = [{ personId: 'p1', kind: 'charge', amount: 500, ts: now - DAY, due: now + DAY }];
    const info = accountInfo(ledger, 'p1', now);
    expect(info.balance).toBe(500);
    expect(info.daysLate).toBe(0); // not due yet
  });

  it('applies a payment against the balance', () => {
    const ledger = [
      { personId: 'p1', kind: 'charge', amount: 500, ts: now - DAY },
      { personId: 'p1', kind: 'payment', amount: 200, ts: now },
    ];
    expect(accountInfo(ledger, 'p1', now).balance).toBe(300);
  });

  it('never goes negative when overpaid', () => {
    const ledger = [
      { personId: 'p1', kind: 'charge', amount: 100, ts: now - DAY },
      { personId: 'p1', kind: 'payment', amount: 300, ts: now },
    ];
    expect(accountInfo(ledger, 'p1', now).balance).toBe(0);
  });

  it('applies payments to the oldest charge first (FIFO)', () => {
    const ledger = [
      { personId: 'p1', kind: 'charge', amount: 100, ts: now - 3 * DAY, due: now - 2 * DAY },
      { personId: 'p1', kind: 'charge', amount: 100, ts: now - 1 * DAY, due: now + 5 * DAY },
      { personId: 'p1', kind: 'payment', amount: 100, ts: now },
    ];
    const info = accountInfo(ledger, 'p1', now);
    // The old, overdue charge should be the one paid off; only the newer,
    // not-yet-due charge remains — so the account should NOT show as late.
    expect(info.balance).toBe(100);
    expect(info.daysLate).toBe(0);
  });

  it('flags an overdue balance with days-late > 0', () => {
    const ledger = [{ personId: 'p1', kind: 'charge', amount: 500, ts: now - 10 * DAY, due: now - 3 * DAY }];
    const info = accountInfo(ledger, 'p1', now);
    expect(info.balance).toBe(500);
    expect(info.daysLate).toBeGreaterThan(0);
  });

  it('only counts rows for the given person', () => {
    const ledger = [
      { personId: 'p1', kind: 'charge', amount: 500, ts: now },
      { personId: 'p2', kind: 'charge', amount: 999, ts: now },
    ];
    expect(accountInfo(ledger, 'p1', now).balance).toBe(500);
  });
});

describe('itemStatus', () => {
  it('is "out" at zero or negative qty', () => {
    expect(itemStatus({ qty: 0, alert: 5 })).toBe('out');
  });
  it('is "low" at or below the alert threshold', () => {
    expect(itemStatus({ qty: 5, alert: 5 })).toBe('low');
  });
  it('is "ok" above the alert threshold', () => {
    expect(itemStatus({ qty: 6, alert: 5 })).toBe('ok');
  });
});

describe('isExpiringSoon', () => {
  it('is false with no expiry set', () => {
    expect(isExpiringSoon({ expiry: null })).toBe(false);
  });
  it('is true within the window', () => {
    expect(isExpiringSoon({ expiry: Date.now() + 5 * DAY }, 30)).toBe(true);
  });
  it('is false outside the window', () => {
    expect(isExpiringSoon({ expiry: Date.now() + 60 * DAY }, 30)).toBe(false);
  });
});

describe('saleProfit / periodTotals', () => {
  const sale = (ts, total, lines) => ({ ts, total, lines });

  it('computes per-sale profit as (price - cost) * qty', () => {
    const s = sale(Date.now(), 100, [{ price: 50, buy: 30, qty: 2 }]);
    expect(saleProfit(s)).toBe(40);
  });

  it('subtracts expenses from margin to get net profit for a period', () => {
    const now = Date.now();
    const sales = [sale(now, 100, [{ price: 50, buy: 30, qty: 2 }])]; // margin 40
    const expenses = [{ ts: now, amount: 15 }];
    const totals = periodTotals(sales, expenses, now - DAY, now + DAY);
    expect(totals.salesTotal).toBe(100);
    expect(totals.expTotal).toBe(15);
    expect(totals.profit).toBe(25);
  });

  it('excludes sales and expenses outside the range', () => {
    const now = Date.now();
    const sales = [sale(now - 10 * DAY, 999, [])];
    const totals = periodTotals(sales, [], now - DAY, now + DAY);
    expect(totals.salesTotal).toBe(0);
  });
});

describe('calcStreak', () => {
  it('is zero with no sales', () => {
    expect(calcStreak([])).toBe(0);
  });
  it('counts consecutive days including today', () => {
    const now = Date.now();
    const sales = [
      { ts: now },
      { ts: now - DAY },
      { ts: now - 2 * DAY },
    ];
    expect(calcStreak(sales, now)).toBe(3);
  });
  it('still counts a streak ending yesterday if today has no sale yet', () => {
    const now = Date.now();
    const sales = [{ ts: now - DAY }, { ts: now - 2 * DAY }];
    expect(calcStreak(sales, now)).toBe(2);
  });
  it('breaks on a gap', () => {
    const now = Date.now();
    const sales = [{ ts: now }, { ts: now - 3 * DAY }];
    expect(calcStreak(sales, now)).toBe(1);
  });
});

describe('bestSellers', () => {
  it('sums quantity by item name across sales and sorts descending', () => {
    const sales = [
      { lines: [{ name: 'Sugar', qty: 2 }, { name: 'Oil', qty: 1 }] },
      { lines: [{ name: 'Sugar', qty: 3 }] },
    ];
    const result = bestSellers(sales, 5);
    expect(result[0]).toEqual({ name: 'Sugar', qty: 5 });
    expect(result[1]).toEqual({ name: 'Oil', qty: 1 });
  });
  it('respects the limit', () => {
    const sales = [{ lines: [{ name: 'A', qty: 1 }, { name: 'B', qty: 1 }, { name: 'C', qty: 1 }] }];
    expect(bestSellers(sales, 2)).toHaveLength(2);
  });
});
