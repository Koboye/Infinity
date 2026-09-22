'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { apiFetch } from '@/lib/supabase/useSession';

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      if (mode === 'signup') {
        if (!companyName.trim()) { setError('Enter your company name.'); setBusy(false); return; }
        const { error: signErr } = await sb.auth.signUp({ email, password });
        if (signErr) { setError(signErr.message); setBusy(false); return; }
        // If email confirmation is required, there's no session yet — tell them to confirm, then sign in.
        const { data: sessionData } = await sb.auth.getSession();
        if (!sessionData.session) {
          setError('Check your email to confirm your account, then sign in.');
          setMode('signin');
          setBusy(false);
          return;
        }
        const res = await apiFetch('/api/companies/signup', {
          method: 'POST',
          body: JSON.stringify({ companyName }),
        });
        if (!res.ok) { setError(res.body?.error || 'Could not create company.'); setBusy(false); return; }
        router.replace('/admin');
        return;
      }

      const { error: signErr } = await sb.auth.signInWithPassword({ email, password });
      if (signErr) { setError(signErr.message); setBusy(false); return; }
      router.replace('/admin');
    } catch {
      setError('Something went wrong. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-bg-elev1 border border-border rounded-xl p-6">
        <div className="text-lg font-semibold text-accent mb-1">ገበያ Link</div>
        <div className="text-sm text-text-secondary mb-6">Company console</div>

        <div className="flex gap-2 mb-5 text-sm">
          <button type="button" onClick={() => setMode('signin')}
            className={`flex-1 py-1.5 rounded-md border ${mode === 'signin' ? 'border-accent text-accent bg-accent-soft' : 'border-border text-text-secondary'}`}>
            Sign in
          </button>
          <button type="button" onClick={() => setMode('signup')}
            className={`flex-1 py-1.5 rounded-md border ${mode === 'signup' ? 'border-accent text-accent bg-accent-soft' : 'border-border text-text-secondary'}`}>
            Create company
          </button>
        </div>

        {mode === 'signup' && (
          <label className="block mb-3">
            <span className="text-xs text-text-secondary">Company name</span>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm" placeholder="e.g. Ledet Microfinance" />
          </label>
        )}
        <label className="block mb-3">
          <span className="text-xs text-text-secondary">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm" />
        </label>
        <label className="block mb-4">
          <span className="text-xs text-text-secondary">Password</span>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm" />
        </label>

        {error && <div className="text-sm text-danger mb-3">{error}</div>}

        <button disabled={busy} type="submit"
          className="w-full bg-accent text-white rounded-md py-2 text-sm font-medium disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create company account' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
