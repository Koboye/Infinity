'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, onlineAvailable, apiCall } from '@/lib/firebase';
import { STRINGS } from '@/lib/i18n';
import { setMuted } from '@/lib/sound';
import { setMusic, pauseMusic } from '@/lib/music';
import { loadSettings, saveSettings, applySettings, DEFAULTS } from '@/lib/settings';
import dynamic from 'next/dynamic';
import { touchRecent } from '@/lib/recent.js';
import ModesScreen from './ModesScreen';
import BottomNav from './BottomNav';
import { WalletChip, SpinSheet, WelcomeGift } from './Wallet';
import RewardedAdButton from './RewardedAdButton';
import EarnOffer from './EarnOffer';
import AdOverlay from './AdOverlay';
import * as Ads from '@/lib/ads';
import * as Wallet from '@/lib/wallet';
import { Home, Setup, RulesScreen, AuthForm, Lobby, Leaders, ProfileScreen, ProgressScreen, SettingsScreen, Tibeb } from './Screens';
import { isPlayable, GAMES } from '@/lib/games.js';
import Coach, { needsCoach } from './Coach';
import { usePhoto } from '@/lib/photo';
import { setCurrentGame, visit, onUnlock, load as loadProgress, mergeProgress, saveMerged } from '@/lib/progress';

// v68: each game's code is downloaded only when it is opened, so the app opens faster on a slow connection.
const Loading = () => <div className="boot" role="status" aria-busy="true"><div className="boot-seed" /></div>;
const lazy = (load) => dynamic(load, { ssr: false, loading: Loading });
const LocalGame = lazy(() => import('./LocalGame'));
const CheckersLocal = lazy(() => import('./checkers/CheckersLocal'));
const DominoesLocal = lazy(() => import('./dominoes/DominoesLocal'));
const BingoGame = lazy(() => import('./bingo/BingoGame'));
const LudoGame = lazy(() => import('./ludo/LudoGame'));
const OnlineRoom = lazy(() => import('./online/OnlineRoom'));

const PRELOAD = { gebeta: () => import('./LocalGame'), checkers: () => import('./checkers/CheckersLocal'), dominoes: () => import('./dominoes/DominoesLocal'), bingo: () => import('./bingo/BingoGame'), ludo: () => import('./ludo/LudoGame') };
const preload = (g) => { try { PRELOAD[g]?.().catch(() => {}); } catch { /* the normal load will try again */ } };   // starts the download while the pre-game ad is on screen

const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

const GAME_LIST_ONLINE = Object.values(GAMES).filter((g) => !g.offlineOnly && !g.comingSoon).map((g) => g.id);

