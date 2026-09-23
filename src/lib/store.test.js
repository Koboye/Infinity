// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { accountInfo } from './utils/format';

// Reset to a clean slate before every test so tests can't leak state into
// each other via the persisted (localStorage-backed) store.
beforeEach(() => {
  useStore.getState().resetAll();
});

describe('addItem / stock', () => {
  it('adds an item with sane numeric defaults', () => {
    const item = useStore.getState().addItem({ name: '  Sugar 1kg  ', buy: '60', sell: '75', qty: '10', alert: '3' });
    expect(item.name).toBe('Sugar 1kg'); // trimmed
    expect(item.buy).toBe(60);
    expect(item.sell).toBe(75);
    expect(item.qty).toBe(10);
    expect(useStore.getState().items).toHaveLength(1);
  });

  it('treats garbage numeric input as zero rather than NaN', () => {
    const item = useStore.getState().addItem({ name: 'Mystery item', buy: 'abc', sell: null, qty: undefined });
    expect(item.buy).toBe(0);
    expect(item.sell).toBe(0);
    expect(item.qty).toBe(0);
  });
});

describe('recordSale', () => {
  it('deducts sold quantity from stock', () => {
    const s = useStore.getState();
    const item = s.addItem({ name: 'Rice 5kg', buy: 800, sell: 980, qty: 10 });
    useStore.getState().recordSale({ lines: [{ itemId: item.id, qty: 3 }], method: 'cash' });
    const updated = useStore.getState().items.find((i) => i.id === item.id);
    expect(updated.qty).toBe(7);
  });

  it('never drives stock below zero even if oversold', () => {
    const item = useStore.getState().addItem({ name: 'Soap', buy: 20, sell: 45, qty: 2 });
    useStore.getState().recordSale({ lines: [{ itemId: item.id, qty: 5 }], method: 'cash' });
    const updated = useStore.getState().items.find((i) => i.id === item.id);
    expect(updated.qty).toBe(0);
  });

  it('computes the sale total from each line\'s live sell price', () => {
    const item = useStore.getState().addItem({ name: 'Oil 1L', buy: 300, sell: 320, qty: 20 });
    const sale = useStore.getState().recordSale({ lines: [{ itemId: item.id, qty: 4 }], method: 'cash' });
    expect(sale.total).toBe(320 * 4);
  });

  it('does NOT post a ledger charge for a cash sale', () => {
    const item = useStore.getState().addItem({ name: 'Bread', buy: 10, sell: 15, qty: 50 });
    useStore.getState().recordSale({ lines: [{ itemId: item.id, qty: 2 }], method: 'cash' });
    expect(useStore.getState().ledger).toHaveLength(0);
  });

  it('posts a ledger charge for a credit sale tied to a customer', () => {
    const s = useStore.getState();
    const item = s.addItem({ name: 'Flour', buy: 40, sell: 55, qty: 30 });
    const customer = s.addPerson({ name: 'Alemu Bekele', type: 'customer' });
    const sale = useStore.getState().recordSale({ lines: [{ itemId: item.id, qty: 5 }], method: 'credit', personId: customer.id, dueDays: 7 });
    const ledger = useStore.getState().ledger;
    expect(ledger).toHaveLength(1);
    expect(ledger[0].personId).toBe(customer.id);
    expect(ledger[0].amount).toBe(sale.total);
    expect(ledger[0].kind).toBe('charge');
  });

  it('rolls back correctly for a multi-line sale across different items', () => {
    const s = useStore.getState();
    const a = s.addItem({ name: 'A', buy: 1, sell: 2, qty: 10 });
    const b = s.addItem({ name: 'B', buy: 1, sell: 3, qty: 10 });
    useStore.getState().recordSale({ lines: [{ itemId: a.id, qty: 2 }, { itemId: b.id, qty: 1 }], method: 'cash' });
    const items = useStore.getState().items;
    expect(items.find((i) => i.id === a.id).qty).toBe(8);
    expect(items.find((i) => i.id === b.id).qty).toBe(9);
  });
});

