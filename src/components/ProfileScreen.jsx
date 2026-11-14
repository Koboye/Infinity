'use client';
import {useRef, useState} from 'react';
import {EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile} from 'firebase/auth';
import {StatStrip} from './HomeScreen';
import {uploadAvatar} from '@/lib/upload';
import {achievements, levelFor, subjectStats, weekActivity} from '@/lib/studyStreak';

const Svg = ({children, size = 22}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
const I = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7.5 8 6 8-6" /></>,
  cap: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="3" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  out: <><path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" /><path d="M16 8l4 4-4 4M20 12H9" /></>,
  pen: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  cam: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  trophy: <><path d="M8 4h8v6a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 14v4M8.5 20h7" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  reset: <><path d="M4 12a8 8 0 108-8H7" /><path d="M7 1v6H1" transform="translate(3 0)" /></>,
};
const friendly = (e) => ({
  'auth/wrong-password': 'Your current password is incorrect.', 'auth/invalid-credential': 'Your current password is incorrect.',
  'auth/weak-password': 'Use at least 6 characters for the new password.', 'auth/requires-recent-login': 'Sign out and sign in again, then retry.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.', 'auth/network-request-failed': 'No connection. Check your internet and try again.',
}[e?.code] || e?.message || 'Something went wrong. Please try again.');

