/**
 * Pure formatting / date helpers — no storage, no browser-only APIs.
 * Includes the Ethiopian calendar (13 months) conversion.
 */

export const DAY = 86400000;

export const formatNumber = (n) =>
  Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const startOfDay = (ts = Date.now()) => {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
};

export const daysBetween = (a, b) => Math.floor((b - a) / DAY);

/* ─────────────── ETHIOPIAN CALENDAR ─────────────── */
const ET_MONTHS = ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን'];
const GC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const toEthiopian = (ts) => {
  const d = new Date(ts);
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  const jdn = day + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    year: 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  };
};

// "መስከረም 10" (Ethiopian) or "Sep 21" (Gregorian)
export const formatDate = (ts, calendar = 'et', withYear = false) => {
  if (!ts) return '';
  if (calendar === 'et') {
    const e = toEthiopian(ts);
    return `${ET_MONTHS[e.month - 1]} ${e.day}${withYear ? ` ${e.year}` : ''}`;
  }
  const d = new Date(ts);
  return `${GC_MONTHS[d.getMonth()]} ${d.getDate()}${withYear ? ` ${d.getFullYear()}` : ''}`;
};

/* ─────────────── STORE HELPERS (pure) ─────────────── */

// Balance for one person, plus how late their oldest unpaid charge is.
// Payments are applied to the oldest charges first.
export const accountInfo = (ledger, personId, now = Date.now()) => {
  const rows = ledger.filter((l) => l.personId === personId).sort((a, b) => a.ts - b.ts);
  let paid = rows.filter((r) => r.kind === 'payment').reduce((s, r) => s + r.amount, 0);
  const charged = rows.filter((r) => r.kind === 'charge').reduce((s, r) => s + r.amount, 0);
  let nextDue = null;
  for (const r of rows) {
    if (r.kind !== 'charge') continue;
    if (paid >= r.amount) { paid -= r.amount; continue; }
    paid = 0;
    if (r.due && (nextDue === null || r.due < nextDue)) nextDue = r.due;
  }
  const balance = Math.max(0, charged - rows.filter((r) => r.kind === 'payment').reduce((s, r) => s + r.amount, 0));
  const daysLate = balance > 0 && nextDue && nextDue < now ? daysBetween(nextDue, now) || 1 : 0;
  return { balance, nextDue: balance > 0 ? nextDue : null, daysLate };
};

export const itemStatus = (item) => {
  if (item.qty <= 0) return 'out';
  if (item.qty <= (item.alert || 0)) return 'low';
  return 'ok';
};

export const isExpiringSoon = (item, days = 30) =>
  !!item.expiry && item.expiry - Date.now() <= days * DAY;

export const saleProfit = (sale) =>
  sale.lines.reduce((s, l) => s + (l.price - (l.buy || 0)) * l.qty, 0);

// Sales, expenses and profit between two timestamps.
export const periodTotals = (sales, expenses, from, to = Date.now()) => {
  const inRange = (x) => x.ts >= from && x.ts <= to;
  const s = sales.filter(inRange);
  const e = expenses.filter(inRange);
  const salesTotal = s.reduce((a, x) => a + x.total, 0);
  const margin = s.reduce((a, x) => a + saleProfit(x), 0);
  const expTotal = e.reduce((a, x) => a + x.amount, 0);
  return { sales: s, salesTotal, expTotal, profit: margin - expTotal, margin };
};

// Consecutive days (ending today or yesterday) with at least one sale.
// Used for the small streak indicator on Home — a light, honest nudge to
// come back and log the day's sales, not a manipulative dark pattern.
export const calcStreak = (sales, now = Date.now()) => {
  if (!sales.length) return 0;
  const days = new Set(sales.map((s) => startOfDay(s.ts)));
  let cursor = startOfDay(now);
  if (!days.has(cursor)) cursor -= DAY; // today has no sale yet — still counts if yesterday was logged
  let streak = 0;
  while (days.has(cursor)) { streak++; cursor -= DAY; }
  return streak;
};

export const bestSellers = (sales, limit = 5) => {
  const map = {};
  sales.forEach((s) => s.lines.forEach((l) => {
    map[l.name] = (map[l.name] || 0) + l.qty;
  }));
  return Object.entries(map).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, limit);
};
