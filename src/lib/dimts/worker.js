// Talks to the GPU worker (worker/server.py). Server-only: the secret never reaches the browser.
const BASE = () => (process.env.DIMTS_WORKER_URL || '').replace(/\/$/, '');

export function workerConfigured() { return !!BASE() && !!process.env.DIMTS_WORKER_SECRET; }

export async function callWorker(path, { method = 'POST', json, form, timeoutMs = 120000, raw = false } = {}) {
  if (!workerConfigured()) {
    const e = new Error('Dimts is not connected to its GPU worker yet. Set DIMTS_WORKER_URL and DIMTS_WORKER_SECRET.');
    e.status = 503; throw e;
  }
  const headers = { 'x-worker-secret': process.env.DIMTS_WORKER_SECRET };
  let body;
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(`${BASE()}${path}`, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || data.detail || `Worker error (${res.status})`); e.status = res.status === 429 ? 429 : 502; throw e; }
  return data;
}

// The browser must play worker media (HLS / mp4). We hand out worker URLs only for the caller's own job.
export const publicMediaUrl = (p) => (p ? `${BASE()}${p}` : '');
