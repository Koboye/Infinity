'use client';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { useState } from 'react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, sendResetEmail } from '@/lib/firebase/auth';
import { useUIStore } from '@/stores/uiStore';
import { isValidUsername } from '@/lib/utils/cn';

type Mode = 'login' | 'signup';

const ACCENT = '#3D6B4F';

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
      else { await signInWithEmail(email, password); }
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

  const handleResendVerification = async () => {
    if (!email.trim() || !password.trim()) { showToast('Enter your email and password first', 'info'); return; }
    setBusy(true);
    try {
      const { user } = await signInWithEmailAndPassword(firebaseAuth(), email, password);
      if (user.emailVerified) { showToast('Email already verified — sign in now ✅', 'success'); return; }
      await sendEmailVerification(user);
      showToast('Verification email sent 📧', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message.replace('Firebase: ', '') : 'Could not resend', 'error');
    } finally { setBusy(false); }
  };

  const inp = (val: string, set: (v:string)=>void, placeholder: string, type='text') => (
    <input value={val} onChange={e=>set(e.target.value)} placeholder={placeholder} type={type}
      style={{ width:'100%', background:'#F8F7F4', border:'1.5px solid rgba(0,0,0,0.1)', borderRadius:14, padding:'14px 16px', color:'#1A1A1A', fontSize:15, boxSizing:'border-box', outline:'none', fontFamily:'inherit' }} />
  );

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#F8F7F4', padding:24, position:'relative', overflow:'hidden' }}>
      {/* Subtle nature-themed background */}
      <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'radial-gradient(ellipse at top left, rgba(61,107,79,0.12), transparent 60%), radial-gradient(ellipse at bottom right, rgba(90,154,111,0.1), transparent 60%)' }} />

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:360 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ width:72, height:72, borderRadius:20, background: '#3D6B4F', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 8px 32px rgba(61,107,79,0.3)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2S13 2 17 8z"/>
            </svg>
          </div>
          <h1 style={{ fontSize:28, fontWeight:900, margin:'0 0 4px', color:'#1A1A1A' }}>infinity</h1>
          <p style={{ color:'#5A9A6F', fontSize:14, margin:0, fontWeight:600 }}>/ የተደዳኢ ማህበረሰብ</p>
          <p style={{ color:'#9CA3AF', fontSize:13, marginTop:6 }}>Ethiopia's social platform</p>
        </div>

        <div style={{ background:'#FFFFFF', borderRadius:20, padding:24, boxShadow:'0 4px 24px rgba(0,0,0,0.08)', border:'1px solid rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize:18, fontWeight:700, margin:'0 0 20px', color:'#1A1A1A' }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </h2>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {mode === 'signup' && inp(username, setUsername, 'Username')}
            {inp(email, setEmail, 'Email address', 'email')}
            {inp(password, setPassword, 'Password', 'password')}
            <button type="submit" disabled={busy} style={{ background: ACCENT, border:'none', color:'#fff', borderRadius:14, padding:'14px', fontSize:15, fontWeight:700, cursor:busy?'not-allowed':'pointer', opacity:busy?0.7:1, marginTop:4, fontFamily:'inherit' }}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {mode === 'login' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, marginTop:12 }}>
              <button type="button" onClick={handleForgotPassword} disabled={busy} style={{ background:'none', border:'none', color:'#9CA3AF', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Forgot password?
              </button>
              <button type="button" onClick={handleResendVerification} disabled={busy} style={{ background:'none', border:'none', color:'#C0C0C0', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                Resend verification email
              </button>
            </div>
          )}

          <div style={{ display:'flex', alignItems:'center', gap:12, margin:'16px 0', color:'#9CA3AF', fontSize:13 }}>
            <span style={{ flex:1, height:1, background:'rgba(0,0,0,0.08)' }} />or<span style={{ flex:1, height:1, background:'rgba(0,0,0,0.08)' }} />
          </div>

          <button onClick={handleGoogle} disabled={busy} style={{ width:'100%', background:'#F8F7F4', border:'1.5px solid rgba(0,0,0,0.1)', color:'#1A1A1A', borderRadius:14, padding:'14px', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:'inherit' }}>
            🌐 Continue with Google
          </button>
        </div>

        <p style={{ textAlign:'center', marginTop:20, fontSize:14, color:'#9CA3AF' }}>
          {mode==='login' ? "Don't have an account? " : 'Already have one? '}
          <button type="button" onClick={()=>setMode(mode==='login'?'signup':'login')} style={{ background:'none', border:'none', color: ACCENT, fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>
            {mode==='login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
