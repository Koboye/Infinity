// Packs the question bank into the stand-alone page served at /games/exam-prep/ (public/games/exam-prep/bank.js).
//   node tools/build-static.mjs        (run from apps/exam-prep/)
import { register } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
register('../tests/fakes/loader.mjs', import.meta.url);
const { COLLEGES } = await import('../src/data/departments.js');
const { SEED } = await import('../src/data/seedQuestions.js');
const IMPORTED = JSON.parse(readFileSync(new URL('../src/data/imported.json', import.meta.url), 'utf8'));
const out = [];
for (const c of COLLEGES) for (const d of c.depts) {
  const qs = [...(SEED[d.id] || []), ...(IMPORTED[d.id] || [])];
  if (!qs.length) continue;
  out.push({ id: d.id, name: d.name, group: c.id === 'grade12' ? 'g12' : c.id === 'freshman' ? 'fresh' : 'uni', college: c.name, q: qs.map((x) => [x.t, x.o, x.a, x.e, x.topic || '']) });
}
const dir = new URL('../../../public/games/exam-prep/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('bank.js', dir), `window.BANK=${JSON.stringify(out)};`);
console.log(out.length, 'departments,', out.reduce((n, d) => n + d.q.length, 0), 'questions');
