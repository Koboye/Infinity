// Import questions you own or are licensed to use into src/data/imported.json.
//   node tools/import-questions.mjs questions.csv [--replace]
// CSV header: dept,question,A,B,C,D,answer,explanation,topic   (answer = A/B/C/D)
// JSON: [{ dept, text, options:[4], answer:0-3 or "A".."D", explanation, topic }]
// Every row is validated with the app's own rules and checked against the existing bank; rejects are listed, never silently dropped.
import { register } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
register('../tests/fakes/loader.mjs', import.meta.url);
const { cleanQuestion, findDuplicate } = await import('../src/lib/core.js');
const { SEED } = await import('../src/data/seedQuestions.js');
const OUT = new URL('../src/data/imported.json', import.meta.url).pathname;

function parseCsv(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some((x) => x.trim())) rows.push(row);
  const [h, ...r] = rows; const k = h.map((x) => x.trim().toLowerCase());
  return r.map((c) => Object.fromEntries(k.map((n, i) => [n, c[i] ?? ''])));
}
const ans = (a) => (/^[A-Da-d]$/.test(String(a).trim()) ? 'abcd'.indexOf(String(a).trim().toLowerCase()) : Number(a));
function toRaw(r) {
  if (Array.isArray(r.options)) return { dept: r.dept, text: r.text, options: r.options, answer: ans(r.answer), explanation: r.explanation, topic: r.topic };
  return { dept: r.dept, text: r.question, options: [r.a, r.b, r.c, r.d], answer: ans(r.answer), explanation: r.explanation, topic: r.topic };
}

const [file, flag] = process.argv.slice(2);
if (!file || !existsSync(file)) { console.error('Usage: node tools/import-questions.mjs <file.csv|file.json> [--replace]'); process.exit(1); }
const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const rows = (file.endsWith('.json') ? JSON.parse(text) : parseCsv(text)).map(toRaw);
const store = flag === '--replace' || !existsSync(OUT) ? {} : JSON.parse(readFileSync(OUT, 'utf8'));
let added = 0; const rejected = [];
rows.forEach((raw, i) => {
  const c = cleanQuestion(raw, raw.dept);
  if (!c.ok) return rejected.push(`row ${i + 1}: ${c.error}`);
  const pool = [...(SEED[raw.dept] || []), ...(store[raw.dept] || [])].map((x, n) => ({ id: String(n), text: x.t, options: x.o, answer: x.a }));
  const dup = findDuplicate(c.q, pool);
  if (dup) return rejected.push(`row ${i + 1}: duplicate (${dup.why})`);
  (store[raw.dept] ||= []).push({ t: c.q.text, o: c.q.options, a: c.q.answer, e: c.q.explanation, topic: c.q.topic });
  added++;
});
writeFileSync(OUT, JSON.stringify(store, null, 1));
console.log(`Imported ${added} of ${rows.length}. Rejected ${rejected.length}.`); rejected.slice(0, 50).forEach((r) => console.log('  ' + r));
