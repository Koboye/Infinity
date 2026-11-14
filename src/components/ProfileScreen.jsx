'use client';
import {StatStrip} from './HomeScreen';

const Svg = ({children}) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
const MAIL = <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7.500 8 6 8-6" /></>;
const CAP = <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11.500V16c0 1.500 3 3 6 3s6-1.500 6-3v-4.500" /></>;
const LOCK = <><rect x="5" y="11" width="14" height="10" rx="3" /><path d="M8 11V8a4 4 0 018 0v3" /></>;
const OUT = <><path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" /><path d="M16 8l4 4-4 4M20 12H9" /></>;

export default function ProfileScreen({user, gradeName, deptName, stats, notice, error, onReset, onSignOut}) {
  const name = user.displayName || (user.email || '').split('@')[0] || 'Learner';
  const level = gradeName + (deptName ? ', ' + deptName : '');
  return (
    <div className="inf-h inf-p">
      <header className="inf-h-hello">
        <h1>My profile</h1>
        <p>Your learning journey at Infinity.</p>
      </header>

      <section className="inf-p-card" aria-label="Account">
        <span className="inf-p-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
        <div className="inf-p-id">
          <h2>{name}</h2>
          {user.email && <p><Svg>{MAIL}</Svg><span>{user.email}</span></p>}
          <p><Svg>{CAP}</Svg><span>{level}</span></p>
        </div>
        <svg className="inf-h-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 24c-3.500-4.500-6.500-7-10-7a7 7 0 000 14c3.500 0 6.500-2.500 10-7s6.500-7 10-7a7 7 0 010 14c-3.500 0-6.500-2.500-10-7z" fill="none" stroke="currentColor" strokeWidth="3.600" strokeLinecap="round" /></svg>
      </section>

      <StatStrip stats={stats} />

      <ul className="inf-p-list">
        <li>
          <span className="inf-p-ico"><Svg>{CAP}</Svg></span>
          <span className="inf-p-txt"><b>My level</b><small>Set when you signed up. You only see material for this level.</small></span>
          <span className="inf-p-val">{gradeName}</span>
        </li>
        <li>
          <span className="inf-p-ico"><Svg>{LOCK}</Svg></span>
          <span className="inf-p-txt"><b>Password</b><small>We email you a link to set a new one.</small></span>
          <button type="button" className="inf-p-act" onClick={() => onReset(user.email || '')}>Send reset link</button>
        </li>
      </ul>
      <div aria-live="polite">
        {error && <p role="alert" className="inf-error">{error}</p>}
        {notice && !error && <p className="inf-notice">{notice}</p>}
      </div>

      <button type="button" className="inf-p-out" onClick={onSignOut}><Svg>{OUT}</Svg>Sign out</button>
    </div>
  );
}
