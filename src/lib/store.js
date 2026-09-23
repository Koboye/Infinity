/**
 * Altimate — data store (zustand + localStorage).
 * Local-first: every sale is saved on the phone the moment it is made, so the
 * app works fully offline and a sale is never lost. Version 2 adds sync.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { accountInfo, DAY } from '@/lib/utils/format';

const uid = () => nanoid(8);
const n = (v) => Number(v) || 0;

const EMPTY = {
  shop: null,          // { name, town, phone, role }
  pinHash: null,
  lang: 'am',
  calendar: 'et',
  dailyGoal: 0,
  goalCelebratedOn: 0,   // day-start ts of the last day the goal toast already fired
  items: [],           // { id, name, buy, sell, qty, unit, alert, expiry }
  people: [],          // { id, name, phone, type: 'customer'|'supplier', limit }
  ledger: [],          // { id, personId, ts, kind: 'charge'|'payment', amount, note, due? }
  sales: [],           // { id, ts, lines:[{itemId,name,qty,price,buy}], total, method, personId }
  buys: [],            // { id, ts, supplierId, lines:[{itemId,name,qty,cost}], total, method }
  expenses: [],        // { id, ts, cat, amount, note }
  adjustments: [],     // { id, ts, itemId, name, from, to, reason }
};

const DATA_KEYS = Object.keys(EMPTY);

// Sync connection state — device-local, deliberately kept OUT of DATA_KEYS
// so it's never included in the JSON backup/restore feature or pushed as
// part of the business-data snapshot (see src/lib/sync.js).
const SYNC_EMPTY = {
  companyToken: null,        // the shop code entered in Settings → Company Sync
  syncStatus: 'disconnected', // 'disconnected' | 'syncing' | 'synced' | 'error'
  lastSyncAt: null,
  lastSyncError: null,
};

export const useStore = create(
  persist(
    (set, get) => ({
      ...EMPTY,
      ...SYNC_EMPTY,

      /* ── company sync (v2) ── */
      setCompanyToken: (companyToken) => set({ companyToken, syncStatus: 'disconnected', lastSyncError: null }),
      disconnectCompany: () => set({ ...SYNC_EMPTY }),
      setSyncStatus: (syncStatus, lastSyncError = null) => set({
        syncStatus,
        lastSyncError,
        ...(syncStatus === 'synced' ? { lastSyncAt: Date.now() } : {}),
      }),

      /* ── setup & settings ── */
      completeSetup: (shop, pinHash) => set({ shop, pinHash }),
      updateShop: (patch) => set((s) => ({ shop: { ...s.shop, ...patch } })),
      setLang: (lang) => set({ lang }),
      setCalendar: (calendar) => set({ calendar }),
      setPinHash: (pinHash) => set({ pinHash }),
      setDailyGoal: (dailyGoal) => set({ dailyGoal: n(dailyGoal) }),
      markGoalCelebrated: (dayStart) => set({ goalCelebratedOn: dayStart }),

      /* ── items ── */
      addItem: (data) => {
        const item = { id: uid(), name: data.name.trim(), buy: n(data.buy), sell: n(data.sell), qty: n(data.qty), unit: data.unit || 'piece', alert: n(data.alert), expiry: data.expiry || null };
        set((s) => ({ items: [...s.items, item] }));
        return item;
      },
      updateItem: (id, data) => set((s) => ({
        items: s.items.map((i) => (i.id === id
          ? { ...i, name: data.name.trim(), buy: n(data.buy), sell: n(data.sell), qty: n(data.qty), unit: data.unit, alert: n(data.alert), expiry: data.expiry || null }
          : i)),
      })),
      deleteItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      adjustItem: (id, to, reason) => set((s) => {
        const item = s.items.find((i) => i.id === id);
        if (!item) return {};
        return {
          items: s.items.map((i) => (i.id === id ? { ...i, qty: Math.max(0, n(to)) } : i)),
          adjustments: [...s.adjustments, { id: uid(), ts: Date.now(), itemId: id, name: item.name, from: item.qty, to: n(to), reason }],
        };
      }),

      /* ── people ── */
      addPerson: ({ name, phone, type, limit, opening }) => {
        const person = { id: uid(), name: name.trim(), phone: phone || '', type, limit: n(limit) };
        const ledger = n(opening) > 0
          ? [{ id: uid(), personId: person.id, ts: Date.now(), kind: 'charge', amount: n(opening), note: 'opening' }]
          : [];
        set((s) => ({ people: [...s.people, person], ledger: [...s.ledger, ...ledger] }));
        return person;
      },
      updatePerson: (id, { name, phone, limit }) => set((s) => ({
        people: s.people.map((p) => (p.id === id ? { ...p, name: name.trim(), phone: phone || '', limit: n(limit) } : p)),
      })),

      /* ── sell ── lines: [{ itemId, qty }] */
      recordSale: ({ lines, method, personId, dueDays }) => {
        const s = get();
        const now = Date.now();
        const saleLines = lines.map((l) => {
          const item = s.items.find((i) => i.id === l.itemId);
          return { itemId: item.id, name: item.name, qty: l.qty, price: item.sell, buy: item.buy };
        });
        const total = saleLines.reduce((a, l) => a + l.price * l.qty, 0);
        const sale = { id: uid(), ts: now, lines: saleLines, total, method, personId: personId || null };
        const charge = method === 'credit' && personId
          ? [{ id: uid(), personId, ts: now, kind: 'charge', amount: total, saleId: sale.id, note: 'sale', due: now + n(dueDays || 14) * DAY }]
          : [];
        set({
          sales: [...s.sales, sale],
          ledger: [...s.ledger, ...charge],
          items: s.items.map((i) => {
            const sold = lines.find((l) => l.itemId === i.id);
            return sold ? { ...i, qty: Math.max(0, i.qty - sold.qty) } : i;
          }),
        });
        return sale;
      },

      /* ── buy stock ── lines: [{ itemId, qty, cost }] */
      recordBuy: ({ lines, method, supplierId }) => {
        const s = get();
        const now = Date.now();
        const buyLines = lines.map((l) => {
          const item = s.items.find((i) => i.id === l.itemId);
          return { itemId: item.id, name: item.name, qty: l.qty, cost: l.cost };
        });
        const total = buyLines.reduce((a, l) => a + l.cost * l.qty, 0);
        const buy = { id: uid(), ts: now, supplierId: supplierId || null, lines: buyLines, total, method };
        const charge = method === 'credit' && supplierId
          ? [{ id: uid(), personId: supplierId, ts: now, kind: 'charge', amount: total, note: 'purchase', due: now + 14 * DAY }]
          : [];
        set({
          buys: [...s.buys, buy],
          ledger: [...s.ledger, ...charge],
          items: s.items.map((i) => {
            const bought = lines.find((l) => l.itemId === i.id);
            return bought ? { ...i, qty: i.qty + bought.qty, buy: bought.cost } : i;
          }),
        });
        return buy;
      },

      /* ── payments (customer pays me / I pay supplier) ── */
      recordPayment: ({ personId, amount, method }) => {
        const bal = accountInfo(get().ledger, personId).balance;
        const paid = Math.min(n(amount), bal);
        if (paid <= 0) return null;
        const row = { id: uid(), personId, ts: Date.now(), kind: 'payment', amount: paid, note: method };
        set((s) => ({ ledger: [...s.ledger, row] }));
        return row;
      },

      /* ── stock count ── entries: [{ itemId, counted }] → value of what is missing */
      finishCount: (entries) => {
        const s = get();
        const now = Date.now();
        let missingValue = 0;
        const adj = [];
        const items = s.items.map((i) => {
          const e = entries.find((x) => x.itemId === i.id);
          if (!e || e.counted === i.qty) return i;
          if (e.counted < i.qty) missingValue += (i.qty - e.counted) * i.buy;
          adj.push({ id: uid(), ts: now, itemId: i.id, name: i.name, from: i.qty, to: e.counted, reason: 'count' });
          return { ...i, qty: e.counted };
        });
        set({ items, adjustments: [...s.adjustments, ...adj] });
        return missingValue;
      },

      /* ── expenses ── */
      addExpense: ({ cat, amount, note }) => set((s) => ({
        expenses: [...s.expenses, { id: uid(), ts: Date.now(), cat, amount: n(amount), note: note || '' }],
      })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      /* ── backup ── */
      exportData: () => {
        const s = get();
        const data = {};
        DATA_KEYS.forEach((k) => { data[k] = s[k]; });
        return JSON.stringify({ app: 'gebeya-link', version: 1, savedAt: Date.now(), data }, null, 2);
      },
      importData: (json) => {
        try {
          const parsed = JSON.parse(json);
          if (parsed.app !== 'gebeya-link' || !parsed.data) return false;
          const next = {};
          DATA_KEYS.forEach((k) => { if (parsed.data[k] !== undefined) next[k] = parsed.data[k]; });
          set(next);
          return true;
        } catch { return false; }
      },
      resetAll: () => set({ ...EMPTY, ...SYNC_EMPTY }),
    }),
    {
      name: 'gebeya_link_v1',
      version: 1,
    }
  )
);
