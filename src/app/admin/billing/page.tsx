'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/supabase/useSession';

export default function BillingPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch('/api/shops').then((res) => {
      // shops route doesn't return company status directly; keep this page
      // resilient even before a dedicated /api/companies/me route exists.
      if (res.ok) setStatus('loaded');
    });
  }, []);

  const upgrade = async () => {
    setBusy(true);
    setError('');
    const res = await apiFetch('/api/billing/create-checkout-session', { method: 'POST', body: JSON.stringify({}) });
    setBusy(false);
    if (!res.ok) {
      setError(
        res.body?.error === 'billing_not_configured'
          ? 'Billing isn\u2019t connected yet — add your Stripe keys to enable checkout.'
          : res.body?.error || 'Could not start checkout.'
      );
      return;
    }
    window.location.href = res.body.url;
  };

  const manage = async () => {
    setBusy(true);
    setError('');
    const res = await apiFetch('/api/billing/portal', { method: 'POST', body: JSON.stringify({}) });
    setBusy(false);
    if (!res.ok) {
      setError(
        res.body?.error === 'billing_not_configured'
          ? 'Billing isn\u2019t connected yet — add your Stripe keys first.'
          : res.body?.error === 'no_billing_account_yet'
          ? 'No billing account yet — subscribe first.'
          : res.body?.error || 'Could not open billing portal.'
      );
      return;
    }
    window.location.href = res.body.url;
  };

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-4">Billing</h1>
      <div className="bg-bg-elev1 border border-border rounded-xl p-6">
        <p className="text-sm text-text-secondary mb-5">
          New companies start on a 14-day trial with room for 5 shops. Upgrade to add more shops
          and keep sync running after the trial ends.
        </p>
        {error && <div className="text-sm text-danger mb-4">{error}</div>}
        <div className="flex gap-2">
          <button disabled={busy} onClick={upgrade} className="bg-accent text-white text-sm rounded-md px-4 py-2 font-medium disabled:opacity-60">
            Upgrade plan
          </button>
          <button disabled={busy} onClick={manage} className="border border-border text-sm rounded-md px-4 py-2 font-medium disabled:opacity-60">
            Manage billing
          </button>
        </div>
      </div>
    </div>
  );
}
