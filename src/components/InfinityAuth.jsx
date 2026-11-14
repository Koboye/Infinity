'use client';
import {useId, useRef, useState} from 'react';

export const GRADES = [
  {id: 'kg1', name: 'KG 1'},
  {id: 'kg2', name: 'KG 2'},
  {id: 'kg3', name: 'KG 3'},
  ...Array.from({length: 12}, (_, i) => ({id: 'g' + (i + 1), name: 'Grade ' + (i + 1)})),
  {id: 'uni', name: 'University / College'},
  {id: 'ngat', name: 'NGAT'},
];
const label = (g) => g.id.startsWith('g') && g.id !== 'gk' && /^g\d+$/.test(g.id) ? g.id.slice(1) : g.name.replace('University / College', 'University').replace(/^KG /, '');
const kind = (g) => /^kg/.test(g.id) ? 'KG' : /^g\d+$/.test(g.id) ? 'Grade' : g.id === 'uni' ? 'College /' : 'Exam';

/* The Infinity mark: a lemniscate on a sun-yellow tile. */
export function Mark({size = 40}) {
  return (
    <svg className="inf-mark" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Infinity">
      <rect width="48" height="48" rx="14" fill="var(--inf-sun)" />
      <path
        d="M24 24c-3.500-4.500-6.500-7-10-7a7 7 0 000 14c3.500 0 6.500-2.500 10-7s6.500-7 10-7a7 7 0 010 14c-3.500 0-6.500-2.500-10-7z"
        fill="none" stroke="var(--inf-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS = {
  home: 'M4 11.500 12 5l8 6.500V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z',
  subjects: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11',
  games: 'M7 8h10a4 4 0 014 4v1a3 3 0 01-5.500 1.600L14.500 14h-5l-1 .600A3 3 0 013 13v-1a4 4 0 014-4zM8 11v3M6.500 12.500h3M16 11.500h.01M18 13h.01',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.500 20a7.500 7.500 0 0115 0',
};
export function NavIcon({id}) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[id]} />
    </svg>
  );
}

/* Swipeable level picker. Arrows and keyboard scrolling stay available. */
export function GradePicker({grade, onChange}) {
  const track = useRef(null);
  const scroll = (dir) => track.current?.scrollBy({left: dir * 240, behavior: 'smooth'});
  return (
    <div className="inf-grade" role="group" aria-label="Learning level">
      <button type="button" className="inf-grade-arrow" aria-label="Previous levels" onClick={() => scroll(-1)}>‹</button>
      <div className="inf-grade-track" ref={track}>
        {GRADES.map((g) => (
          <button
            type="button" key={g.id} aria-pressed={grade === g.id}
            onClick={(e) => { onChange(g.id); e.currentTarget.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'}); }}
          >
            <small>{kind(g)}</small><b>{label(g)}</b>
          </button>
        ))}
      </div>
      <button type="button" className="inf-grade-arrow" aria-label="Next levels" onClick={() => scroll(1)}>›</button>
    </div>
  );
}

function Field({label, children}) {
  return <label className="inf-field"><span>{label}</span>{children}</label>;
}

export default function AuthScreen({busy, error, notice, departments, onSubmit, onReset, onClearError}) {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [step, setStep] = useState(1);        // signup only: 1 account, 2 level
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [grade, setGrade] = useState('');
  const [dept, setDept] = useState('');
  const [localError, setLocalError] = useState('');
  const errId = useId();

  const signup = mode === 'signup';
  const shownError = localError || error;
  const switchMode = () => { setMode(signup ? 'signin' : 'signup'); setStep(1); setLocalError(''); onClearError(); };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setLocalError('');
    const cleanEmail = email.trim();
    if (signup && step === 1) {
      if (!name.trim()) return setLocalError('Enter your name.');
      if (password.length < 6) return setLocalError('Use at least 6 characters for your password.');
      return setStep(2);
    }
    if (signup && !grade) return setLocalError('Slide and choose your level to continue.');
    if (signup && grade === 'uni' && !dept) return setLocalError('Choose your department.');
    await onSubmit({mode, name: name.trim(), email: cleanEmail, password, grade: signup ? grade : '', dept: signup ? dept : ''});
  };

  const levelBlock = (
    <div className="inf-level">
      <p className="inf-level-label" id="inf-level-label">Your level <span>Slide to choose</span></p>
      <GradePicker grade={grade} onChange={(g) => { setGrade(g); if (g !== 'uni') setDept(''); setLocalError(''); }} />
      {grade === 'uni' && (
        <Field label="Department">
          <select required value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Choose department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      )}
    </div>
  );

  const title = !signup ? 'Welcome back' : step === 1 ? 'Create your account' : 'Choose your level';
  const sub = !signup ? 'Sign in to continue. Your level is saved on your account.' : step === 1 ? 'Free to start. Takes under a minute.' : 'Saved on your account. You will only see material for this level.';
  const cta = !signup ? 'Sign in' : step === 1 ? 'Continue' : 'Create account';

  return (
    <main className="inf-app inf-auth">
      <section className="inf-auth-brand" aria-hidden="false">
        <div className="inf-lockup"><Mark size={48} /><span>Infinity</span></div>
        <h1>Prepare for every exam, from Kindergarten to university.</h1>
        <p>Practice questions, timed exams and a game break when you need one.</p>
        <ul className="inf-ladder" aria-label="Levels covered">
          <li>Kindergarten</li><li>Grades 1–12</li><li>University</li><li>NGAT</li>
        </ul>
      </section>

      <section className="inf-auth-panel">
        <form onSubmit={submit} noValidate={false} aria-labelledby="inf-auth-title">
          <header>
            {signup && <p className="inf-step">Step {step} of 2</p>}
            <h2 id="inf-auth-title">{title}</h2>
            <p>{sub}</p>
          </header>

          {(!signup || step === 1) && (
            <>
              {signup && (
                <Field label="Full name">
                  <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              )}
              <Field label="Email">
                <input type="email" required inputMode="email" autoComplete={signup ? 'email' : 'username'} autoCapitalize="none" spellCheck={false}
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password">
                <span className="inf-pass">
                  <input type={show ? 'text' : 'password'} required minLength={6} autoComplete={signup ? 'new-password' : 'current-password'}
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="inf-ghost" aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
                </span>
              </Field>
              {!signup && (
                <button type="button" className="inf-link inf-forgot" onClick={() => onReset(email.trim())}>Forgot password?</button>
              )}
            </>
          )}

          {signup && step === 2 && levelBlock}

          <div id={errId} aria-live="polite">
            {shownError && <p role="alert" className="inf-error">{shownError}</p>}
            {notice && !shownError && <p className="inf-notice">{notice}</p>}
          </div>

          <button className="inf-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : cta}</button>
          {signup && step === 2 && (
            <button type="button" className="inf-link" onClick={() => { setStep(1); setLocalError(''); }}>Back</button>
          )}
          <p className="inf-switch">
            {signup ? 'Already have an account?' : 'New to Infinity?'}{' '}
            <button type="button" className="inf-link" onClick={switchMode}>{signup ? 'Sign in' : 'Create an account'}</button>
          </p>
        </form>
      </section>
    </main>
  );
}
