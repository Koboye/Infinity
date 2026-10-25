// Asks the Gebeta computer for a move without blocking the UI (Web Worker), with a safe in-page fallback.
import { chooseMove, LEVELS } from './ai.js';

let worker; // undefined = not created yet, null = unavailable
let seq = 0;
const pending = new Map();

const fallback = (job) => chooseMove(job.state, job.rules, job.level, Math.random, { maxMs: 400, ...(job.auto ? { auto: job.state.turn } : {}) });

let failures = 0;
function failAll() {
  try { worker && worker.terminate(); } catch { /* already gone */ }
  failures += 1;
  worker = failures >= 3 ? null : undefined; // a fresh worker is created next turn; after 3 failures stay on the in-page fallback
  const jobs = [...pending.values()]; pending.clear();
  for (const job of jobs) { clearTimeout(job.timer); job.res(fallback(job)); }
}

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === 'undefined') { worker = null; return worker; }
    worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const job = pending.get(e.data.id); if (!job) return;
      pending.delete(e.data.id); clearTimeout(job.timer);
      job.res(e.data.move === undefined ? fallback(job) : e.data.move);
    };
    worker.onerror = failAll;
  } catch { worker = null; }
  return worker;
}

export function chooseMoveAsync(state, rules = 'gebeta', level = 'medium', auto = false) {
  const w = getWorker();
  const job = { state, rules, level, auto };
  if (!w) return Promise.resolve(fallback(job));
  return new Promise((res) => {
    const id = ++seq; job.res = res; pending.set(id, job);
    // A worker that never answers (killed by the phone, stuck, blocked) must never freeze the game:
    // after the level's thinking time plus a grace period, drop the worker and play with the in-page fallback.
    job.timer = setTimeout(() => { if (!pending.has(id)) return; pending.delete(id); failAll(); res(fallback(job)); }, (LEVELS[level]?.ms ?? 450) + 2500);
    try { w.postMessage({ id, state, rules, level, auto }); } catch { clearTimeout(job.timer); pending.delete(id); res(fallback(job)); }
  });
}
