'use client';
import {useEffect, useRef, useState} from 'react';
import {EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword, updateProfile} from 'firebase/auth';
import {auth} from '@/lib/firebase';
import {Svg, initialOf} from './HomeScreen';
import {uploadAvatar, removeAvatar} from '@/lib/upload';
import {GOALS, LANGS, makeT} from '@/lib/infText';
import {goalOf, levelFor} from '@/lib/studyStreak';
import ReminderRow from './ReminderRow';

const I = {
  cap: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" /></>,
  pen: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" /></>,
  user: <><circle cx="12" cy="8.5" r="3.6" /><path d="M4.5 20c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5" /></>,
  out: <><path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" /><path d="M16 8l4 4-4 4M20 12H9" /></>,
  chev: <path d="m9 6 6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
};
const friendly = (e, t) => ({
  'auth/wrong-password': t('pwWrong'), 'auth/invalid-credential': t('pwWrong'),
  'auth/weak-password': t('pwShort'), 'auth/requires-recent-login': t('needsRecent'),
  'auth/too-many-requests': t('tooMany'), 'auth/network-request-failed': t('offline'),
}[e?.code] || e?.message || t('generic'));

export default function ProfileScreen({user, gradeName, deptName, stats, notice, error, onReset, onSignOut, onProfile, onClearProgress, onDeleted, onGoal, onLang, lang = 'en', t = makeT('en')}) {
  const [more, setMore] = useState(false), [editName, setEditName] = useState(false);
  const [name, setName] = useState(user.displayName || '');
  const [photo, setPhoto] = useState(user.photoURL || '');
  const [draft, setDraft] = useState(user.displayName || '');
  const [pw, setPw] = useState(false), [cur, setCur] = useState(''), [next, setNext] = useState('');
  const [del, setDel] = useState(false), [delPw, setDelPw] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({kind: '', text: ''});
  const file = useRef(null);
  const hasPassword = user.providerData?.some((p) => p.providerId === 'password') ?? true;
  const say = (kind, text) => setMsg({kind, text});
  useEffect(() => {
    if (!msg.text) return;
    const id = setTimeout(() => setMsg({kind: '', text: ''}), msg.kind === 'err' ? 8000 : 3200);
    return () => clearTimeout(id);
  }, [msg]);

  const shown = name || (user.email || '').split('@')[0] || 'Learner';
  const level = gradeName + (deptName ? ', ' + deptName : '');
  const lv = levelFor(stats.xp), goal = goalOf(stats);

  const saveName = async (e) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return say('err', t('enterName'));
    setBusy('name'); say('', '');
    try { await updateProfile(user, {displayName: v}); setName(v); setEditName(false); onProfile?.(); say('ok', t('nameSaved')); }
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
  const dropPhoto = async () => {
    setBusy('photo'); say('', '');
    try { await removeAvatar(user.uid); await updateProfile(user, {photoURL: ''}); setPhoto(''); onProfile?.(); say('ok', t('photoRemoved')); }
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
  const clear = () => { if (window.confirm(t('resetConfirm'))) { onClearProgress(); say('ok', t('progressReset')); } };
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
    <div className="inf-seg" role="group" aria-label={label}>
      {options.map(([v, text]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)}>{text}</button>)}
    </div>
  );
  const toast = <div className="inf-toasts" aria-live="polite">{msg.text && <p role={msg.kind === 'err' ? 'alert' : undefined} className={'inf-toast' + (msg.kind === 'err' ? ' is-err' : '')}><Svg size={20}>{msg.kind === 'err' ? I.x : I.check}</Svg>{msg.text}</p>}</div>;

  return (
    <div className="inf-h inf-p">
      <section className="inf-me" aria-label={t('myProfile')}>
        <div className="inf-me-photo">
          <span className="inf-ava inf-ava-xl">{photo ? <img src={photo} alt="" /> : initialOf(shown)}</span>
          <button type="button" className="inf-me-edit" aria-label={t('changePhoto')} disabled={busy === 'photo'} onClick={() => file.current?.click()}><Svg size={18}>{I.pen}</Svg></button>
          <input ref={file} type="file" accept="image/*" style={{display: 'none'}} tabIndex={-1} onChange={pickPhoto} />
        </div>
        {editName ? (
          <form className="inf-name-form" onSubmit={saveName}>
            <input aria-label={t('yourName')} maxLength={60} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" className="inf-x-next" disabled={busy === 'name' || !draft.trim() || draft.trim() === name}>{t('save')}</button>
            <button type="button" className="inf-x-icon" aria-label={t('cancel')} onClick={() => { setEditName(false); setDraft(name); }}><Svg size={20}>{I.x}</Svg></button>
          </form>
        ) : <h1 className="inf-name">{shown}<button type="button" className="inf-x-icon" aria-label={t('nameLabel')} onClick={() => { setDraft(name); setEditName(true); }}><Svg size={18}>{I.pen}</Svg></button></h1>}
        <span className="inf-gradepill"><Svg size={18}>{I.cap}</Svg>{level}</span>
        <div className="inf-me-lvl">
          <div className="inf-lp-head"><b>{t('levelN', {n: lv.level})}</b><small>{t('xpToNext', {n: lv.size - lv.into, m: lv.level + 1})}</small></div>
          <div className="inf-bar inf-bar-lg" role="progressbar" aria-label={t('learningProgress')} aria-valuemin={0} aria-valuemax={lv.size} aria-valuenow={lv.into}><i style={{width: lv.into + '%'}} /></div>
        </div>
      </section>

      {(error || notice) && !msg.text && <p role={error ? 'alert' : undefined} className={error ? 'inf-error inf-note' : 'inf-notice inf-note'}>{error || notice}</p>}

      <section className="inf-panel inf-set" aria-label={t('settings')}>
        <div className="inf-set-row"><div><b>{t('language')}</b></div><Seg label={t('language')} value={lang} options={LANGS} onPick={(v) => onLang?.(v)} /></div>
        <div className="inf-set-row"><div><b>{t('goal')}</b></div><Seg label={t('goal')} value={goal} options={GOALS.map((g) => [g, String(g)])} onPick={(v) => { onGoal?.(v); say('ok', t('goalSaved')); }} /></div>
        <ReminderRow t={t} lang={lang} say={say} />
      </section>

      <button type="button" className="inf-ghost-btn inf-logout" onClick={onSignOut}><Svg size={20}>{I.out}</Svg>{t('logOut')}</button>

      <section className="inf-panel inf-more" aria-label={t('account')}>
        <button type="button" className="inf-fold-btn" aria-expanded={more} onClick={() => setMore((v) => !v)}><b>{t('account')}</b><span>{more ? t('close') : t('change')}</span></button>
        {more && (
          <div className="inf-more-body">
            {user.email && <div className="inf-kv"><span>Email</span><b>{user.email}</b></div>}
            {photo && <div className="inf-set-row"><div><b>{t('changePhoto')}</b></div><button type="button" className="inf-ghost-btn" disabled={busy === 'photo'} onClick={dropPhoto}>{t('remove')}</button></div>}
            {hasPassword && (
              <div className="inf-fold">
                <button type="button" className="inf-fold-btn" aria-expanded={pw} onClick={() => setPw((v) => !v)}><b>{t('password')}</b><span>{pw ? t('close') : t('change')}</span></button>
                {pw && (
                  <form className="inf-fold-body" onSubmit={savePw}>
                    <label><span>{t('curPw')}</span><input type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} /></label>
                    <label><span>{t('newPw')}</span><input type="password" autoComplete="new-password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} /></label>
                    <button type="submit" className="inf-x-next" disabled={busy === 'pw'}>{busy === 'pw' ? t('saving') : t('savePw')}</button>
                    <button type="button" className="inf-link" onClick={() => onReset(user.email || '')}>{t('emailReset')}</button>
                  </form>
                )}
              </div>
            )}
            <div className="inf-set-row"><div><b>{t('exportData')}</b></div><button type="button" className="inf-ghost-btn" onClick={exportData}>{t('download')}</button></div>
            <div className="inf-set-row"><div><b>{t('resetProgress')}</b></div><button type="button" className="inf-ghost-btn" onClick={clear}>{t('reset')}</button></div>
            <div className="inf-set-row"><div><b>{t('deleteTitle')}</b></div>{!del && <button type="button" className="inf-ghost-btn is-bad" onClick={() => setDel(true)}>{t('deleteBtn')}</button>}</div>
            {del && (
              <form className="inf-fold-body" onSubmit={deleteAccount}>
                <small>{t('deleteSub')}</small>
                {hasPassword && <label><span>{t('deleteAsk')}</span><input type="password" autoComplete="current-password" required value={delPw} onChange={(e) => setDelPw(e.target.value)} /></label>}
                <button type="submit" className="inf-x-next is-bad" disabled={busy === 'del'}>{busy === 'del' ? t('saving') : t('deleteGo')}</button>
                <button type="button" className="inf-link" onClick={() => { setDel(false); setDelPw(''); }}>{t('cancel')}</button>
              </form>
            )}
          </div>
        )}
      </section>

      <p className="inf-legal"><a href="/privacy">{t('privacy')}</a> · <a href="/terms">{t('terms')}</a></p>
      {toast}
    </div>
  );
}
