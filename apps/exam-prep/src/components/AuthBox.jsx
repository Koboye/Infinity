'use client';
import { useState } from 'react';
import { authConfigured, signInGoogle, signInEmail, signUpEmail } from '@/lib/firebase.js';

const nice = (e) => ({ 'auth/invalid-credential': 'Wrong email or password', 'auth/email-already-in-use': 'That email already has an account, sign in instead', 'auth/weak-password': 'Use a password of at least 6 characters', 'auth/popup-closed-by-user': 'Sign-in was cancelled' }[e?.code] || 'Could not sign in. Try again.');

export default function AuthBox({ why = 'Sign in to continue' }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [mode, setMode] = useState('in'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (!authConfigured) return <div className="card"><b>Sign-in is not set up yet.</b><p className="hint">The owner needs to add the Firebase keys (see README).</p></div>;
  const run = async (fn) => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(nice(e)); } setBusy(false); };
  return (
    <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h2>{why}</h2>
      <button className="btn wide" style={{ width: '100%' }} disabled={busy} onClick={() => run(signInGoogle)}>Continue with Google</button>
      <p className="center hint">or with email</p>
      <label htmlFor="em">Email</label><input id="em" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p className="err">{err}</p>}
      <div className="row mt">
        <button className="btn" disabled={busy || !email || pw.length < 6} onClick={() => run(() => (mode === 'in' ? signInEmail(email, pw) : signUpEmail(email, pw)))}>{mode === 'in' ? 'Sign in' : 'Create account'}</button>
        <button className="btn alt" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'New here? Sign up' : 'Have an account?'}</button>
      </div>
    </div>
  );
}
