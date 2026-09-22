/**
 * Company sync (v2) — client side.
 * The app stays fully local-first: this only pushes a copy of the
 * existing exportData() snapshot to the company's backend when a
 * shop code is connected, so nothing about the offline experience
 * changes for a shop that never enters a code. Push failures never
 * touch local data — they only update syncStatus for the UI.
 */
import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

const PUSH_INTERVAL_MS = 60_000; // periodic background push while the app is open

export async function connectAndPush(token) {
  const { exportData, setCompanyToken, setSyncStatus } = useStore.getState();
  setCompanyToken(token);
  setSyncStatus('syncing');
  try {
    const snapshot = JSON.parse(exportData());
    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, snapshot }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      useStore.getState().setSyncStatus('error', friendlyError(body.error));
      return { ok: false, error: body.error };
    }
    useStore.getState().setSyncStatus('synced');
    return { ok: true };
  } catch {
    useStore.getState().setSyncStatus('error', 'No connection. Will retry automatically.');
    return { ok: false, error: 'network' };
  }
}

export async function pushNow() {
  const { companyToken, exportData, setSyncStatus } = useStore.getState();
  if (!companyToken) return { ok: false, error: 'not_connected' };
  setSyncStatus('syncing');
  try {
    const snapshot = JSON.parse(exportData());
    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: companyToken, snapshot }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      setSyncStatus('error', friendlyError(body.error));
      return { ok: false, error: body.error };
    }
    setSyncStatus('synced');
    return { ok: true };
  } catch {
    setSyncStatus('error', 'No connection. Will retry automatically.');
    return { ok: false, error: 'network' };
  }
}

// Used on a fresh install / new phone: enter the shop code to pull the
// last snapshot down instead of starting from an empty shop.
export async function restoreFromCode(token) {
  try {
    const res = await fetch('/api/sync/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) return { ok: false, error: body.error };
    const imported = useStore.getState().importData(JSON.stringify(body.snapshot));
    if (!imported) return { ok: false, error: 'corrupt_backup' };
    useStore.getState().setCompanyToken(token);
    useStore.getState().setSyncStatus('synced');
    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
}

function friendlyError(code) {
  switch (code) {
    case 'invalid_token': return 'That code isn\u2019t recognized. Check it with your company.';
    case 'shop_deactivated': return 'This shop has been suspended by your company.';
    case 'subscription_inactive': return 'Your company\u2019s subscription is inactive. Your data is safe on this phone.';
    default: return 'Could not sync right now. Your data is safe on this phone.';
  }
}

// Mounted once near the app root: pushes on a timer and whenever the
// device comes back online, only while a company code is connected.
export function useBackgroundSync() {
  const companyToken = useStore((s) => s.companyToken);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!companyToken) return;
    pushNow();
    timerRef.current = setInterval(pushNow, PUSH_INTERVAL_MS);
    const onOnline = () => pushNow();
    window.addEventListener('online', onOnline);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('online', onOnline);
    };
  }, [companyToken]);
}
