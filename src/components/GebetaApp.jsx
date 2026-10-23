'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, onlineAvailable } from '@/lib/firebase';
import { STRINGS } from '@/lib/i18n';
import { setMuted } from '@/lib/sound';
import LocalGame from './LocalGame';
import CheckersLocal from './checkers/CheckersLocal';
import DominoesLocal from './dominoes/DominoesLocal';
import OnlineRoom from './online/OnlineRoom';
import { Home, Setup, RulesScreen, AuthForm, Lobby, Leaders, ProfileScreen, Tibeb } from './Screens';
import { GAME_LIST } from '@/lib/games.js';

const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export default function GebetaApp() {
  const [lang, setLang] = useState('en');
  const [game, setGame] = useState('gebeta');
  const [muted, setMutedState] = useState(false);
  const [view, setView] = useState({ name: 'home' });
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!onlineAvailable);
  const [profile, setProfile] = useState(null);
  const [dialog, setDialog] = useState(null);
  const t = STRINGS[lang];

  useEffect(() => {
    const l = read('gebeta.lang', null) || (navigator.language?.startsWith('am') ? 'am' : 'en');
    const g = read('gebeta.game', 'gebeta'); if (GAME_LIST.includes(g)) setGame(g);
    setLang(l); const m = read('gebeta.muted', '0') === '1'; setMutedState(m); setMuted(m);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const pickGame = (g) => { setGame(g); write('gebeta.game', g); };
  const toggleLang = () => { const l = lang === 'en' ? 'am' : 'en'; setLang(l); write('gebeta.lang', l); };
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

  const confirm = useCallback((message) => new Promise((resolve) => setDialog({ message, resolve })), []);
  const go = (name, extra = {}) => setView({ name, ...extra });
  const home = () => setView({ name: 'home' });
  const leaveGame = async () => { if (await confirm(t.leaveConfirm)) home(); };

  const me = { name: profile?.displayName || t.you, hero: profile?.avatar || 'lion' };
  const uid = user?.uid;

  const gname = t[`${game}Name`];
  const titles = { game: gname, ai: `${gname} · ${t.playComputer}`, pass: `${gname} · ${t.passPlay}`, online: `${gname} · ${t.playFriendOnline}`, leaders: `${gname} · ${t.leaderboard}`, rules: `${gname} · ${t.rules}`, profile: t.profile };
  const inGame = view.name === 'game' || view.name === 'room';

  let body;
  switch (view.name) {
    case 'home': body = <Home t={t} go={go} onlineOn={onlineAvailable} user={user} profile={profile} game={game} onPickGame={pickGame} />; break;
    case 'ai': case 'pass': body = <Setup t={t} mode={view.name} game={game} onStart={(o) => go('game', { mode: view.name, game, ...o })} />; break;
    case 'game': {
      const P = { t, mode: view.mode, level: view.level, ruleset: view.ruleset, me, onExit: home, onLeave: leaveGame };
      body = view.game === 'checkers' ? <CheckersLocal {...P} />
        : view.game === 'dominoes' ? <DominoesLocal {...P} target={view.target} />
        : <LocalGame {...P} />;
      break;
    }
    case 'rules': body = <RulesScreen t={t} game={game} />; break;
    case 'leaders': body = !onlineAvailable ? <Unavailable t={t} /> : !user ? (authReady ? <AuthForm t={t} /> : null) : <Leaders t={t} uid={uid} game={game} />; break;
    case 'profile': body = !onlineAvailable ? <Unavailable t={t} /> : authReady ? <ProfileScreen t={t} lang={lang} user={user} profile={profile} onSignOut={() => signOut(auth)} /> : null; break;
    case 'online': body = !onlineAvailable ? <Unavailable t={t} /> : !authReady ? null : !user ? <AuthForm t={t} /> : <Lobby t={t} game={game} onEnter={(code) => go('room', { code })} />; break;
    case 'room': body = <OnlineRoom key={view.code} t={t} lang={lang} uid={uid} code={view.code} onExit={home} onSwitchRoom={(code) => go('room', { code })} confirm={confirm} />; break;
    default: body = null;
  }

  return (
    <div className="app">
      <Tibeb />
      <header className="topbar">
        {view.name === 'home' ? <span className="topbar-spacer" /> :
          <button className="icon-btn" onClick={view.name === 'game' ? leaveGame : home} aria-label={t.backHome}>‹</button>}
        <h2 className="topbar-title">{view.name === 'home' ? '' : titles[view.name] || (view.name === 'room' ? `# ${view.code}` : 'ገበጣ')}</h2>
        <div className="topbar-actions">
          <button className="icon-btn txt" onClick={toggleLang} aria-label={t.language}>{lang === 'en' ? 'አማ' : 'EN'}</button>
          <button className="icon-btn" onClick={toggleMute} aria-label={t.sound} aria-pressed={!muted}>{muted ? '🔇' : '🔊'}</button>
        </div>
      </header>
      <main className={`screen${inGame ? ' ingame' : ''}`}>{body}</main>
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
