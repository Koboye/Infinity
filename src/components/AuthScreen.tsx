'use client';

import { useState } from 'react';
import { Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2 } from 'lucide-react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '@/lib/firebase/auth';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/Button';
import { cn, isValidUsername } from '@/lib/utils/cn';

type Mode = 'login' | 'signup';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const showToast = useUIStore(s => s.showToast);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signup' && !isValidUsername(username)) {
      showToast('Username must be 3–20 chars (letters, digits, underscores).', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail({ email, password, username: username.toLowerCase() });
        showToast('Welcome to Dagu! 🎉', 'success');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      showToast(message.replace('Firebase: ', ''), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google sign-in failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg-base p-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,45,85,0.18),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(157,78,221,0.18),transparent_60%)]" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand text-3xl font-black shadow-2xl shadow-accent/30">
            D
          </div>
          <h1 className="text-3xl font-black">
            <span className="gradient-brand-text">Dagu</span>
          </h1>
          <p className="mt-1 text-sm text-white/50">
            The smart-generation social video experience
          </p>
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === 'signup' && (
            <Field
              icon={<UserIcon className="h-4 w-4" />}
              placeholder="Username"
              value={username}
              onChange={setUsername}
            />
          )}
          <Field
            icon={<Mail className="h-4 w-4" />}
            placeholder="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <Field
            icon={<Lock className="h-4 w-4" />}
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            rightAction={
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="text-white/50 hover:text-white/80"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          <Button type="submit" fullWidth loading={busy} className="mt-2">
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-white/30">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <Button type="button" variant="secondary" fullWidth onClick={handleGoogle} disabled={busy}>
          <span className="mr-1 text-base">🌐</span>
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-white/50">
          {mode === 'login' ? "Don't have an account?" : 'Already have one?'}{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="font-semibold text-accent"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <p className="mt-8 text-center text-xs text-white/30">
          By continuing, you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}

interface FieldProps {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  rightAction?: React.ReactNode;
}

function Field({ icon, placeholder, value, onChange, type = 'text', autoComplete, rightAction }: FieldProps) {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition-colors focus-within:border-accent/40">
      <span className="text-white/50">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn('flex-1 bg-transparent text-sm outline-none placeholder:text-white/30')}
      />
      {rightAction}
    </label>
  );
}
