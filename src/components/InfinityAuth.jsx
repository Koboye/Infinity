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
const isG = (g) => /^g\d+$/.test(g.id);
const groupOf = (g) => /^kg/.test(g.id) ? 'KG' : isG(g) ? (Number(g.id.slice(1)) <= 6 ? 'Primary' : Number(g.id.slice(1)) <= 9 ? 'Preparatory' : 'Secondary') : g.id === 'uni' ? 'University' : 'NGAT';
const tileLabel = (g) => isG(g) ? 'G' + g.id.slice(1) : g.id.toUpperCase();
const TILE_SUB = {kg1: 'Pre-K', kg2: 'Kindergarten', kg3: 'Advanced KG'};

/* The Infinity mark: a lemniscate on a sun-yellow tile. */
export function Mark({size = 40, live = false}) {
  return (
    <svg className={'inf-mark' + (live ? ' is-live' : '')} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Infinity">
      <defs>
        <linearGradient id="inf-mark-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFDB6B" /><stop offset="1" stopColor="#FFB800" /></linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#inf-mark-g)" />
      <path
        pathLength="100"
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

/* Level picker: School / University / NGAT tabs. School is one swipeable rail of grouped panels.
   Tap a tile, it centres, pops and buzzes. Works on the auth screen and in the app. */
const STAGES = [
  {key: 'KG', title: 'Kindergarten', sub: 'Early learning & discovery', icon: '🌱', tone: 'kg'},
  {key: 'Primary', title: 'Primary', sub: 'Grades 1–6 · Build core skills', icon: '📖', tone: 'pri'},
  {key: 'Preparatory', title: 'Preparatory', sub: 'Grades 7–9 · Go deeper & prepare', icon: '📚', tone: 'prep'},
  {key: 'Secondary', title: 'Secondary', sub: 'Grades 10–12 · Specialize & excel', icon: '🎓', tone: 'sec'},
];
const TABS = [
  {id: 'school', label: 'School'},
  {id: 'uni', label: 'University'},
  {id: 'ngat', label: 'NGAT'},
];
const SOLO = {
  uni: {title: 'University', sub: 'College · you pick your department next'},
  ngat: {title: 'NGAT', sub: 'National exam preparation'},
};
const SCHOOL = GRADES.filter((g) => /^(kg|g\d)/.test(g.id));

export function GradePicker({grade, onChange}) {
  const track = useRef(null);
  const [tabState, setTab] = useState(grade === 'uni' || grade === 'ngat' ? grade : 'school');
  const tab = grade === 'uni' || grade === 'ngat' ? grade : tabState;
  const find = (id) => track.current?.querySelector('[data-id="' + id + '"]');
  const reveal = (id) => find(id)?.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'});
  const buzz = () => { try { navigator.vibrate?.(12); } catch {} };
  const pick = (id) => { onChange(id); reveal(id); buzz(); };
  const scroll = (dir) => track.current?.scrollBy({left: dir * 260, behavior: 'smooth'});
  const goTab = (t) => {
    setTab(t);
    if (t === 'school') { if (grade === 'uni' || grade === 'ngat') onChange(''); }
    else { onChange(t); buzz(); }
  };
  const step = (e) => {
    const i = SCHOOL.findIndex((g) => g.id === grade);
    const next = e.key === 'ArrowRight' ? Math.min(SCHOOL.length - 1, i + 1) : e.key === 'ArrowLeft' ? Math.max(0, i - 1) : -1;
    if (next < 0) return;
    e.preventDefault();
    pick(SCHOOL[next].id);
    find(SCHOOL[next].id)?.focus();
  };
  const solo = SOLO[tab];
  return (
    <div className="inf-picker">
      <div className="inf-tabs" role="tablist" aria-label="Education stage">
        {TABS.map((t) => (
          <button type="button" role="tab" key={t.id} aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => goTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'school' ? (
        <>
          <div className="inf-grade" role="radiogroup" aria-label="Grade">
            <button type="button" className="inf-grade-arrow" aria-label="Previous grades" onClick={() => scroll(-1)}>‹</button>
            <div className="inf-rail" ref={track} onKeyDown={step}>
              {STAGES.map((st) => (
                <div className="inf-pane" data-tone={st.tone} key={st.key}>
                  <div className="inf-pane-head">
                    <span><b>{st.title}</b><small>{st.sub}</small></span>
                  </div>
                  <div className="inf-tl-row">
                    {SCHOOL.filter((g) => groupOf(g) === st.key).map((g) => (
                      <button
                        type="button" role="radio" key={g.id} data-id={g.id} aria-checked={grade === g.id} aria-pressed={grade === g.id}
                        className="inf-tl" aria-label={g.name}
                        tabIndex={grade === g.id || (!grade && g.id === 'kg1') ? 0 : -1}
                        onClick={() => pick(g.id)}
                      >
                        <b>{tileLabel(g)}</b>
                        {TILE_SUB[g.id] && <small>{TILE_SUB[g.id]}</small>}
                        {grade === g.id && <em className="inf-chk" aria-hidden="true">✓</em>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="inf-grade-arrow" aria-label="Next grades" onClick={() => scroll(1)}>›</button>
          </div>
          <p className="inf-swipe" aria-hidden="true">Swipe to see more</p>
        </>
      ) : (
        <div className="inf-solo" role="radiogroup" aria-label={solo.title}>
          <button type="button" role="radio" data-id={tab} aria-checked="true" aria-pressed="true" className="inf-tl inf-tl-wide">
            <b>{solo.title}</b><small>{solo.sub}</small>
            <em className="inf-chk" aria-hidden="true">✓</em>
          </button>
        </div>
      )}
    </div>
  );
}

/* Department picker: search, then slide sideways through two rows of cards. */
export function DepartmentPicker({departments, value, onChange}) {
  const [q, setQ] = useState('');
  const list = departments.filter((d) => d.id === value || d.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (d, e) => { onChange(d.id); e.currentTarget.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'}); try { navigator.vibrate?.(12); } catch {} };
  return (
    <div className="inf-dept">
      <input type="search" className="inf-dept-search" aria-label="Search departments" autoComplete="off" placeholder="Search your department" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="inf-dept-track" role="radiogroup" aria-label="Department">
        {list.map((d) => (
          <button type="button" role="radio" key={d.id} aria-checked={value === d.id} aria-pressed={value === d.id} onClick={(e) => pick(d, e)}>
            <span aria-hidden="true">{d.name.trim().charAt(0).toUpperCase()}</span>{d.name}
          </button>
        ))}
      </div>
      {!list.length && <p className="inf-hint">No department matches “{q}”.</p>}
      <p className="inf-hint inf-dept-count">{list.length ? 'Slide for more · ' + list.length + ' departments' : ''}</p>
    </div>
  );
}

/* ---------- icons ---------- */
const ICO = {
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M4 4l16 16" /></>,
  tick: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};
function Ico({n, className = 'inf-ico'}) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICO[n]}</svg>;
}

function Field({label, end, children}) {
  return (
    <label className="inf-field">
      <span className="inf-lab">{label}</span>
      <span className="inf-ctl">{children}{end}</span>
    </label>
  );
}

export default function AuthScreen({busy, error, notice, departments, onSubmit, onReset, onClearError}) {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [step, setStep] = useState(1);        // signup only: 1 account, 2 level, 3 department (university only)
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
    if (signup && step === 2) {
      if (!grade) return setLocalError('Slide and choose your level to continue.');
      if (grade === 'uni') return setStep(3);
    }
    if (signup && step === 3 && !dept) return setLocalError('Choose your department.');
    await onSubmit({mode, name: name.trim(), email: cleanEmail, password, grade: signup ? grade : '', dept: signup ? dept : ''});
  };

  const levelBlock = (
    <div className="inf-level">
      <GradePicker grade={grade} onChange={(g) => { setGrade(g); if (g !== 'uni') setDept(''); setLocalError(''); }} />
    </div>
  );

  const total = signup && grade === 'uni' ? 3 : 2;
  const title = !signup ? 'Welcome back' : step === 1 ? 'Create your account' : step === 2 ? 'What do you study?' : 'Your department';
  const sub = !signup ? 'Sign in to continue. Your level is saved on your account.' : step === 1 ? 'Free to start. Takes under a minute.' : step === 2 ? 'Choose your educational stage and grade.' : 'Slide sideways and tap yours.';
  const chosen = GRADES.find((g) => g.id === grade);
  const levelName = chosen ? chosen.name.replace('University / College', 'University') : '';
  const deptName = departments.find((d) => d.id === dept)?.name || '';
  const ready = signup && ((step === 2 && !!grade) || (step === 3 && !!dept));
  const cta = !signup ? 'Sign in'
    : step === 1 ? 'Continue'
    : step === 2 ? (!grade ? 'Pick your level' : grade === 'uni' ? 'Next: your department' : 'Start as ' + levelName)
    : dept ? 'Start as ' + levelName + ' · ' + (deptName.length > 20 ? deptName.slice(0, 19) + '…' : deptName) : 'Pick your department';
  const back = () => { setStep((v) => Math.max(1, v - 1)); setLocalError(''); };

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const stageNames = ['Kindergarten', 'Primary', 'Preparatory', 'Secondary', 'University', 'NGAT'];

  return (
    <main className="inf-app inf-auth">
      <aside className="inf-auth-brand">
        <div className="inf-lockup"><Mark size={40} /><span>Infinity</span></div>
        <div className="inf-brand-copy">
          <h1>Prepare for every exam, from Kindergarten to university.</h1>
          <p>Practice questions for your exact grade, timed exams and study streaks, all in one place.</p>
          <ul className="inf-ladder" aria-label="Levels covered">
            {stageNames.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      </aside>

      <section className="inf-auth-panel">
        <form onSubmit={submit} noValidate={false} aria-labelledby="inf-auth-title">
          {(!signup || step === 1) ? (
            <div className="inf-mode" role="group" aria-label="Account">
              <button type="button" aria-pressed={!signup} onClick={() => signup && switchMode()}>Sign in</button>
              <button type="button" aria-pressed={signup} onClick={() => !signup && switchMode()}>Create account</button>
            </div>
          ) : (
            <div className="inf-prog" role="img" aria-label={'Step ' + step + ' of ' + total}>
              <span>Step {step} of {total}</span>
              <div><i style={{width: (step / total * 100) + '%'}} /></div>
            </div>
          )}

          <header>
            <h2 id="inf-auth-title">{title}</h2>
            <p>{sub}</p>
          </header>

          {(!signup || step === 1) && (
            <div className="inf-slide" key={'s1' + mode}>
              {signup && (
                <Field label="Full name">
                  <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              )}
              <Field label="Email" end={signup && validEmail ? <span className="inf-ok" aria-hidden="true"><Ico n="tick" className="inf-ok-ico" /></span> : null}>
                <input type="email" required inputMode="email" autoComplete={signup ? 'email' : 'username'} autoCapitalize="none" spellCheck={false}
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password" end={
                <button type="button" className="inf-ghost inf-eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((v) => !v)}><Ico n={show ? 'eyeoff' : 'eye'} /></button>
              }>
                <input type={show ? 'text' : 'password'} required minLength={6} autoComplete={signup ? 'new-password' : 'current-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              {!signup && (
                <button type="button" className="inf-link inf-forgot" onClick={() => onReset(email.trim())}>Forgot password?</button>
              )}
              {signup && <p className="inf-fine">Use at least 6 characters.</p>}
            </div>
          )}

          {signup && step === 2 && <div className="inf-slide" key="s2">{levelBlock}</div>}
          {signup && step === 3 && <div className="inf-slide" key="s3"><DepartmentPicker departments={departments} value={dept} onChange={(id) => { setDept(id); setLocalError(''); }} /></div>}

          <div id={errId} aria-live="polite">
            {shownError && <p role="alert" className="inf-error">{shownError}</p>}
            {notice && !shownError && <p className="inf-notice">{notice}</p>}
          </div>

          <button className="inf-primary" type="submit" data-ready={ready || undefined} disabled={busy || (signup && step >= 2 && !ready)}>
            {busy ? 'Please wait…' : cta}
          </button>
          {signup && step >= 2 && (
            <button type="button" className="inf-link" onClick={back}>Back</button>
          )}
        </form>
      </section>
    </main>
  );
}
