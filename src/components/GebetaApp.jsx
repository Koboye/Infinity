'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, onlineAvailable } from '@/lib/firebase';
import { STRINGS } from '@/lib/i18n';
import { setMuted } from '@/lib/sound';
import { setMusic, pauseMusic } from '@/lib/music';
import { loadSettings, saveSettings, applySettings, DEFAULTS } from '@/lib/settings';
import LocalGame from './LocalGame';
import CheckersLocal from './checkers/CheckersLocal';
import DominoesLocal from './dominoes/DominoesLocal';
import BingoGame from './bingo/BingoGame';
import OnlineRoom from './online/OnlineRoom';
import { Home, Setup, RulesScreen, AuthForm, Lobby, Leaders, ProfileScreen, ProgressScreen, SettingsScreen, Tibeb } from './Screens';
import { GAME_LIST } from '@/lib/games.js';
import Coach, { needsCoach } from './Coach';
import { setCurrentGame, visit, onUnlock, load as loadProgress, mergeProgress, saveMerged } from '@/lib/progress';

const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export default function GebetaApp() {
  const [lang, setLang] = useState('en');
  const [game, setGame] = useState('gebeta');
  const [muted, setMutedState] = useState(false);
  const [music, setMusicState] = useState(false);
  const [view, setView] = useState({ name: 'home' });
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!onlineAvailable);
  const [profile, setProfile] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [coach, setCoach] = useState(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [offline, setOffline] = useState(false);
  const t = STRINGS[lang];

  useEffect(() => {
    const l = read('gebeta.lang', null) || (navigator.language?.startsWith('am') ? 'am' : 'en');
    const q = new URLSearchParams(window.location.search).get('game');
    const g = GAME_LIST.includes(q) ? q : read('gebeta.game', 'gebeta'); if (GAME_LIST.includes(g)) setGame(g);
    setLang(l); setMusicState(read('gebeta.music', '1') === '1'); const m = read('gebeta.muted', '0') === '1'; setMutedState(m); setMuted(m);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { const s = loadSettings(); setSettings(s); applySettings(s); }, []);
  const changeSettings = (s) => { setSettings(s); saveSettings(s); };
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => { setCurrentGame(game); }, [game]);
  useEffect(() => { visit(); return onUnlock((fresh) => { setToast(fresh[0]); setTimeout(() => setToast(null), 3500); }); }, []);

  const pickGame = (g) => { setGame(g); write('gebeta.game', g); };
  const chooseLang = (l) => { setLang(l); write('gebeta.lang', l); };
  // Browsers only allow audio after a tap, so music starts on the first interaction.
  useEffect(() => {
    if (!music) { setMusic(false); return undefined; }
    const start = () => { setMusic(true); window.removeEventListener('pointerdown', start); };
    window.addEventListener('pointerdown', start);
    return () => window.removeEventListener('pointerdown', start);
  }, [music]);
  useEffect(() => {
    const vis = () => pauseMusic(document.hidden);
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);
  const setMusicTo = (m) => { setMusicState(m); write('gebeta.music', m ? '1' : '0'); if (m) setMusic(true); };
  const toggleMusic = () => setMusicTo(!music);
  const toggleMute = () => { const m = !muted; setMutedState(m); setMuted(m); write('gebeta.muted', m ? '1' : '0'); };

  // Auth + profile document
  useEffect(() => {
    if (!auth) return;
    let unsubProfile = null;
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u); unsubProfile?.(); unsubProfile = null;
      if (!u) { setProfile(null); setAuthReady(true); return; }
      const ref = doc(db, 'users', u.uid);
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const raw = (u.displayName || '').trim();
          const displayName = raw.length >= 2 ? raw.slice(0, 20) : `Guest ${Math.floor(1000 + Math.random() * 9000)}`;
          await setDoc(ref, { displayName, avatar: 'lion', lang: read('gebeta.lang', 'en'), rating: 1000, wins: 0, losses: 0, draws: 0, games: 0, createdAt: serverTimestamp() });
        }
      } catch (e) { console.error('profile init failed', e); }
      unsubProfile = onSnapshot(ref, (s) => setProfile(s.data() || null));
      setAuthReady(true);
    });
    return () => { unsub(); unsubProfile?.(); };
  }, []);

  // Cloud sync: merge on-device progress with the signed-in account so streaks/achievements follow you.
  const syncedFor = useRef(null);
  useEffect(() => {
    if (!user || !profile || !db || syncedFor.current === user.uid) return;
    syncedFor.current = user.uid;
    let remote = null; try { remote = profile.progress ? JSON.parse(profile.progress) : null; } catch { /* ignore bad data */ }
    const merged = mergeProgress(loadProgress(), remote || {});
    saveMerged(merged);
    const text = JSON.stringify(merged);
    if (text !== profile.progress && text.length < 6000) updateDoc(doc(db, 'users', user.uid), { progress: text }).catch(() => {});
  }, [user, profile]);
  const confirm = useCallback((message) => new Promise((resolve) => setDialog({ message, resolve })), []);
  const go = (name, extra = {}) => {
    // starting a game is a tap, so the browser lets us take the whole screen right now
    if ((name === 'game' || name === 'room') && !document.fullscreenElement) document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    if (name === 'game') setCoach(needsCoach(extra.game) ? extra.game : null); setView({ name, ...extra }); };
  const home = () => setView({ name: 'home' });
  const leaveGame = async () => { if (await confirm(t.leaveConfirm)) home(); };

  const me = { name: profile?.displayName || t.you, hero: profile?.avatar || 'lion' };
  const uid = user?.uid;

  const gname = t[`${game}Name`];
  const titles = { game: gname, ai: `${gname} · ${t.playComputer}`, pass: `${gname} · ${t.passPlay}`, online: `${gname} · ${t.playFriendOnline}`, leaders: `${gname} · ${t.leaderboard}`, rules: `${gname} · ${t.rules}`, profile: t.profile, progress: t.progress, settings: t.settings };
  const inGame = view.name === 'game' || view.name === 'room';

  // Full-screen play ground: the page chrome shrinks away and, where the browser allows it, the whole screen is used.
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('in-game', inGame);
    return () => document.documentElement.classList.remove('in-game');
  }, [inGame]);
  useEffect(() => {
    const on = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  useEffect(() => {
    if (!inGame) { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); return undefined; }
    // Browsers only allow full screen from a tap, so enter it on the first touch inside the game.
    const go = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); };
    window.addEventListener('pointerup', go, { once: true });
    return () => window.removeEventListener('pointerup', go);
  }, [inGame]);
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
  };

  let body;
  switch (view.name) {
    case 'home': body = <Home t={t} go={go} onlineOn={onlineAvailable} user={user} profile={profile} game={game} onPickGame={pickGame} />; break;
    case 'ai': case 'pass': body = <Setup t={t} mode={view.name} game={game} onStart={(o) => go('game', { mode: view.name, game, ...o })} />; break;
    case 'game': {
      const P = { t, mode: view.mode, level: view.level, ruleset: view.ruleset, me, onExit: home, onLeave: leaveGame };
      body = view.game === 'checkers' ? <CheckersLocal {...P} />
        : view.game === 'dominoes' ? <DominoesLocal {...P} target={view.target} />
        : view.game === 'bingo' ? <BingoGame {...P} />
        : <LocalGame {...P} />;
      break;
    }
    case 'settings': body = <SettingsScreen t={t} lang={lang} onLang={chooseLang} music={music} onMusic={setMusicTo} muted={muted} onMute={(m) => { setMutedState(m); setMuted(m); write('gebeta.muted', m ? '1' : '0'); }} settings={settings} onSettings={changeSettings} />; break;
    case 'progress': body = <ProgressScreen t={t} lang={lang} />; break;
    case 'rules': body = <RulesScreen t={t} game={game} />; break;
    case 'leaders': body = !onlineAvailable ? <Unavailable t={t} /> : !user ? (authReady ? <AuthForm t={t} /> : null) : <Leaders t={t} uid={uid} game={game} />; break;
    case 'profile': body = !onlineAvailable ? <Unavailable t={t} /> : authReady ? <ProfileScreen t={t} lang={lang} user={user} profile={profile} onSignOut={() => signOut(auth)} /> : null; break;
    case 'online': body = !onlineAvailable ? <Unavailable t={t} /> : !authReady ? null : !user ? <AuthForm t={t} /> : <Lobby t={t} game={game} onEnter={(code) => go('room', { code })} />; break;
    case 'room': body = <OnlineRoom key={view.code} t={t} lang={lang} uid={uid} code={view.code} onExit={home} onSwitchRoom={(code) => go('room', { code })} confirm={confirm} />; break;
    default: body = null;
  }

  return (
    <div className="app">
      {offline && <div className="offline-bar" role="status">{t.offline}</div>}
      <Tibeb />
      <header className="topbar">
        {view.name === 'home' ? <span className="topbar-spacer" /> :
          <button className="icon-btn" onClick={view.name === 'game' ? leaveGame : home} aria-label={t.backHome}>‹</button>}
        <h2 className="topbar-title">{view.name === 'home' ? '' : titles[view.name] || (view.name === 'room' ? `# ${view.code}` : 'ገበጣ')}</h2>
        <div className="topbar-actions">
          <div className="lang-switch" role="group" aria-label={t.language}>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => chooseLang('en')} aria-pressed={lang === 'en'} lang="en" title="English">EN</button>
            <button className={lang === 'am' ? 'on' : ''} onClick={() => chooseLang('am')} aria-pressed={lang === 'am'} lang="am" title="አማርኛ">አማ</button>
          </div>
          {inGame && <button className="icon-btn" onClick={toggleFs} aria-label="Full screen" aria-pressed={isFs}>{isFs ? '🗗' : '⛶'}</button>}
          <button className="icon-btn" onClick={() => go('settings')} aria-label={t.settings}>⚙️</button>
          <button className="icon-btn" onClick={toggleMute} aria-label={t.sound} aria-pressed={!muted}>{muted ? '🔇' : '🔊'}</button>
        </div>
      </header>
      <main className={`screen${inGame ? ' ingame' : ''}`}>{body}</main>
      {coach && view.name === 'game' && <Coach t={t} game={coach} onClose={() => setCoach(null)} />}
      {toast && <div className="toast" role="status">{toast.icon} {t.unlocked} {toast[lang] || toast.en}</div>}
      {dialog && (
        <div className="overlay" role="alertdialog" aria-modal="true">
          <div className="dialog">
            <p>{dialog.message}</p>
            <div className="result-actions">
              <button className="btn" onClick={() => { dialog.resolve(false); setDialog(null); }}>{t.cancel}</button>
              <button className="btn primary danger" onClick={() => { dialog.resolve(true); setDialog(null); }}>{t.ok}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Unavailable({ t }) { return <div className="panel center"><p className="muted">{t.onlineUnavailable}</p></div>; }
