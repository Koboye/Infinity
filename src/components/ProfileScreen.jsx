'use client';
import {useEffect, useRef, useState} from 'react';
import {EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword, updateProfile} from 'firebase/auth';
import {auth} from '@/lib/firebase';
import {StatStrip} from './HomeScreen';
import {uploadAvatar, removeAvatar} from '@/lib/upload';
import {GOALS, LANGS, makeT} from '@/lib/infText';
import {achievements, goalOf, levelFor, subjectStats, weekActivity} from '@/lib/studyStreak';

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
  x: <path d="M6 6l12 12M18 6L6 18" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  down: <><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z" />,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></>,
  img: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-8 8" /></>,
  reset: <><path d="M4 12a8 8 0 108-8H7" /><path d="M7 1v6H1" transform="translate(3 0)" /></>,
};
const friendly = (e, t) => ({
  'auth/wrong-password': t('pwWrong'), 'auth/invalid-credential': t('pwWrong'),
  'auth/weak-password': t('pwShort'), 'auth/requires-recent-login': t('needsRecent'),
  'auth/too-many-requests': t('tooMany'), 'auth/network-request-failed': t('offline'),
}[e?.code] || e?.message || t('generic'));

export default function ProfileScreen({user, gradeName, deptName, stats, notice, error, onReset, onSignOut, onProfile, onClearProgress, onDeleted, onGoal, onLang, lang = 'en', t = makeT('en')}) {
  const [name, setName] = useState(user.displayName || '');
  const [photo, setPhoto] = useState(user.photoURL || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pw, setPw] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState('');
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  const hasPassword = user.providerData?.some((p) => p.providerId === 'password') ?? true;
  const [msg, setMsg] = useState({kind: '', text: ''});
  const file = useRef(null);
  const say = (kind, text) => setMsg({kind, text});
  // Confirmations are toasts: they fade after a few seconds instead of sitting on the page.
  useEffect(() => {
    if (!msg.text) return;
    const id = setTimeout(() => setMsg({kind: '', text: ''}), msg.kind === 'err' ? 8000 : 3800);
    return () => clearTimeout(id);
  }, [msg]);

  const shown = name || (user.email || '').split('@')[0] || 'Learner';
  const level = gradeName + (deptName ? ', ' + deptName : '');
  const lv = levelFor(stats.xp), goal = goalOf(stats);
  const week = weekActivity(stats, new Date(), lang === 'am' ? 'am-ET' : 'en'), peak = Math.max(10, ...week.map((x) => x.count)), weekTotal = week.reduce((n, x) => n + x.count, 0);
  const subj = subjectStats(stats), ach = achievements(stats), won = ach.filter((x) => x.done).length;

  const saveName = async (e) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return say('err', t('enterName'));
    setBusy('name'); say('', '');
    try { await updateProfile(user, {displayName: v}); setName(v); setEditing(false); onProfile?.(); say('ok', t('nameSaved')); }
    catch (err) { say('err', friendly(err, t)); } finally { setBusy(''); }
  };
  const pickPhoto = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) return say('err', t('choosePicture'));
    setBusy('photo'); say('', '');
    try { const url = await uploadAvatar(user.uid, f); await updateProfile(user, {photoURL: url}); setPhoto(url + '#' + Date.now()); onProfile?.(); say('ok', t('photoSaved')); }
    catch (err) { say('err', friendly(err, t)); } finally { setBusy(''); }
  };
  const savePw = async (e) => {
    e.preventDefault();
    if (next.length < 6) return say('err', t('pwShort'));
    setBusy('pw'); say('', '');
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, cur));
      await updatePassword(user, next);
      setCur(''); setNext(''); setPw(false); say('ok', t('pwSaved'));
    } catch (err) { say('err', friendly(err, t)); } finally { setBusy(''); }
  };
  const clear = () => {
    if (window.confirm(t('resetConfirm'))) { onClearProgress(); say('ok', t('progressReset')); }
  };

  const dropPhoto = async () => {
    setBusy('photo'); say('', '');
    try { await removeAvatar(user.uid); await updateProfile(user, {photoURL: ''}); setPhoto(''); onProfile?.(); say('ok', t('photoRemoved')); }
    catch (err) { say('err', friendly(err, t)); } finally { setBusy(''); }
  };
  const exportData = () => {
    const data = {exportedAt: new Date().toISOString(), name: shown, email: user.email || '', level, progress: stats};
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
    a.download = 'infinity-my-data.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const deleteAccount = async (e) => {
    e.preventDefault(); setBusy('del'); say('', '');
    try {
      if (hasPassword) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, delPw));
      const token = await user.getIdToken(true);
      const res = await fetch('/api/gebeta', {method: 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify({action: 'accountDelete'})});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('generic'));
      onDeleted?.();
      await signOut(auth).catch(() => {});
    } catch (err) { say('err', friendly(err, t)); setBusy(''); }
  };
  const Seg = ({value, options, onPick, label}) => (
    <div className="inf-p-seg" role="group" aria-label={label}>
      {options.map(([v, text]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)}>{text}</button>)}
    </div>
  );

  const row = (ico, title, sub, control, tone) => (
    <li>
      <span className="inf-p-ico" data-tone={tone}><Svg>{ico}</Svg></span>
      <span className="inf-p-txt"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {control}
    </li>
  );

  return (
    <div className="inf-h inf-p">
      <section className="inf-p-hero" aria-label="Account">
        <div className="inf-p-who">
          <div className="inf-p-photo">
            {photo ? <img src={photo} alt="" /> : <span aria-hidden="true">{shown.trim().charAt(0).toUpperCase()}</span>}
            <button type="button" className="inf-p-cam" aria-label={t('changePhoto')} disabled={busy === 'photo'} onClick={() => file.current?.click()}><Svg size={18}>{I.cam}</Svg></button>
            <input ref={file} type="file" accept="image/*" style={{display: 'none'}} tabIndex={-1} onChange={pickPhoto} />
          </div>
          <div className="inf-p-id">
            {editing ? (
              <form className="inf-p-name" onSubmit={saveName}>
                <input aria-label={t('yourName')} autoFocus maxLength={60} value={draft} onChange={(e) => setDraft(e.target.value)} />
                <button type="submit" className="inf-h-go" disabled={busy === 'name'}>{t('save')}</button>
                <button type="button" className="inf-p-ghost" onClick={() => setEditing(false)}>{t('cancel')}</button>
              </form>
            ) : (
              <h1>{shown}<button type="button" className="inf-p-edit" aria-label={t('editName')} onClick={() => { setDraft(name); setEditing(true); }}><Svg size={18}>{I.pen}</Svg></button></h1>
            )}
            <ul className="inf-p-chips">
              {user.email && <li><Svg size={18}>{I.mail}</Svg><span>{user.email}</span></li>}
              <li><Svg size={18}>{I.cap}</Svg><span>{level}</span></li>
            </ul>
          </div>
        </div>
        <div className="inf-p-lv">
          <div><b>{t('levelN', {n: lv.level})}</b><span>{t('xpToNext', {n: lv.size - lv.into, m: lv.level + 1})}</span></div>
          <div className="inf-p-bar" role="progressbar" aria-label={t('levelN', {n: lv.level})} aria-valuemin={0} aria-valuemax={lv.size} aria-valuenow={lv.into}><i style={{width: lv.into + '%'}} /></div>
        </div>
        <svg className="inf-h-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 24c-3.500-4.500-6.500-7-10-7a7 7 0 000 14c3.500 0 6.500-2.500 10-7s6.500-7 10-7a7 7 0 010 14c-3.500 0-6.500-2.500-10-7z" fill="none" stroke="currentColor" strokeWidth="3.600" strokeLinecap="round" /></svg>
      </section>

      {(error || notice) && !msg.text && <p role={error ? 'alert' : undefined} className={error ? 'inf-error inf-p-note' : 'inf-notice inf-p-note'}>{error || notice}</p>}

      <StatStrip stats={stats} t={t} />

      <section className="inf-p-panel inf-p-weekp" aria-label="Last 7 days">
        <div className="inf-p-head"><h2>{t('thisWeek')}</h2><span>{t('nAnsweredShort', {n: weekTotal})}</span></div>
        <div className="inf-p-week">
          {week.map((x) => (
            <div key={x.key} className={x.today ? 'is-today' : ''}>
              <em>{x.count || ''}</em>
              <span className="inf-p-col"><i style={{height: Math.max(x.count ? 10 : 4, Math.round((x.count / peak) * 100)) + '%'}} title={x.count + ' answered'} /></span>
              <small>{x.label.slice(0, 3)}</small>
            </div>
          ))}
        </div>
        {!weekTotal && <p className="inf-hint inf-p-empty">{t('weekEmpty')}</p>}
      </section>

      <section className="inf-p-panel inf-p-subjp" aria-label="Subjects">
        <div className="inf-p-head"><h2>{t('subjectAccuracy')}</h2></div>
        {subj.length ? (
          <ul className="inf-p-subj">
            {subj.slice(0, 8).map((x) => (
              <li key={x.name}>
                <div><b>{x.name}</b><span>{t('pctAnswered', {p: x.pct, n: x.answered})}</span></div>
                <div className="inf-p-bar" role="progressbar" aria-label={x.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={x.pct}><i style={{width: x.pct + '%'}} /></div>
              </li>
            ))}
          </ul>
        ) : <p className="inf-hint inf-p-empty">{t('subjectEmpty')}</p>}
      </section>

      <section className="inf-p-panel inf-p-achp" aria-label="Achievements">
        <div className="inf-p-head"><h2>{t('achievements')}</h2><span>{t('ofN', {a: won, b: ach.length})}</span></div>
        <ul className="inf-p-ach">
          {ach.map((x) => (
            <li key={x.id} className={x.done ? 'is-done' : ''}>
              <span className="inf-p-medal" aria-hidden="true"><Svg size={22}>{x.done ? I.trophy : I.lock}</Svg></span>
              <span><b>{t('ach_' + x.id)}</b><small>{t('ach_' + x.id + '_d')}</small></span>
              <span className="inf-sr">{x.done ? t('earned') : t('locked')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="inf-p-groups" aria-label={t('settings')}>
        <div>
          <h2 className="inf-p-sh">{t('grpAccount')}</h2>
          <ul className="inf-p-list">
            {row(I.img, t('photo'), t('photoSub'),
              <span className="inf-p-pair">
                <button type="button" className="inf-p-act" disabled={busy === 'photo'} onClick={() => file.current?.click()}>{t('change')}</button>
                {photo && <button type="button" className="inf-p-act" disabled={busy === 'photo'} onClick={dropPhoto}>{t('remove')}</button>}
              </span>, 'blue')}
            {row(I.cap, t('myLevel'), t('myLevelSub'), <span className="inf-p-val">{gradeName}</span>, 'blue')}
            <li className="inf-p-col-li">
              <div className="inf-p-row">
                <span className="inf-p-ico" data-tone="blue"><Svg>{I.lock}</Svg></span>
                <span className="inf-p-txt"><b>{t('password')}</b><small>{t('passwordSub')}</small></span>
                <button type="button" className="inf-p-act" aria-expanded={pw} onClick={() => setPw((v) => !v)}>{pw ? t('close') : t('change')}</button>
              </div>
              {pw && (
                <form className="inf-p-pw" onSubmit={savePw}>
                  <label><span>{t('curPw')}</span><input type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} /></label>
                  <label><span>{t('newPw')}</span><input type="password" autoComplete="new-password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} /></label>
                  <div className="inf-p-pw-act">
                    <button type="submit" className="inf-p-save" disabled={busy === 'pw'}>{busy === 'pw' ? t('saving') : t('savePw')}</button>
                    <button type="button" className="inf-link" onClick={() => onReset(user.email || '')}>{t('emailReset')}</button>
                  </div>
                </form>
              )}
            </li>
          </ul>
        </div>

        <div>
          <h2 className="inf-p-sh">{t('grpPrefs')}</h2>
          <ul className="inf-p-list">
            {row(I.globe, t('language'), t('languageSub'), <Seg label={t('language')} value={lang} options={LANGS} onPick={(v) => onLang?.(v)} />, 'violet')}
            {row(I.target, t('goal'), t('goalSub'), <Seg label={t('goal')} value={goal} options={GOALS.map((g) => [g, String(g)])} onPick={(v) => { onGoal?.(v); say('ok', t('goalSaved')); }} />, 'violet')}
          </ul>
        </div>

        <div>
          <h2 className="inf-p-sh">{t('grpData')}</h2>
          <ul className="inf-p-list">
            {row(I.down, t('exportData'), t('exportSub'), <button type="button" className="inf-p-act" onClick={exportData}>{t('download')}</button>, 'green')}
            {row(I.shield, t('legal'), '', <span className="inf-p-pair"><a className="inf-p-act" href="/privacy">{t('privacy')}</a><a className="inf-p-act" href="/terms">{t('terms')}</a></span>, 'green')}
            {row(I.reset, t('resetProgress'), t('resetSub'), <button type="button" className="inf-p-act" onClick={clear}>{t('reset')}</button>, 'green')}
          </ul>
        </div>

        <div className="inf-p-end">
          <button type="button" className="inf-p-out" onClick={onSignOut}><Svg>{I.out}</Svg>{t('signOut')}</button>
          <section className="inf-p-danger" aria-label={t('deleteTitle')}>
            <div className="inf-p-row">
              <span className="inf-p-ico"><Svg>{I.trash}</Svg></span>
              <span className="inf-p-txt"><b>{t('deleteTitle')}</b><small>{t('deleteSub')}</small></span>
              {!del && <button type="button" className="inf-p-act inf-p-bad" onClick={() => setDel(true)}>{t('deleteBtn')}</button>}
            </div>
            {del && (
              <form className="inf-p-pw" onSubmit={deleteAccount}>
                {hasPassword && <label><span>{t('deleteAsk')}</span><input type="password" autoComplete="current-password" required value={delPw} onChange={(e) => setDelPw(e.target.value)} /></label>}
                <div className="inf-p-pw-act">
                  <button type="submit" className="inf-p-destroy" disabled={busy === 'del'}>{busy === 'del' ? t('saving') : t('deleteGo')}</button>
                  <button type="button" className="inf-link" onClick={() => { setDel(false); setDelPw(''); }}>{t('cancel')}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      </section>

      <div className="inf-p-toasts" aria-live="polite">
        {msg.text && <p role={msg.kind === 'err' ? 'alert' : undefined} className={'inf-p-toast' + (msg.kind === 'err' ? ' is-err' : '')}><Svg size={20}>{msg.kind === 'err' ? I.x : I.check}</Svg>{msg.text}</p>}
      </div>
    </div>
  );
}