describe('recordBuy (restocking)', () => {
  it('increases stock and updates the item\'s cost price', () => {
    const item = useStore.getState().addItem({ name: 'Rice', buy: 800, sell: 980, qty: 5 });
    useStore.getState().recordBuy({ lines: [{ itemId: item.id, qty: 10, cost: 850 }], method: 'cash' });
    const updated = useStore.getState().items.find((i) => i.id === item.id);
    expect(updated.qty).toBe(15);
    expect(updated.buy).toBe(850);
  });

  it('posts a supplier ledger charge on a credit purchase', () => {
    const s = useStore.getState();
    const item = s.addItem({ name: 'Rice', buy: 800, sell: 980, qty: 5 });
    const supplier = s.addPerson({ name: 'Merkato Supplier', type: 'supplier' });
    useStore.getState().recordBuy({ lines: [{ itemId: item.id, qty: 10, cost: 800 }], method: 'credit', supplierId: supplier.id });
    const ledger = useStore.getState().ledger;
    expect(ledger).toHaveLength(1);
    expect(ledger[0].personId).toBe(supplier.id);
    expect(ledger[0].amount).toBe(8000);
  });
});

describe('recordPayment', () => {
  it('reduces an outstanding balance', () => {
    const s = useStore.getState();
    const item = s.addItem({ name: 'X', buy: 10, sell: 20, qty: 100 });
    const customer = s.addPerson({ name: 'Mekdes Tadesse', type: 'customer' });
    useStore.getState().recordSale({ lines: [{ itemId: item.id, qty: 10 }], method: 'credit', personId: customer.id });
    // balance is now 200
    useStore.getState().recordPayment({ personId: customer.id, amount: 80, method: 'cash' });
    expect(accountInfo(useStore.getState().ledger, customer.id).balance).toBe(120);
  });

  it('never accepts a payment larger than the actual balance', () => {
    const s = useStore.getState();
    const item = s.addItem({ name: 'X', buy: 10, sell: 20, qty: 100 });
    const customer = s.addPerson({ name: 'Abebe Kebede', type: 'customer' });
    useStore.getState().recordSale({ lines: [{ itemId: item.id, qty: 5 }], method: 'credit', personId: customer.id });
    // balance is 100 — try to overpay by a lot
    const row = useStore.getState().recordPayment({ personId: customer.id, amount: 10000, method: 'cash' });
    expect(row.amount).toBe(100);
  });

  it('returns null and records nothing when there is no balance to pay', () => {
    const customer = useStore.getState().addPerson({ name: 'No Debt', type: 'customer' });
    const row = useStore.getState().recordPayment({ personId: customer.id, amount: 50, method: 'cash' });
    expect(row).toBeNull();
    expect(useStore.getState().ledger).toHaveLength(0);
  });
});

describe('backup / restore (exportData + importData)', () => {
  it('round-trips business data exactly', () => {
    const s = useStore.getState();
    s.completeSetup({ name: 'Test Shop', town: 'Addis Ababa', role: 'shop' }, null);
    const item = s.addItem({ name: 'Sugar', buy: 60, sell: 75, qty: 10 });
    useStore.getState().recordSale({ lines: [{ itemId: item.id, qty: 2 }], method: 'cash' });

    const json = useStore.getState().exportData();
    useStore.getState().resetAll();
    expect(useStore.getState().items).toHaveLength(0);

    const ok = useStore.getState().importData(json);
    expect(ok).toBe(true);
    expect(useStore.getState().shop.name).toBe('Test Shop');
    expect(useStore.getState().items).toHaveLength(1);
    expect(useStore.getState().sales).toHaveLength(1);
  });

  it('refuses to import a backup from a different app', () => {
    const ok = useStore.getState().importData(JSON.stringify({ app: 'some-other-app', data: {} }));
    expect(ok).toBe(false);
  });

  it('refuses to import malformed JSON without throwing', () => {
    expect(() => useStore.getState().importData('not json{{{')).not.toThrow();
    expect(useStore.getState().importData('not json{{{')).toBe(false);
  });
});
