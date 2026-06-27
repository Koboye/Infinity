'use client';
import { useState } from 'react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, sendResetEmail } from '@/lib/firebase/auth';
import { useUIStore } from '@/stores/uiStore';
import { isValidUsername } from '@/lib/utils/cn';

type Mode = 'login' | 'signup';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const showToast = useUIStore(s => s.showToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signup' && !isValidUsername(username)) { showToast('Username: 3–20 chars, letters/digits/underscores only', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') { await signUpWithEmail({ email, password, username: username.toLowerCase() }); showToast('Account created! Check your email to verify before signing in. 📧', 'success'); setMode('login'); }
      else {
  await signInWithEmail(email, password);
}
    } catch (err) { showToast(err instanceof Error ? err.message.replace('Firebase: ','') : 'Auth failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try { await signInWithGoogle(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Google sign-in failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { showToast('Enter your email above first', 'info'); return; }
    setBusy(true);
    try { await sendResetEmail(email.trim()); showToast('Password reset email sent 📧', 'success'); }
    catch (err) { showToast(err instanceof Error ? err.message.replace('Firebase: ', '') : 'Could not send reset email', 'error'); }
    finally { setBusy(false); }
  };

  const inp = (val: string, set: (v:string)=>void, placeholder: string, type='text') => (
    <input value={val} onChange={e=>set(e.target.value)} placeholder={placeholder} type={type}
      style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'14px 16px', color:'white', fontSize:15, boxSizing:'border-box', outline:'none' }} />
  );

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0B0B0F', padding:24, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'radial-gradient(ellipse at top, rgba(255,45,85,0.18), transparent 60%), radial-gradient(ellipse at bottom, rgba(157,78,221,0.18), transparent 60%)' }} />
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:360 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div className="gradient-brand" style={{ width:64, height:64, borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:900, color:'white', margin:'0 auto 12px', boxShadow:'0 8px 32px rgba(255,33,86,0.35)' }}>D</div>
          <h1 className="gradient-brand-text" style={{ fontSize:32, fontWeight:900, margin:0 }}>Dagu</h1>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, marginTop:4 }}>Smart social video experience</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {mode === 'signup' && inp(username, setUsername, 'Username')}
          {inp(email, setEmail, 'Email', 'email')}
          {inp(password, setPassword, 'Password', 'password')}
          <button type="submit" disabled={busy} className="gradient-brand" style={{ border:'none', color:'white', borderRadius:16, padding:'14px', fontSize:15, fontWeight:700, cursor:busy?'not-allowed':'pointer', opacity:busy?0.6:1, marginTop:4 }}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {mode === 'login' && (
          <button type="button" onClick={handleForgotPassword} disabled={busy} style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer' }}>
            Forgot password?
          </button>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'16px 0', color:'rgba(255,255,255,0.3)', fontSize:13 }}>
          <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }} />or<span style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }} />
        </div>

        <button onClick={handleGoogle} disabled={busy} style={{ width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'white', borderRadius:16, padding:'14px', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          🌐 Continue with Google
        </button>

        <p style={{ textAlign:'center', marginTop:24, fontSize:14, color:'rgba(255,255,255,0.5)' }}>
          {mode==='login' ? "Don't have an account? " : 'Already have one? '}
          <button type="button" onClick={()=>setMode(mode==='login'?'signup':'login')} style={{ background:'none', border:'none', color:'#FF2156', fontWeight:700, cursor:'pointer', fontSize:14 }}>
            {mode==='login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