export default function ProfileScreen({user, gradeName, deptName, stats, notice, error, onReset, onSignOut, onProfile, onClearProgress}) {
  const [name, setName] = useState(user.displayName || '');
  const [photo, setPhoto] = useState(user.photoURL || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pw, setPw] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({kind: '', text: ''});
  const file = useRef(null);
  const say = (kind, text) => setMsg({kind, text});

  const shown = name || (user.email || '').split('@')[0] || 'Learner';
  const level = gradeName + (deptName ? ', ' + deptName : '');
  const lv = levelFor(stats.xp);
  const week = weekActivity(stats), peak = Math.max(10, ...week.map((x) => x.count)), weekTotal = week.reduce((n, x) => n + x.count, 0);
  const subj = subjectStats(stats), ach = achievements(stats), won = ach.filter((x) => x.done).length;

  const saveName = async (e) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return say('err', 'Enter your name.');
    setBusy('name'); say('', '');
    try { await updateProfile(user, {displayName: v}); setName(v); setEditing(false); onProfile?.(); say('ok', 'Name updated.'); }
    catch (err) { say('err', friendly(err)); } finally { setBusy(''); }
  };
  const pickPhoto = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) return say('err', 'Choose a picture file.');
    setBusy('photo'); say('', '');
    try { const url = await uploadAvatar(user.uid, f); await updateProfile(user, {photoURL: url}); setPhoto(url + '#' + Date.now()); onProfile?.(); say('ok', 'Photo updated.'); }
    catch (err) { say('err', friendly(err)); } finally { setBusy(''); }
  };
  const savePw = async (e) => {
    e.preventDefault();
    if (next.length < 6) return say('err', 'Use at least 6 characters for the new password.');
    setBusy('pw'); say('', '');
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, cur));
      await updatePassword(user, next);
      setCur(''); setNext(''); setPw(false); say('ok', 'Password changed.');
    } catch (err) { say('err', friendly(err)); } finally { setBusy(''); }
  };
  const clear = () => {
    if (window.confirm('Reset your XP, streak, accuracy and subject results? This cannot be undone.')) { onClearProgress(); say('ok', 'Progress reset.'); }
  };

  return (
    <div className="inf-h inf-p">
      <header className="inf-h-hello">
        <h1>My profile</h1>
        <p>Your learning journey at Infinity.</p>
      </header>

      <section className="inf-p-card" aria-label="Account">
        <div className="inf-p-photo">
          {photo ? <img src={photo} alt="" /> : <span aria-hidden="true">{shown.trim().charAt(0).toUpperCase()}</span>}
          <button type="button" className="inf-p-cam" aria-label="Change photo" disabled={busy === 'photo'} onClick={() => file.current?.click()}><Svg size={18}>{I.cam}</Svg></button>
          <input ref={file} type="file" accept="image/*" hidden onChange={pickPhoto} />
        </div>
        <div className="inf-p-id">
          {editing ? (
            <form className="inf-p-name" onSubmit={saveName}>
              <input aria-label="Your name" autoFocus maxLength={60} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <button type="submit" className="inf-h-go" disabled={busy === 'name'}>Save</button>
              <button type="button" className="inf-p-ghost" onClick={() => setEditing(false)}>Cancel</button>
            </form>
          ) : (
            <h2>{shown}<button type="button" className="inf-p-edit" aria-label="Edit name" onClick={() => { setDraft(name); setEditing(true); }}><Svg size={18}>{I.pen}</Svg></button></h2>
          )}
          {user.email && <p><Svg>{I.mail}</Svg><span>{user.email}</span></p>}
          <p><Svg>{I.cap}</Svg><span>{level}</span></p>
        </div>
        <svg className="inf-h-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 24c-3.500-4.500-6.500-7-10-7a7 7 0 000 14c3.500 0 6.500-2.500 10-7s6.500-7 10-7a7 7 0 010 14c-3.500 0-6.500-2.500-10-7z" fill="none" stroke="currentColor" strokeWidth="3.600" strokeLinecap="round" /></svg>
      </section>

      <section className="inf-p-level" aria-label="Level">
        <div><b>Level {lv.level}</b><span>{lv.size - lv.into} XP to level {lv.level + 1}</span></div>
        <div className="inf-p-bar" role="progressbar" aria-valuemin={0} aria-valuemax={lv.size} aria-valuenow={lv.into}><i style={{width: lv.into + '%'}} /></div>
      </section>

      <div aria-live="polite">
        {msg.text && <p role={msg.kind === 'err' ? 'alert' : undefined} className={msg.kind === 'err' ? 'inf-error' : 'inf-notice'}>{msg.text}</p>}
        {!msg.text && error && <p role="alert" className="inf-error">{error}</p>}
        {!msg.text && !error && notice && <p className="inf-notice">{notice}</p>}
      </div>

      <StatStrip stats={stats} />

      <section className="inf-p-panel" aria-label="Last 7 days">
        <div className="inf-p-head"><h3>This week</h3><span>{weekTotal} {weekTotal === 1 ? 'question' : 'questions'}</span></div>
        <div className="inf-p-week">
          {week.map((x) => (
            <div key={x.key} className={x.today ? 'is-today' : ''}>
              <span className="inf-p-col"><i style={{height: Math.max(x.count ? 8 : 3, Math.round((x.count / peak) * 100)) + '%'}} title={x.count + ' answered'} /></span>
              <small>{x.label.slice(0, 3)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="inf-p-panel" aria-label="Subjects">
        <div className="inf-p-head"><h3>Subject accuracy</h3></div>
        {subj.length ? (
          <ul className="inf-p-subj">
            {subj.slice(0, 8).map((x) => (
              <li key={x.name}>
                <div><b>{x.name}</b><span>{x.pct}% · {x.answered} answered</span></div>
                <div className="inf-p-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={x.pct}><i style={{width: x.pct + '%'}} /></div>
              </li>
            ))}
          </ul>
        ) : <p className="inf-hint">Finish a practice or exam and your results for each subject appear here.</p>}
      </section>

      <section className="inf-p-panel" aria-label="Achievements">
        <div className="inf-p-head"><h3>Achievements</h3><span>{won} of {ach.length}</span></div>
        <ul className="inf-p-ach">
          {ach.map((x) => (
            <li key={x.id} className={x.done ? 'is-done' : ''}>
              <span className="inf-p-medal" aria-hidden="true"><Svg size={20}>{x.done ? I.check : I.trophy}</Svg></span>
              <span><b>{x.title}</b><small>{x.desc}</small></span>
              <span className="inf-sr">{x.done ? 'Earned' : 'Locked'}</span>
            </li>
          ))}
        </ul>
      </section>

      <ul className="inf-p-list">
        <li>
          <span className="inf-p-ico"><Svg>{I.cap}</Svg></span>
          <span className="inf-p-txt"><b>My level</b><small>Set when you signed up. You only see material for this level.</small></span>
          <span className="inf-p-val">{gradeName}</span>
        </li>
        <li className="inf-p-col-li">
          <div className="inf-p-row">
            <span className="inf-p-ico"><Svg>{I.lock}</Svg></span>
            <span className="inf-p-txt"><b>Password</b><small>Change it here or get a reset link by email.</small></span>
            <button type="button" className="inf-p-act" aria-expanded={pw} onClick={() => setPw((v) => !v)}>{pw ? 'Close' : 'Change'}</button>
          </div>
          {pw && (
            <form className="inf-p-pw" onSubmit={savePw}>
              <label><span>Current password</span><input type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} /></label>
              <label><span>New password</span><input type="password" autoComplete="new-password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} /></label>
              <div className="inf-p-pw-act">
                <button type="submit" className="inf-primary" disabled={busy === 'pw'}>{busy === 'pw' ? 'Saving…' : 'Save password'}</button>
                <button type="button" className="inf-link" onClick={() => onReset(user.email || '')}>Email me a reset link</button>
              </div>
            </form>
          )}
        </li>
        <li>
          <span className="inf-p-ico"><Svg>{I.reset}</Svg></span>
          <span className="inf-p-txt"><b>Reset progress</b><small>Clear your XP, streak and subject results.</small></span>
          <button type="button" className="inf-p-act" onClick={clear}>Reset</button>
        </li>
      </ul>

      <button type="button" className="inf-p-out" onClick={onSignOut}><Svg>{I.out}</Svg>Sign out</button>
    </div>
  );
}
