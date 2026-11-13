import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const t = (n, f) => { f(); console.log('ok', n); };
t('home screen lists Addis Runner and ExamPrep', () => {
  const s = read('src/components/Screens.jsx'), i = read('src/lib/i18n.js');
  assert.ok(s.includes("/games/addis-runner/index.html") && s.includes('NEXT_PUBLIC_EXAMPREP_URL'));
  for (const k of ['examName', 'examTag', 'runnerName', 'runnerTag']) assert.equal((i.match(new RegExp(`${k}:`, 'g')) || []).length, 2, `${k} in English and Amharic`);
});
t('the served Addis Runner page matches apps/addis-runner', () => {
  for (const f of ['index.html', 'src/game.js', 'src/route.js']) assert.equal(read(`public/games/addis-runner/${f}`), read(`apps/addis-runner/${f}`), `${f} is in sync (copy apps/addis-runner into public/games/addis-runner)`);
});
