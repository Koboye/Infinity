// Asks the Gebeta computer for a move without blocking the UI (Web Worker), with a safe in-page fallback.
import { chooseMove } from './ai.js';

let worker; // undefined = not created yet, null = unavailable
let seq = 0;
const pending = new Map();

const fallback = (job) => chooseMove(job.state, job.rules, job.level, Math.random, { maxMs: 1000 });

function failAll() {
  worker = null;
  for (const [, job] of pending) job.res(fallback(job));
  pending.clear();
}

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === 'undefined') { worker = null; return worker; }
    worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const job = pending.get(e.data.id); if (!job) return;
      pending.delete(e.data.id);
      job.res(e.data.move === undefined ? fallback(job) : e.data.move);
    };
    worker.onerror = failAll;
  } catch { worker = null; }
  return worker;
}

export function chooseMoveAsync(state, rules = 'gebeta', level = 'medium') {
  const w = getWorker();
  const job = { state, rules, level };
  if (!w) return Promise.resolve(fallback(job));
  return new Promise((res) => { const id = ++seq; job.res = res; pending.set(id, job); w.postMessage({ id, state, rules, level }); });
}
