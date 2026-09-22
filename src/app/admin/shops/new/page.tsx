'use client';
import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/supabase/useSession';

export default function NewShopPage() {
  const [name, setName] = useState('');
  const [town, setTown] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Enter a shop name.'); return; }
    setBusy(true);
    const res = await apiFetch('/api/shops/provision', {
      method: 'POST',
      body: JSON.stringify({ name, town, phone }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(
        res.body?.error === 'shop_limit_reached'
          ? `Your plan allows ${res.body.limit} shops. Upgrade in Billing to add more.`
          : res.body?.error || 'Could not create shop.'
      );
      return;
    }
    setResult({ token: res.body.token, name: res.body.shop.name });
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard?.writeText(result.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (result) {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold mb-4">Shop created</h1>
        <div className="bg-bg-elev1 border border-border rounded-xl p-6">
          <div className="text-sm text-text-secondary mb-1">Shop code for {result.name}</div>
          <div className="font-mono text-2xl tracking-wide mb-3">{result.token}</div>
          <div className="text-sm text-danger mb-4">
            Shown once. It won't be shown again — write it down or copy it now.
          </div>
          <button onClick={copy} className="bg-accent text-white text-sm rounded-md px-4 py-2 font-medium mr-2">
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <Link href="/admin" className="text-sm text-text-secondary underline">
            Done
          </Link>
          <div className="text-xs text-text-secondary mt-5">
            Give this code to the shopkeeper. On their phone: Settings → Company Sync → Enter code.
            It links their existing local data (or a fresh install) to your dashboard — nothing on
            their phone is deleted or changed otherwise.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-4">Add a shop</h1>
      <form onSubmit={submit} className="bg-bg-elev1 border border-border rounded-xl p-6">
        <label className="block mb-3">
          <span className="text-xs text-text-secondary">Shop name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm" placeholder="e.g. Abebe Shop" />
        </label>
        <label className="block mb-3">
          <span className="text-xs text-text-secondary">Town (optional)</span>
          <input value={town} onChange={(e) => setTown(e.target.value)}
            className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm" />
        </label>
        <label className="block mb-4">
          <span className="text-xs text-text-secondary">Phone (optional)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm" />
        </label>
        {error && <div className="text-sm text-danger mb-3">{error}</div>}
        <button disabled={busy} type="submit"
          className="bg-accent text-white text-sm rounded-md px-4 py-2 font-medium disabled:opacity-60">
          {busy ? 'Creating…' : 'Create shop & get code'}
        </button>
      </form>
    </div>
  );
}
