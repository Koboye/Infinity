// In-memory Firestore + Auth fake, just enough for route.js.
// It also enforces two real Firestore limits so tests catch them: no arrays inside arrays, and no `undefined` values.
const store = new Map(); // "col/id[/sub/id]" -> data
let clock = Date.now();
const clone = (o) => JSON.parse(JSON.stringify(o));

function assertStorable(v, path = '') {
  if (v === undefined) throw new Error(`Firestore: undefined value at ${path}`);
  if (Array.isArray(v)) v.forEach((x, i) => { if (Array.isArray(x)) throw new Error(`Firestore: nested array at ${path}[${i}]`); assertStorable(x, `${path}[${i}]`); });
  else if (v && typeof v === 'object' && !(v instanceof Date) && v.__ts === undefined && v.__inc === undefined) for (const [k, x] of Object.entries(v)) assertStorable(x, `${path}.${k}`);
}

function apply(existing, data, merge) {
  assertStorable(data);
  const base = merge && existing ? { ...existing } : {};
  for (const [k, v] of Object.entries(data)) {
    if (merge && k.includes('.')) { // update({'a.b': v}) writes the nested field, like real Firestore
      const parts = k.split('.'); let o = base;
      for (const part of parts.slice(0, -1)) { o[part] = { ...(o[part] || {}) }; o = o[part]; }
      o[parts[parts.length - 1]] = v;
    } else if (v && v.__inc !== undefined) base[k] = (base[k] || 0) + v.__inc;
    else if (v instanceof Date) base[k] = { __date: v.getTime() };
    else base[k] = v && v.__ts ? { __ms: ++clock } : v;
  }
  return base;
}
const withTs = (d) => {
  if (!d) return d; const o = { ...d };
  if (o.createdAt?.__ms) { const ms = o.createdAt.__ms; o.createdAt = { toMillis: () => ms, __ms: ms }; }
  return o;
};
const lastId = (path) => path.split('/').pop();
const docRef = (path) => ({
  id: lastId(path), path,
  collection: (sub) => collection(`${path}/${sub}`),
  async get() { const d = store.get(path); return { exists: d !== undefined, id: lastId(path), data: () => withTs(d && clone(d)), _raw: d }; },
  async set(data, opts) { store.set(path, apply(store.get(path), data, opts?.merge)); },
  async update(data) { store.set(path, apply(store.get(path), data, true)); },
  async delete() { store.delete(path); },
});
const collection = (name) => ({
  doc: (id) => docRef(`${name}/${id}`),
  where(f, op, v) { return query(name, { f: [[f, op, v]], ord: null, lim: 99 }); },
});
const val = (d, f) => { const x = d[f]; return x && x.__ms !== undefined ? x.__ms : x; };
const cmp = { '==': (a, b) => a === b, '>=': (a, b) => a >= b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '<': (a, b) => a < b };
const query = (name, q) => ({
  where(f, op, v) { q.f.push([f, op, v]); return this; },
  orderBy(f) { q.ord = f; return this; },
  limit(n) { q.lim = n; return this; },
  async get() {
    const depth = name.split('/').length + 1;
    let rows = [...store.entries()].filter(([k]) => k.startsWith(name + '/') && k.split('/').length === depth)
      .filter(([, d]) => q.f.every(([f, op, v]) => cmp[op](val(d, f), v instanceof Date ? v.getTime() : v)));
    if (q.ord) rows.sort((a, b) => (val(a[1], q.ord) || 0) - (val(b[1], q.ord) || 0));
    return { docs: rows.slice(0, q.lim).map(([k, d]) => ({ id: lastId(k), data: () => withTs(clone(d)) })) };
  },
});
const db = {
  collection,
  async runTransaction(fn) {
    const writes = [];
    const tx = {
      get: (ref) => ref.get(),
      set: (ref, data, opts) => { assertStorable(data); writes.push(() => ref.set(data, opts)); },
      update: (ref, data) => writes.push(() => ref.update(data)),
      delete: (ref) => writes.push(() => ref.delete()),
    };
    const out = await fn(tx);
    for (const w of writes) await w();
    return out;
  },
};
export const adminDb = () => db;
export const adminAuth = () => ({ verifyIdToken: async (t) => { if (!t.startsWith('tok:')) throw new Error('bad'); return { uid: t.slice(4), name: t.slice(4) + '-name' }; } });
export const __store = store;
