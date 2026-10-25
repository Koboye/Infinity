// Asks the checkers computer for a move without blocking the UI (Web Worker), with a safe in-page fallback.
import { chooseCheckersMove, chooseHuffPick, LEVELS } from './ai.js';

let worker; // undefined = not created yet, null = unavailable
let seq = 0;
const pending = new Map();
let failures = 0;

const fallback = (job) => (job.kind === 'huff' ? chooseHuffPick(job.state, job.rules) : chooseCheckersMove(job.state, job.rules, job.level, Math.random, { maxMs: 500 }));

function failAll() {
  try { worker && worker.terminate(); } catch { /* already gone */ }
  failures += 1;
  worker = failures >= 3 ? null : undefined;
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
      job.res(e.data.failed ? fallback(job) : e.data.result);
    };
    worker.onerror = failAll;
  } catch { worker = null; }
  return worker;
}

function ask(kind, state, rules, level) {
  const w = getWorker();
  const job = { kind, state, rules, level };
  if (!w) return Promise.resolve(fallback(job));
  return new Promise((res) => {
    const id = ++seq; job.res = res; pending.set(id, job);
    // A worker that never answers must never freeze the game: after the thinking time plus a grace period, use the in-page fallback.
    job.timer = setTimeout(() => { if (!pending.has(id)) return; pending.delete(id); failAll(); res(fallback(job)); }, (LEVELS[level]?.ms ?? 600) + 2500);
    try { w.postMessage({ id, kind, state, rules, level }); } catch { clearTimeout(job.timer); pending.delete(id); res(fallback(job)); }
  });
}

export const chooseCheckersMoveAsync = (state, rules = 'american', level = 'medium') => ask('move', state, rules, level);
export const chooseHuffPickAsync = (state, rules = 'flying') => ask('huff', state, rules, 'medium');
