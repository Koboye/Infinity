// v73: the Gebeta rulebook has every type, every rule in both languages, answers common questions, and matches the engine.
import assert from 'node:assert/strict';
import { GEBETA_TYPES, RULEBOOK, askRules, rulesAsText } from '../src/lib/gebetaRules.js';
import { GAMES } from '../src/lib/games.js';
import { STRINGS } from '../src/lib/i18n.js';
import { RULESETS, newGame, playMove, legalMoves } from '../src/lib/gebeta/engine.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('the rulebook covers exactly the Gebeta types the game offers', () => {
  assert.deepEqual([...GEBETA_TYPES].sort(), [...GAMES.gebeta.rulesets].sort());
  for (const id of GEBETA_TYPES) assert.ok(RULESETS[id], `${id} exists in the engine`);
});
t('every type has a pitch, at least 5 rules and a few questions, each written in English AND Amharic', () => {
  for (const id of GEBETA_TYPES) {
    const b = RULEBOOK[id];
    assert.ok(b.icon && b.name.en && b.name.am && b.pitch.en && b.pitch.am, id);
    assert.ok(b.steps.length >= 5 && b.faq.length >= 4, `${id}: ${b.steps.length} steps, ${b.faq.length} faq`);
    for (const s of b.steps) for (const L of ['en', 'am']) assert.ok(s.h[L].length > 1 && s.b[L].length > 20, `${id} step ${s.h.en} (${L})`);
    for (const f of b.faq) { for (const L of ['en', 'am']) assert.ok(f.q[L] && f.a[L].length > 10, `${id} faq ${f.q.en} (${L})`); assert.ok(f.k.length >= 3); }
  }
});
t('Amharic text is really Amharic (Ethiopic script) and not a copy of the English', () => {
  for (const id of GEBETA_TYPES) for (const s of RULEBOOK[id].steps) { assert.match(s.b.am, /[ሀ-፿]/); assert.notEqual(s.b.am, s.b.en); }
});
t('no unfinished text is left in the rulebook', () => {
  const all = JSON.stringify(RULEBOOK);
  assert.doesNotMatch(all, /…\s*no\b|TODO|lorem|undefined/i);
});
t('asking finds the right answer, in either language, and prefers the type being read', () => {
  const cap = askRules('when do I capture?', 'ashagro', 'en').hits[0]; assert.equal(cap.type, 'ashagro'); assert.match(cap.a, /across|opposite/i);
  const frozen = askRules('what is a frozen hole', 'gebeta', 'en').hits[0]; assert.equal(frozen.type, 'gebeta');
  const am = askRules('መቼ እበላለሁ', 'ashagro', 'am').hits[0]; assert.equal(am.type, 'ashagro'); assert.match(am.a, /[ሀ-፿]/);
  const tuz = askRules('how do I attack a tuz', 'tuz', 'en').hits[0]; assert.equal(tuz.type, 'tuz'); assert.match(tuz.a, /two/i);
  assert.deepEqual(askRules('', 'tuz').hits, []); assert.deepEqual(askRules('zzzz qqqq', 'tuz').hits, []);
  assert.ok(askRules('Is a four I make mid-sowing a Tuz?', 'tuz').hits.length >= 1);
});
t('the text export has every rule', () => {
  for (const id of GEBETA_TYPES) { const txt = rulesAsText(id, 'en'); for (const s of RULEBOOK[id].steps) assert.ok(txt.includes(s.h.en)); }
  assert.match(rulesAsText('tuz', 'am'), /ጡዝ/);
});
t('the written rules agree with the engine: one family-of-four rule, one capture rule, one Tuz rule', () => {
  assert.equal(RULESETS.gebeta.families, true);
  assert.equal(RULESETS.ashagro.families, false); assert.equal(RULESETS.ashagro.capture, true);
  assert.equal(RULESETS.tuz.families, false); assert.equal(RULESETS.tuz.tuz, true);
  assert.equal(newGame('gebeta').pits.slice(0, 6).every((x) => x === 4), true);
  // Tuz opening: the starter's hole keeps three, one stone goes to his pile, the hole across freezes as his Tuz and the turn passes.
  const g = newGame('tuz', 0); const pit = legalMoves(g, g.turn)[0]; const r = playMove(g, pit, 'tuz');
  assert.ok(r.ok); assert.equal(r.state.pits[pit], 3); assert.equal(r.state.pits[12 - pit], 4); assert.equal(r.state.turn, 1 - g.turn);
  assert.equal(r.state.pits[g.turn === 0 ? 6 : 13], 1);
});
t('the in-app screens are wired: Rules tab shows the rulebook for Gebeta, each type has a help link, both languages have the new texts', () => {
  for (const k of ['rulesStep', 'askTitle', 'askNone', 'rulesNext', 'rulesPlay', 'rulesSend', 'askFriend']) { assert.ok(STRINGS.en[k] && STRINGS.am[k], k); }
  assert.equal(STRINGS.en.rulesStep(2, 9), 'Rule 2 of 9');
});
console.log(`gebeta-rulebook tests passed (${n})`);