export default function GebetaApp() {
  const [lang, setLang] = useState('en');
  const [game, setGame] = useState('gebeta');
  const [muted, setMutedState] = useState(false);
  const [music, setMusicState] = useState(false);
  const [view, setView] = useState({ name: 'home' });
  const [adShow, setAdShow] = useState(null);                // { ad, placement, resolve }: the full-screen ad on screen right now
  const adRef = useRef(null); adRef.current = adShow;
  const langRef = useRef(lang); langRef.current = lang;   // the ad picker reads the current language without re-creating runAd
  const [sheet, setSheet] = useState(null);                  // { type: 'spin' | 'gift' }
  const viewRef = useRef(view); viewRef.current = view;
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
    const g = isPlayable(q) ? q : read('gebeta.game', 'gebeta'); if (isPlayable(g)) setGame(g); // a coming-soon game is never restored
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
  useEffect(() => { setCurrentGame(game); document.documentElement.dataset.game = game; document.documentElement.style.setProperty('--game-accent', (GAMES[game] || GAMES.gebeta).accent); }, [game]);
  useEffect(() => { visit(); return onUnlock((fresh) => { setToast(fresh[0]); setTimeout(() => setToast(null), 3500); }); }, []);

  const pickGame = (g) => { setGame(g); if (isPlayable(g)) { write('gebeta.game', g); try { write('gebeta.recent', JSON.stringify(touchRecent(JSON.parse(read('gebeta.recent', '[]')), g))); } catch { /* history is a nicety */ } } };
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
  // A short full-screen ad (splash / pre_game). Resolves when it is over, or at once when none is due: ads never block the app.
  const runAd = useCallback(async (placement, opts = {}, attempt = 0) => {
    if (adRef.current) return;
    let ad = null; try { ad = await Ads.nextAd(placement, { lang: langRef.current, game: opts.game || null, waitMs: placement === 'splash' ? 3000 : 1500, retry: attempt > 0 }); } catch { ad = null; }
    if (!ad || adRef.current) return;
    const reason = await new Promise((resolve) => setAdShow({ ad, placement, resolve }));
    if (reason === 'failed' && attempt < 2) {                  // v64: its picture would not load — remember that and show the next ad instead of nothing
      Ads.markBad(ad); await new Promise((r) => setTimeout(r, 60));
      return runAd(placement, opts, attempt + 1);
    }
  }, []);
  const splashed = useRef(false);
  const [splashDone, setSplashDone] = useState(false);          // v66: the free-spins banner waits until the opening ad is over
  useEffect(() => { if (splashed.current) return; splashed.current = true; Ads.warm(); runAd('splash').finally(() => setSplashDone(true)); }, [runAd]);   // app open
  useEffect(() => { Ads.setGate((g) => runAd('pre_game', { game: g })); return () => Ads.setGate(null); }, [runAd]);   // v66: the ad between rounds (Play again / Rematch) in every game
  // v68.1: lazy game code must also work OFFLINE. Once the opening ad is over and the phone is idle, fetch the other games' code one by one
  // (the service worker keeps what is fetched), so every game still starts without a connection. Skipped on Data Saver or when offline.
  useEffect(() => {
    if (!splashDone) return undefined;
    try { if (navigator.connection?.saveData || !navigator.onLine) return undefined; } catch { /* unknown: go on */ }
    const timers = [];
    const run = () => Object.keys(PRELOAD).forEach((g, i) => timers.push(setTimeout(() => preload(g), i * 1200)));
    const idle = 'requestIdleCallback' in window ? window.requestIdleCallback(run, { timeout: 8000 }) : setTimeout(run, 4000);
    return () => { timers.forEach(clearTimeout); try { if ('cancelIdleCallback' in window) window.cancelIdleCallback(idle); else clearTimeout(idle); } catch { /* ignore */ } };
  }, [splashDone]);
  const go = (name, extra = {}) => {
    // a coming-soon game (Dominoes) has no play, setup, rules, online or leaderboard screens
    if (['modes', 'ai', 'pass', 'online', 'leaders', 'rules'].includes(name) && !isPlayable(game)) return;
    if (name === 'game' && !isPlayable(extra.game)) return;
    // starting a game is a tap, so the browser lets us take the whole screen right now
    if ((name === 'game' || name === 'room') && !document.fullscreenElement) document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    const enter = () => { if (name === 'game') setCoach(needsCoach(extra.game) ? extra.game : null); setView({ name, ...extra }); };
    if (name === 'game') { preload(extra.game); runAd('pre_game', { game: extra.game }).then(enter); return; }   // a short ad before a local game (capped, see adsCore.CAPS)
    enter(); };
  const home = () => setView({ name: 'home' });
  // The wallet belongs to the signed-in account and lives on the server: ask for it whenever the account changes.
  const walletFor = useRef(null);
  useEffect(() => {
    if (!authReady) return;
    if (!user) { walletFor.current = null; Wallet.reset(); return; }
    if (walletFor.current === user.uid) return;
    walletFor.current = user.uid;
    Wallet.refresh().then((r) => { if (r.gift) setSheet({ type: 'gift' }); });
  }, [authReady, user]);
  // Invite link (?room=CODE): sign in (guest is fine), join the friend's room, then clean the address bar.
  const pendingRoom = useRef(null);
  useEffect(() => {
    try { const c = new URLSearchParams(window.location.search).get('room'); if (c) pendingRoom.current = c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); } catch { /* no URL */ }
  }, []);
  useEffect(() => {
    const code = pendingRoom.current;
    if (!code || code.length !== 5 || !onlineAvailable || !authReady) return;
    if (!user) { go('online'); return; }
    pendingRoom.current = null;
    try { const u = new URL(window.location.href); u.searchParams.delete('room'); window.history.replaceState(null, '', u.toString()); } catch { /* ignore */ }
    apiCall({ action: 'join', code }).then((r) => go('room', { code: r.code })).catch((e) => { setToast({ text: e.message }); setTimeout(() => setToast(null), 3500); home(); });
  }, [authReady, user]); // eslint-disable-line react-hooks/exhaustive-deps
  const leaveGame = async () => { if (await confirm(t.leaveConfirm)) home(); };

  const myPhoto = usePhoto();
  const me = { name: profile?.displayName || t.you, hero: profile?.avatar || 'lion', gender: settings.gender, photo: myPhoto };
  const uid = user?.uid;

  const gname = t[`${game}Name`];
  const titles = { modes: gname, game: gname, ai: gname, pass: gname, online: gname, leaders: t.leaderboard, rules: t.rules, profile: t.profile, progress: t.progress, settings: t.settings };
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
    case 'home': body = <Home t={t} go={go} onlineOn={onlineAvailable} user={user} profile={profile} game={game} onPickGame={(g) => { pickGame(g); if (isPlayable(g)) go('modes'); }} />; break;
    case 'modes': body = <ModesScreen t={t} lang={lang} game={game} go={go} onlineOn={onlineAvailable} />; break;
    case 'ai': case 'pass': body = <Setup t={t} mode={view.name} game={game} onStart={(o) => go('game', { mode: view.name, game, ...o })} />; break;
    case 'game': {
      const P = { t, mode: view.mode, level: view.level, ruleset: view.ruleset, opts: view.opts || {}, me, onExit: home, onLeave: leaveGame };
      body = view.game === 'checkers' ? <CheckersLocal {...P} />
        : view.game === 'dominoes' ? <DominoesLocal {...P} target={view.target} />
        : view.game === 'bingo' ? <BingoGame {...P} />
        : view.game === 'ludo' ? <LudoGame {...P} />
        : <LocalGame {...P} />;
      break;
    }
    case 'settings': body = <SettingsScreen t={t} lang={lang} heroId={profile?.avatar} onLang={chooseLang} music={music} onMusic={setMusicTo} muted={muted} onMute={(m) => { setMutedState(m); setMuted(m); write('gebeta.muted', m ? '1' : '0'); }} settings={settings} onSettings={changeSettings} />; break;
    case 'progress': body = <ProgressScreen t={t} lang={lang} />; break;
    case 'rules': body = <RulesScreen t={t} game={game} />; break;
    case 'leaders': body = !onlineAvailable ? <Unavailable t={t} /> : !user ? (authReady ? <AuthForm t={t} /> : null) : <Leaders t={t} uid={uid} game={game} />; break;
    case 'profile': body = !onlineAvailable ? <Unavailable t={t} /> : authReady ? <ProfileScreen t={t} lang={lang} user={user} profile={profile} onSignOut={() => signOut(auth)} /> : null; break;
    case 'online': body = !onlineAvailable ? <Unavailable t={t} /> : !authReady ? null : !user ? <AuthForm t={t} /> : <Lobby t={t} lang={lang} game={game} beforeStart={() => runAd('pre_game', { game })} onSpin={() => setSheet({ type: 'spin' })} onEnter={(code) => go('room', { code })} />; break;
    case 'room': body = <OnlineRoom key={view.code} t={t} lang={lang} uid={uid} code={view.code} onExit={home} onSwitchRoom={(code) => go('room', { code })} confirm={confirm} />; break;
    default: body = null;
  }

  return (
    <div className={`app${inGame ? '' : ' has-nav'}`}>
      {offline && <div className="offline-bar" role="status">{t.offline}</div>}
      <Tibeb />
      {!inGame && (
        <BottomNav lang={lang} view={view.name} profile={profile} onHome={home}
          onOpen={(to) => {
            if (to === 'leaders' && GAMES[game]?.offlineOnly) { const g = GAME_LIST_ONLINE[0]; if (g) pickGame(g); }
            go(to);
          }} />
      )}
      {adShow && <AdOverlay ad={adShow.ad} lang={lang} placement={adShow.placement} seconds={adShow.ad.durationSec} onShown={(a) => Ads.shown(adShow.placement, a)} onClick={(a) => Ads.clicked(a)} onClose={(_done, reason) => { adShow.resolve(reason); setAdShow(null); }} />}
      {onlineAvailable && (view.name === 'home' || view.name === 'modes') && !adShow && <EarnOffer lang={lang} context="open" variant="banner" active={splashDone && !sheet} onSpin={() => setSheet({ type: 'spin' })} />}
      {sheet?.type === 'gift' && <WelcomeGift lang={lang} onClose={() => setSheet(null)} />}
      {sheet?.type === 'spin' && <SpinSheet lang={lang} onClose={() => setSheet(null)} />}
      <header className="topbar">
        {view.name === 'home' ? <span className="topbar-spacer" /> :
          <button className="icon-btn" onClick={view.name === 'game' ? leaveGame : ['ai', 'pass', 'online', 'leaders', 'rules'].includes(view.name) ? () => go('modes') : home} aria-label={t.backHome}>‹</button>}
        <h2 className="topbar-title">{view.name === 'home' || view.name === 'modes' ? '' : titles[view.name] || (view.name === 'room' ? `# ${view.code}` : 'ገበጣ')}</h2>
        <div className="topbar-actions">
          {onlineAvailable && <RewardedAdButton lang={lang} signedIn={!!user} onNeedSignIn={() => go('online')} />}
          {onlineAvailable && <WalletChip lang={lang} signedIn={!!user} onOpen={() => (user ? setSheet({ type: 'spin' }) : go('online'))} />}
          <div className="lang-switch" role="group" aria-label={t.language}>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => chooseLang('en')} aria-pressed={lang === 'en'} lang="en" title="English">EN</button>
            <button className={lang === 'am' ? 'on' : ''} onClick={() => chooseLang('am')} aria-pressed={lang === 'am'} lang="am" title="አማርኛ">አማ</button>
          </div>
          <button className="lang-chip" onClick={() => chooseLang(lang === 'en' ? 'am' : 'en')} lang={lang === 'en' ? 'am' : 'en'} aria-label={t.language}>{lang === 'en' ? 'አማ' : 'EN'}</button>
          {inGame && <button className="icon-btn" onClick={toggleFs} aria-label="Full screen" aria-pressed={isFs}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{isFs ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}</svg></button>}
          <button className="icon-btn" onClick={() => go('settings')} aria-label={t.settings}>⚙️</button>
          <button className="icon-btn" onClick={toggleMute} aria-label={t.sound} aria-pressed={!muted}>{muted ? '🔇' : '🔊'}</button>
        </div>
      </header>
      <main className={`screen${inGame ? ' ingame' : ''}`}>{body}</main>
      {coach && view.name === 'game' && <Coach t={t} game={coach} onClose={() => setCoach(null)} />}
      {toast && <div className="toast" role="status">{toast.text ? `⚠️ ${toast.text}` : `${toast.icon} ${t.unlocked} ${toast[lang] || toast.en}`}</div>}
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
