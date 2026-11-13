import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./fakes/loader.mjs', import.meta.url);
const C = await import('../src/lib/core.js');
const { COLLEGES, DEPARTMENTS, isDept } = await import('../src/data/departments.js');
const { SEED } = await import('../src/data/seedQuestions.js');
const { seedFor } = await import('../src/lib/seed.js');

// catalogue
assert.ok(DEPARTMENTS.length >= 60, 'many departments');
assert.equal(new Set(DEPARTMENTS.map((d) => d.id)).size, DEPARTMENTS.length, 'department ids are unique');
assert.ok(COLLEGES.every((c) => c.depts.length > 0));
for (const id of Object.keys(SEED)) assert.ok(isDept(id), `seed department exists: ${id}`);
// seed quality gate: every sample question is itself valid and none repeats another
for (const d of Object.keys(SEED)) {
  const pool = [];
  for (const q of seedFor(d)) {
    const c = C.cleanQuestion({ text: q.text, options: q.options, answer: q.answer, explanation: q.explanation }, d);
    assert.ok(c.ok, `${q.id}: ${c.error}`); assert.equal(C.findDuplicate(q, pool), null, `${q.id} repeats another seed question`); pool.push(q);
  }
}

// subscription time
const now = Date.UTC(2026, 10, 13);
assert.equal(C.subState(0, now).subscribed, false);
assert.equal(C.subState(now + 1, now).subscribed, true);
assert.equal(C.subState(now + 3 * 86_400_000, now).daysLeft, 3);
assert.equal(C.extendUntil(0, now), now + C.MONTH_MS, 'first month starts now');
assert.equal(C.extendUntil(now + 10 * 86_400_000, now), now + 10 * 86_400_000 + C.MONTH_MS, 'a second payment stacks after the time left');
assert.equal(C.extendUntil(now - 5, now), now + C.MONTH_MS, 'expired time is not counted');
assert.equal(C.extendUntil(now + 80 * 86_400_000, now, 1, true), now + C.MAX_AHEAD_MS, 'earned months stop 90 days ahead');
assert.equal(C.extendUntil(now + 200 * 86_400_000, now, 1, true), now + 200 * 86_400_000, 'a long paid subscription is never cut short');

// phones
assert.equal(C.cleanPhone('+251 911 234 567'), '0911234567'); assert.equal(C.cleanPhone('911234567'), '0911234567'); assert.equal(C.cleanPhone('0712345678'), '0712345678');
assert.equal(C.cleanPhone('0112345678'), ''); assert.equal(C.cleanPhone('abc'), '');

// question checks
const good = { text: 'Which protocol resolves a domain name to an IP address?', options: ['DNS', 'DHCP', 'ARP', 'FTP'], answer: 0, explanation: 'DNS maps human-readable domain names to IP addresses.' };
assert.ok(C.cleanQuestion(good, 'computer-science').ok);
for (const [bad, why] of [
  [{ ...good, text: 'short' }, /15 to 600/], [{ ...good, options: ['a', 'b', 'c'] }, /4 options/], [{ ...good, options: ['DNS', 'dns', 'ARP', 'FTP'] }, /different/],
  [{ ...good, answer: 4 }, /correct/], [{ ...good, answer: 'x' }, /correct/], [{ ...good, explanation: 'because' }, /Explain/], [null, /15 to 600/],
]) { const r = C.cleanQuestion(bad, 'computer-science'); assert.equal(r.ok, false); assert.match(r.error, why); }
assert.equal(C.cleanQuestion(good, 'not-a-dept').ok, false);

// duplicates
const pool = [{ id: 'x', ...good }];
assert.ok(C.findDuplicate({ ...good, text: 'WHICH protocol resolves a domain name to an IP address??' }, pool), 'case and punctuation do not hide a copy');
assert.ok(C.findDuplicate({ ...good, text: 'Which protocol resolves a domain name into an IP address?' }, pool), 'a one-word change is still a copy');
assert.ok(C.findDuplicate({ ...good, text: 'Name the service that turns hostnames into addresses on the internet' }, pool), 'same options and answer = same question');
const calc = { text: 'What is the derivative of x^3 with respect to x in calculus?', options: ['3x^2', 'x^2', '3x', 'x^3/3'], answer: 0 };
assert.equal(C.findDuplicate({ ...calc, text: 'What is the derivative of x^4 with respect to x in calculus?', options: ['4x^3', 'x^3', '4x', 'x^4/4'] }, [{ id: 'c', ...calc }]), null, 'same wording but different numbers is a different question');
assert.ok(C.findDuplicate({ ...calc, text: 'What is the derivative of x^3 with respect to x in calculus ?' }, [{ id: 'c', ...calc }]), 'but a respaced copy is caught');
assert.ok(C.cleanQuestion({ text: 'Which expression gives gross profit for a trading business?', options: ['Sales + Cost', 'Sales - Cost', 'Sales * Cost', 'Sales / Cost'], answer: 1, explanation: 'Gross profit is sales minus cost of goods sold.' }, 'accounting-finance').ok, 'options that differ only by an operator are different');
assert.equal(C.findDuplicate({ text: 'What does the acronym HTTP stand for in web communication?', options: ['HyperText Transfer Protocol', 'High Transfer Text Process', 'Host Transfer Type Protocol', 'Hyper Terminal Transport Path'], answer: 0 }, pool), null, 'a different question passes');
console.log('core tests passed');
