'use client';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { useState } from 'react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, sendResetEmail, signOutCurrent } from '@/lib/firebase/auth';
import { useUIStore } from '@/stores/uiStore';

type Mode = 'login' | 'signup';

const ACCENT = '#3D6B4F';
const ACCENT_LIGHT = '#5A9A6F';
const ACCENT_GLOW = 'rgba(61,107,79,0.15)';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [busy, setBusy] = useState(false);
  const showToast = useUIStore(s => s.showToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signup') {
      const ageNum = parseInt(age);
      if (!age || isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
        showToast('Please enter a valid age (13-120)', 'error');
        return;
      }
    }
    if (password.length < 6) { 
      showToast('Password must be at least 6 characters', 'error'); 
      return; 
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail({ email, password, username: '' });
        showToast('Account created! Check your email to verify. 📧', 'success');
        setMode('login');
        setPassword('');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message.replace('Firebase: ', '') : 'Auth failed', 'error');
    } finally {
      setBusy(false);
    }
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
      if (user.emailVerified) {
        showToast('Email already verified — sign in now ✅', 'success');
      } else {
        await sendEmailVerification(user);
        showToast('Verification email sent 📧', 'success');
      }
      await signOutCurrent(); // never leave an unverified (or stray) session active
    } catch (err) {
      showToast(err instanceof Error ? err.message.replace('Firebase: ', '') : 'Could not resend', 'error');
    } finally { setBusy(false); }
  };

  const Input = ({ 
    value, set, placeholder, type = 'text', icon, autoFocus 
  }: { 
    value: string; set: (v: string) => void; placeholder: string; type?: string; icon?: string; autoFocus?: boolean;
  }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'rgba(255,255,255,0.85)',
      border: '1.5px solid rgba(0,0,0,0.06)',
      borderRadius: 16,
      padding: '0 16px',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      {icon && <span style={{ fontSize: 18, opacity: 0.5 }}>{icon}</span>}
      <input
        value={value}
        onChange={e => set(e.target.value)}
        placeholder={placeholder}
        type={type}
        autoFocus={autoFocus}
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          outline: 'none',
          padding: '15px 0',
          color: '#1A1A1A',
          fontSize: 15,
          fontFamily: 'inherit',
          width: '100%',
        }}
      />
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      background: '#F8F7F4',
      overflow: 'hidden',
    }}>
      {/* Decorative background */}
      <div style={{
        position: 'absolute',
        top: -120,
        right: -80,
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${ACCENT_GLOW}, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -100,
        left: -60,
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${ACCENT_GLOW}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 380,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_LIGHT})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 12px 40px rgba(61,107,79,0.35)',
            position: 'relative',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2S13 2 17 8z"/>
            </svg>
          </div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 900,
            margin: 0,
            color: '#1A1A1A',
            letterSpacing: '-0.5px',
          }}>
            infinity
          </h1>
          <p style={{
            color: ACCENT_LIGHT,
            fontSize: 14,
            margin: '4px 0 0',
            fontWeight: 600,
          }}>
            / የትየለሌ
          </p>
          <p style={{
            color: '#9CA3AF',
            fontSize: 13,
            marginTop: 4,
          }}>
            Ethiopia's social platform
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          borderRadius: 28,
          padding: 32,
          boxShadow: '0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
          border: '1px solid rgba(255,255,255,0.8)',
        }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: 20,
              fontWeight: 800,
              margin: 0,
              color: '#1A1A1A',
              letterSpacing: '-0.3px',
            }}>
              {mode === 'login' ? 'Welcome back' : 'Join the community'}
            </h2>
            <p style={{
              fontSize: 14,
              color: '#9CA3AF',
              margin: '4px 0 0',
            }}>
              {mode === 'login' 
                ? 'Sign in to continue sharing your story' 
                : 'Create your account and start connecting'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              value={email}
              set={setEmail}
              placeholder="Email address"
              type="email"
              icon="✉️"
              autoFocus={mode === 'login'}
            />

            <Input
              value={password}
              set={setPassword}
              placeholder="Password"
              type="password"
              icon="🔒"
            />

            {mode === 'signup' && (
              <Input
                value={age}
                set={setAge}
                placeholder="Your age (13+)"
                type="number"
                icon="🎂"
              />
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                padding: '16px',
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_LIGHT})`,
                border: 'none',
                color: '#fff',
                borderRadius: 16,
                fontSize: 16,
                fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
                marginTop: 4,
                transition: 'transform 0.15s, box-shadow 0.15s',
                boxShadow: '0 4px 16px rgba(61,107,79,0.3)',
                fontFamily: 'inherit',
              }}
            >
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {mode === 'login' && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
              gap: 8,
            }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={busy}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={busy}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#C0C0C0',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              >
                Resend verification
              </button>
            </div>
          )}

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            margin: '20px 0 16px',
            color: '#D1D5DB',
            fontSize: 12,
          }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
            <span style={{ fontWeight: 500, color: '#9CA3AF' }}>or</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
          </div>

          <button
            onClick={handleGoogle}
            disabled={busy}
            style={{
              width: '100%',
              background: '#FFFFFF',
              border: '1.5px solid rgba(0,0,0,0.08)',
              color: '#1A1A1A',
              borderRadius: 16,
              padding: '14px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontFamily: 'inherit',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Toggle mode */}
        <p style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: 14,
          color: '#9CA3AF',
        }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setPassword('');
              setAge('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: ACCENT,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
