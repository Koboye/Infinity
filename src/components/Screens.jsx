'use client';
import { orderGames } from '@/lib/recent.js';
import React, { useEffect, useState } from 'react';
import AppActions from './AppActions';
import {
  collection, query, orderBy, limit, getDocs, doc, updateDoc, getDoc,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, updateProfile, sendEmailVerification, sendPasswordResetEmail,
  reauthenticateWithCredential, reauthenticateWithPopup, EmailAuthProvider, signOut as fbSignOut,
} from 'firebase/auth';
import { usernameProblem, normalizeUsername, USERNAME_TEXT } from '@/lib/username';
import { auth, db, googleProvider, apiCall } from '@/lib/firebase';
import SwipePicker from '@/components/SwipePicker';
import { HEROES, heroById } from '@/lib/i18n';
import { GAME_LIST, GAMES, gameInfo, statFields, isPlayable } from '@/lib/games.js';
import { GameIcon } from './GameIcons';
import { sfx } from '@/lib/sound';
import { load as loadProgress, ACHIEVEMENTS, dailyGame, dailyDone, total as totalOf } from '@/lib/progress';
import { FeePicker } from './Wallet';
import EarnOffer from './EarnOffer';
import PhotoPicker from './PhotoPicker';
import GebetaRules from './GebetaRules';
import { GEBETA_TYPES } from '@/lib/gebetaRules';
import { storePhoto } from '@/lib/photo';
import { KINDS, STONE_SETS, stoneSet, stoneVars } from '@/lib/stones';

export const Tibeb = () => <div className="tibeb" aria-hidden="true" />;

/* ───────── Home ───────── */
/** Every game as a card. Numbers come from this device's real progress record; nothing is invented. */
export function GameGrid({ t, onPick, onClimb }) {
  const [p, setP] = useState(null);
  const [recent, setRecent] = useState([]);
  useEffect(() => { setP(loadProgress()); try { setRecent(JSON.parse(localStorage.getItem('gebeta.recent')) || []); } catch { /* no history yet */ } }, []);
  const order = orderGames(GAME_LIST, recent, (id) => !!GAMES[id].comingSoon);
  return (
    <div className="game-grid" role="list" aria-label={t.pickGame}>
      {order.map((id, i) => {
        const g = GAMES[id], soon = !!g.comingSoon;
        const r = p?.rec?.[id] || { w: 0, l: 0, d: 0 };
        const n = r.w + r.l + r.d;
        return (
          <button key={id} type="button" role="listitem" className={`gg-card${soon ? ' soon' : ''}${!soon && i === 0 && recent.length ? ' recent' : ''}`} disabled={soon} onClick={() => onPick(id)} style={{ '--accent': g.accent, '--i': i }}>
            <span className="gg-art"><GameIcon game={id} size={52} /></span>
            <b className="gg-name">{t[`${id}Name`]}</b>
            <small className="gg-tag">{soon ? t.comingSoon : t[`${id}Tag`]}</small>
            {!soon && i === 0 && recent.length > 0 && <em className="gg-last">{t.lastPlayed}</em>}
            {!soon && (
              <span className="gg-foot">
                <span className={`gg-mode${g.offlineOnly ? '' : ' on'}`}>{g.offlineOnly ? t.badgeOffline : t.homeBoth}</span>
                <span className="gg-rec">{p == null ? '' : n === 0 ? t.homeFresh : t.homeRecord(r.w, r.l, r.d)}</span>
              </span>
            )}
          </button>
        );
      })}
      {/* Hill Climb Racer: the full game (worlds, vehicles, drivers, difficulty) is a stand-alone arcade page (/games/hillclimb-racing/), so it is a link card and not part of GAME_LIST (no ratings, no online matches). */}
      <button type="button" role="listitem" className="gg-card" onClick={onClimb} aria-label={`${t.climbName} · ${t.climbTag}`} style={{ '--accent': '#FF7A2F', '--i': order.length }}>
        <span className="gg-art"><GameIcon game="car" size={52} /></span>
        <b className="gg-name">{t.climbName}</b>
        <small className="gg-tag">{t.climbTag}</small>
        <span className="gg-foot"><span className="gg-mode">{t.badgeOffline}</span></span>
      </button>
      {/* ExamPrep and Addis Runner are separate apps of this repo. Addis Runner is served as a static page from /games/addis-runner/; ExamPrep is its own Next.js + Firebase deploy, so its card opens NEXT_PUBLIC_EXAMPREP_URL (and shows "coming soon" until that address is set). */}
      <button type="button" role="listitem" className="gg-card" onClick={() => { globalThis.location.href = '/games/addis-runner/index.html'; }} aria-label={`${t.runnerName} · ${t.runnerTag}`} style={{ '--accent': '#1FAF6B', '--i': order.length + 1 }}>
        <span className="gg-art"><GameIcon game="runner" size={52} /></span>
        <b className="gg-name">{t.runnerName}</b>
        <small className="gg-tag">{t.runnerTag}</small>
        <span className="gg-foot"><span className="gg-mode">{t.badgeOffline}</span></span>
      </button>
      <button type="button" role="listitem" className="gg-card" onClick={() => { globalThis.location.href = '/games/exam-prep/index.html'; }} aria-label={`${t.examName} · ${t.examTag}`} style={{ '--accent': '#5B3DF5', '--i': order.length + 2 }}>
        <span className="gg-art"><GameIcon game="exam" size={52} /></span>
        <b className="gg-name">{t.examName}</b>
        <small className="gg-tag">{t.examTag}</small>
        <span className="gg-foot"><span className="gg-mode">{t.badgeOffline}</span></span>
      </button>
    </div>
  );
}

/** Streak, wins and games played: straight from the on-device record. */
function StatStrip({ t }) {
  const [p, setP] = useState(null);
  useEffect(() => { setP(loadProgress()); }, []);
  if (!p) return null;
  const wins = totalOf(p, 'w'), games = wins + totalOf(p, 'l') + totalOf(p, 'd');
  return (
    <div className="stat-strip" aria-label={t.progress}>
      <div><b>🔥 {p.streak}</b><span>{t.streakDays(p.streak)}</span></div>
      <div><b>🏆 {wins}</b><span>{t.gamesWon}</span></div>
      <div><b>🎲 {games}</b><span>{t.games}</span></div>
    </div>
  );
}

function DailyCard({ t, onPick }) {
  const [st, setSt] = useState(null);
  useEffect(() => { setSt({ g: dailyGame(), done: dailyDone() }); }, []);
  if (!st) return null;
  return (
    <button className={`daily${st.done ? ' done' : ''}`} onClick={() => onPick(st.g)}>
      <GameIcon game={st.g} size={34} />
      <span><b>📅 {t.daily}</b><span>{st.done ? t.dailyDone : t.dailySub(t[`${st.g}Name`])}</span></span>
    </button>
  );
}

export function Home({ t, onPickGame, onClimb }) {
  return (
    <div className="home">
      <div className="brand">
        <img className="afro-logo" src="/afro-logo.svg" alt="" width={92} height={92} />
        <h1 className="brand-am">{t.appName}</h1>
        <p className="brand-en">{t.subtitle}</p>
      </div>
      <DailyCard t={t} onPick={onPickGame} />
      <GameGrid t={t} onPick={onPickGame} onClimb={onClimb} />
      <StatStrip t={t} />
    </div>
  );
}

/* ───────── Setup (computer / pass) ───────── */
export function Setup({ t, mode, game, onStart, initialRuleset, onHelp }) {
  const info = gameInfo(game);
  const [level, setLevel] = useState('medium');
  const [ruleset, setRuleset] = useState(info.rulesets.includes(initialRuleset) ? initialRuleset : info.defaultRuleset);
  const [target, setTarget] = useState(info.defaultTarget);
  const [numCards, setNumCards] = useState(1);      // Bingo: 1-4 cards
  return (
    <div className="panel">
      {mode === 'ai' && (
        <SwipePicker
          label={t.levelTitle} prevLabel={t.swipePrev} nextLabel={t.swipeNext}
          value={level} onChange={setLevel}
          items={LEVELS.map((l) => ({ id: l.id, title: t[l.id], sub: t.levelSub[l.id], pips: l.pips, tone: l.tone }))}
        />
      )}
      <RulesetPicker t={t} game={game} value={ruleset} onChange={setRuleset} onHelp={onHelp} />
      {game === 'dominoes' && <TargetPicker t={t} value={target} onChange={setTarget} />}
      {game === 'checkers' && <p className="muted small">{t.ckFirst}</p>}
      {game === 'bingo' && (
        <fieldset className="seg-group">
          <legend>{t.cardsLabel}</legend>
          <div className="seg">
            {[1, 2, 3, 4].map((n) => <button key={n} className={numCards === n ? 'on' : ''} onClick={() => setNumCards(n)} aria-pressed={numCards === n}>{n}</button>)}
          </div>
        </fieldset>
      )}
      <button className="btn primary wide start-cta" onClick={() => onStart({ level, ruleset, target, opts: { ultra: false, suddenDeath: false, careless: false, cards: numCards } })}>{mode === 'ai' ? t.playComputer : t.passPlay}</button>
    </div>
  );
}

const TONES = ['#FFB020', '#35E0C2', '#FF5C8A', '#8A78FF', '#7BE06B', '#FF8A4C'];
const LEVELS = [{ id: 'easy', pips: 1, tone: '#7BE06B' }, { id: 'medium', pips: 2, tone: '#FFB020' }, { id: 'hard', pips: 3, tone: '#FF5C8A' }];

export function RulesetPicker({ t, game, value, onChange, onHelp }) {
  if (gameInfo(game).rulesets.length < 2) return null; // only one way to play — nothing to choose
  return (
    <>
    <SwipePicker
      label={t.gameTypeTitle} prevLabel={t.swipePrev} nextLabel={t.swipeNext}
      value={value} onChange={onChange}
      items={gameInfo(game).rulesets.map((id, k) => { const [name, sub] = t.rs[game][id]; return { id, title: name, sub: t.rsShort?.[game]?.[id] || sub, tone: TONES[k % TONES.length] }; })}
    />
    {game === 'gebeta' && onHelp && <button type="button" className="btn ghost wide rules-help" onClick={() => onHelp(value)}>📖 {t.rulesHelp}</button>}
    </>
  );
}

export function TargetPicker({ t, value, onChange }) {
  return (
    <fieldset className="seg-group">
      <legend>{t.target}</legend>
      <div className="seg">
        {GAMES.dominoes.targets.map((n) => (
          <button key={n} className={value === n ? 'on' : ''} onClick={() => onChange(n)} aria-pressed={value === n}>{t.playTo(n)}</button>
        ))}
      </div>
    </fieldset>
  );
}

/* ───────── Rules ───────── */
const rulesOf = (t, g) => (Array.isArray(t[`rules_${g}`]) ? t[`rules_${g}`] : []);
const ruleTitle = (t, g) => (g === 'checkers' ? t.rulesTitleCheckers : g === 'dominoes' ? t.rulesTitleDominoes : g === 'bingo' ? t.rulesTitleBingo : t.rulesTitle);

/** Rules tab. With no game chosen it is a hub: every game as a card (recent first), a search across all rules, and a tap opens that game's rules. */
export function RulesScreen({ t, lang, game, hub = false, onPickGame, onPlayGame, type, onPlay }) {
  const [q, setQ] = useState(''); const [recent, setRecent] = useState([]); const [openIds, setOpenIds] = useState(() => new Set([0]));
  useEffect(() => { try { setRecent(JSON.parse(localStorage.getItem('gebeta.recent')) || []); } catch { /* no history yet */ } }, []);
  const pick = (g) => { try { sfx?.tap?.(); } catch { /* sound is optional */ } onPickGame?.(g); };
  const L = lang === 'am' ? 'am' : 'en';

  if (hub) {
    const needle = q.trim().toLowerCase();
    const order = orderGames(GAME_LIST, recent, (id) => !!GAMES[id].comingSoon);
    const rows = order.map((id, i) => {
      const g = GAMES[id], soon = !!g.comingSoon, rules = rulesOf(t, id);
      const hit = needle ? rules.find(([h, b]) => `${h} ${b}`.toLowerCase().includes(needle)) : null;
      const nameHit = needle && `${t[`${id}Name`]} ${t[`${id}Tag`]}`.toLowerCase().includes(needle);
      return { id, g, soon, i, count: id === 'gebeta' ? GEBETA_TYPES.length : rules.length, hit, show: !needle || nameHit || !!hit };
    }).filter((r) => r.show);
    return (
      <div className="panel rules-hub">
        <header className="rh-head"><h2>{t.rulesHub}</h2><p className="muted">{t.rulesHubSub}</p></header>
        <input className="rh-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.rulesSearch} aria-label={t.rulesSearch} autoComplete="off" enterKeyHint="search" />
        <div className="rh-list" role="list">
          {rows.map((r) => (
            <button key={r.id} type="button" role="listitem" className={`rh-card${r.soon ? ' soon' : ''}`} disabled={r.soon} onClick={() => pick(r.id)} style={{ '--accent': r.g.accent, '--i': r.i }}>
              <span className="rh-art"><GameIcon game={r.id} size={56} /></span>
              <span className="rh-txt">
                <b>{t[`${r.id}Name`]}</b>
                <small>{r.soon ? t.comingSoon : t[`${r.id}Tag`]}</small>
                {r.hit && <em className="rh-hit">{t.rulesMatch}: {r.hit[0]}</em>}
              </span>
              <span className="rh-meta">{!r.soon && <span className="rh-chip">{r.id === 'gebeta' ? t.rulesTypes(r.count) : t.rulesCount(r.count)}</span>}{!r.soon && <i className="rh-go" aria-hidden="true" />}</span>
            </button>
          ))}
          {rows.length === 0 && <p className="muted rh-none" role="status">{t.rulesNone}</p>}
        </div>
      </div>
    );
  }

  const playable = GAME_LIST.filter((g) => isPlayable(g));
  const rules = rulesOf(t, game);
  const switcher = (
    <nav className="rh-switch" aria-label={t.rulesAllGames}>
      <button type="button" className="rh-chip back" onClick={() => onPickGame?.(null)}>‹ {t.rulesAllGames}</button>
      {playable.map((g) => <button key={g} type="button" className={`rh-chip${g === game ? ' on' : ''}`} aria-current={g === game ? 'true' : undefined} onClick={() => pick(g)}><GameIcon game={g} size={18} /> {t[`${g}Name`]}</button>)}
    </nav>
  );
  if (game === 'gebeta') return <div className="rules-wrap">{switcher}<GebetaRules t={t} lang={lang} type={type} onPlay={onPlay} /></div>;   // v73: the three Gebeta types, one rule at a time + ask box
  const allOpen = openIds.size >= rules.length;
  const toggle = (i, on) => setOpenIds((cur) => { const n = new Set(cur); if (on) n.add(i); else n.delete(i); return n; });
  return (
    <div className="rules-wrap">
      {switcher}
      <div className="panel rules" style={{ '--accent': GAMES[game]?.accent }}>
        <header className="rd-head"><span className="rd-art"><GameIcon game={game} size={60} /></span><span><h2>{ruleTitle(t, game)}</h2><small className="muted">{t[`${game}Tag`]} · {t.rulesCount(rules.length)}</small></span></header>
        <div className="rd-tools"><button type="button" className="link" onClick={() => setOpenIds(allOpen ? new Set() : new Set(rules.map((_, i) => i)))}>{allOpen ? t.rulesCloseAll : t.rulesOpenAll}</button></div>
        <ol className="rd-list">
          {rules.map(([head, body], i) => (
            <li key={head}>
              <details className="rd-item" open={openIds.has(i)} onToggle={(e) => toggle(i, e.currentTarget.open)}>
                <summary><span className="rd-n" aria-hidden="true">{i + 1}</span><b>{head}</b><i className="pg-chev" aria-hidden="true" /></summary>
                <p>{body}</p>
              </details>
            </li>
          ))}
        </ol>
        {isPlayable(game) && onPlayGame && <button type="button" className="btn primary wide rd-play" onClick={() => onPlayGame(game)}>▶ {t.rulesPlay}</button>}
      </div>
    </div>
  );
}

/* ───────── Auth ───────── */
const friendly = (e) => {
  const c = e?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Wrong email or password.';
  if (c.includes('email-already-in-use')) return 'That email already has an account — sign in instead.';
  if (c.includes('weak-password')) return 'Password needs at least 8 characters.';
  if (c.includes('invalid-email')) return 'Enter a valid email address.';
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return '';
  if (c.includes('popup-blocked')) return 'Your browser blocked the Google window. Allow pop-ups and try again.';
  if (c.includes('too-many-requests')) return 'Too many tries. Wait a few minutes, then try again.';
  if (c.includes('network-request-failed')) return 'No internet connection.';
  if (c.includes('requires-recent-login')) return 'Please sign in again first.';
  if (c.includes('operation-not-allowed')) return 'This sign-in method is not enabled in Firebase yet.';
  return e?.message || 'Something went wrong.';
};
const PENDING_KEY = 'afro.pendingSignup';
export const readPendingSignup = () => { try { const v = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } };
export const clearPendingSignup = () => { try { window.sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } };

/** Live "is this username free?" for a text field. Returns { state: 'idle'|'checking'|'ok'|'bad', message }. */
export function useUsernameCheck(raw, { skip = false, own = '' } = {}) {
  const [r, setR] = useState({ state: 'idle', message: '' });
  useEffect(() => {
    const name = normalizeUsername(raw);
    if (skip || !name) { setR({ state: 'idle', message: '' }); return undefined; }
    const bad = usernameProblem(name);
    if (bad) { setR({ state: 'bad', message: USERNAME_TEXT[bad] }); return undefined; }
    if (own && name === own) { setR({ state: 'ok', message: '✓ This is your username' }); return undefined; }
    setR({ state: 'checking', message: 'Checking…' });
    let dead = false;
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/account?u=${encodeURIComponent(name)}`, { cache: 'no-store' }); const d = await res.json();
        if (dead) return;
        if (!res.ok) setR({ state: 'idle', message: '' });
        else setR(d.ok ? { state: 'ok', message: `✓ @${name} is free` } : { state: 'bad', message: d.message || USERNAME_TEXT.taken });
      } catch { if (!dead) setR({ state: 'idle', message: '' }); }
    }, 400);
    return () => { dead = true; clearTimeout(id); };
  }, [raw, skip, own]);
  return r;
}

export function AuthForm({ t }) {
  const [mode, setMode] = useState('in');   // in | up | reset
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [name, setName] = useState(''); const [uname, setUname] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [info, setInfo] = useState('');
  const uc = useUsernameCheck(uname, { skip: mode !== 'up' });
  const run = async (fn) => { setBusy(true); setErr(''); setInfo(''); try { await fn(); } catch (e) { setErr(friendly(e)); } setBusy(false); };
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'reset') { await sendPasswordResetEmail(auth, email.trim()); setInfo('If that email has an account, a reset link is on its way. Check your inbox (and spam).'); return; }
      if (mode === 'in') { await signInWithEmailAndPassword(auth, email.trim(), pw); return; }
      const n = name.trim(); const u = normalizeUsername(uname);
      if (n.length < 2 || n.length > 20) throw new Error('Display name must be 2–20 characters.');
      const bad = usernameProblem(u); if (bad) throw new Error(USERNAME_TEXT[bad]);
      if (uc.state === 'bad') throw new Error(uc.message);
      if (pw.length < 8) throw new Error('Password needs at least 8 characters.');
      if (pw !== pw2) throw new Error('The two passwords are not the same.');
      try { window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ name: n, username: u })); } catch { /* ignore */ }
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      await updateProfile(cred.user, { displayName: n }).catch(() => {});
      sendEmailVerification(cred.user).catch(() => {});
    });
  };
  const google = () => run(() => signInWithPopup(auth, googleProvider));
  return (
    <div className="panel auth">
      <p className="muted">{mode === 'reset' ? 'Enter your email and we will send you a link to choose a new password.' : t.onlineNeedsSignIn}</p>
      {mode !== 'reset' && <button className="btn wide" onClick={google} disabled={busy}>{t.google}</button>}
      <form onSubmit={submit} className="form">
        {mode === 'up' && <>
          <label>Username<input value={uname} onChange={(e) => setUname(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={20} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false" required />
            <small className={`hint ${uc.state === 'ok' ? 'ok' : uc.state === 'bad' ? 'bad' : ''}`}>{uc.message || 'Unique. Letters, numbers, dot and underscore. Friends can find you by it.'}</small></label>
          <label>{t.name}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="nickname" required /></label>
        </>}
        <label>{t.email}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        {mode !== 'reset' && <label>{t.password}<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={mode === 'up' ? 8 : 6} required /></label>}
        {mode === 'up' && <label>Repeat password<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={8} required /></label>}
        {err && <p className="err" role="alert">{err}</p>}
        {info && <p className="hint ok" role="status">{info}</p>}
        <button className="btn primary wide" disabled={busy || (mode === 'up' && uc.state === 'bad')}>{mode === 'in' ? t.signIn : mode === 'up' ? t.signUp : 'Send reset link'}</button>
      </form>
      {mode === 'in' && <button className="link" onClick={() => { setMode('reset'); setErr(''); setInfo(''); }}>Forgot password?</button>}
      <button className="link" onClick={() => { setMode(mode === 'up' ? 'in' : mode === 'in' ? 'up' : 'in'); setErr(''); setInfo(''); }}>{mode === 'in' ? t.noAccount : mode === 'up' ? t.haveAccount : t.signIn}</button>
    </div>
  );
}

/* ───────── Online lobby ───────── */
export function Lobby({ t, lang, game, onEnter, onSpin, beforeStart, initialRuleset, onHelp, onFriends }) {
  const info = gameInfo(game);
  const [ruleset, setRuleset] = useState(info.rulesets.includes(initialRuleset) ? initialRuleset : info.defaultRuleset);
  const [target, setTarget] = useState(info.defaultTarget);
  const [code, setCode] = useState('');
  const [fee, setFee] = useState(50);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [saved, setSaved] = useState(null);
  useEffect(() => {
    let live = true;
    try {
      const c = localStorage.getItem('gebeta.room');
      if (!c) return undefined;
      getDoc(doc(db, 'gebetaRooms', c)).then((s) => {
        const st = s.exists() ? s.data().status : null;
        if (!live) return;
        if (st === 'playing' || st === 'waiting') setSaved(c); else localStorage.removeItem('gebeta.room'); // finished/deleted rooms are never offered again
      }).catch(() => live && setSaved(c));
    } catch { /* storage unavailable */ }
    return () => { live = false; };
  }, []);
  const call = async (body) => {
    setBusy(true); setErr('');
    try { await beforeStart?.(); const r = await apiCall({ game, ruleset, fee, options: game === 'dominoes' ? { target } : {}, ...body }); if (body.action === 'join' && r.own && r.status === 'waiting') setErr(t.ownRoom); else onEnter(r.code); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div className="panel">
      {saved && <button className="btn primary wide" onClick={() => onEnter(saved)}>{`↺ ${saved}`}</button>}
      <RulesetPicker t={t} game={game} value={ruleset} onChange={setRuleset} onHelp={onHelp} />
      {game === 'dominoes' && <TargetPicker t={t} value={target} onChange={setTarget} />}
      <FeePicker lang={lang} value={fee} onChange={setFee} onSpin={onSpin} />
      <EarnOffer lang={lang} context="lowcoins" variant="card" onSpin={onSpin} />
      <button className="menu-item primary" disabled={busy} onClick={() => call({ action: 'quick' })}>
        <span className="mi-title">{t.quickMatch}</span><span className="mi-sub">{t.quickMatchSub}</span>
      </button>
      <button className="menu-item" disabled={busy} onClick={() => call({ action: 'create' })}>
        <span className="mi-title">{t.createRoom}</span>
      </button>
      {onFriends && <button className="menu-item" disabled={busy} onClick={onFriends}>
        <span className="mi-title">👥 {t.inviteFromFriends}</span><span className="mi-sub">{t.friends}</span>
      </button>}
      <form className="joinrow" onSubmit={(e) => { e.preventDefault(); if (code.length === 5) call({ action: 'join', code }); }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
          placeholder={t.enterCode} aria-label={t.enterCode} autoCapitalize="characters" autoComplete="off" inputMode="text" />
        <button className="btn" disabled={busy || code.length !== 5}>{t.join}</button>
      </form>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}

/* ───────── Leaderboard ───────── */
export function Leaders({ t, uid, game }) {
  const [rows, setRows] = useState(null);
  const f = statFields(game);
  useEffect(() => {
    let live = true;
    setRows(null);
    getDocs(query(collection(db, 'users'), orderBy(f.rating, 'desc'), limit(25)))
      .then((s) => live && setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => (r[f.games] || 0) > 0)))
      .catch(() => live && setRows([]));
    return () => { live = false; };
  }, [f.rating, f.games]);
  if (!rows) return <div className="panel center"><div className="boot-seed" /></div>;
  if (!rows.length) return <div className="panel center"><p className="muted">{t.emptyBoard}</p></div>;
  return (
    <div className="panel">
      <div className="lb-head"><GameIcon game={game} size={34} /><b>{t[`${game}Name`]}</b></div>
      <ol className="leaders">
        {rows.map((r, i) => {
          const h = heroById(r.avatar);
          return (
            <li key={r.id} className={r.id === uid ? 'me' : ''}>
              <span className="rank">{i + 1}</span>
              <span className="hero" style={{ background: h.color }}>{h.glyph}</span>
              <span className="lname">{r.displayName}<small>{r[f.wins] || 0}W · {r[f.losses] || 0}L · {r[f.draws] || 0}D</small></span>
              <span className="lrating">{r[f.rating]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ───────── Profile ───────── */
function UsernameCard({ profile, user }) {
  const [val, setVal] = useState(profile?.username || ''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [editing, setEditing] = useState(!profile?.username);
  const uc = useUsernameCheck(val, { skip: !editing, own: profile?.username || '' });
  useEffect(() => { if (profile?.username) { setVal(profile.username); setEditing(false); } }, [profile?.username]);
  const save = async (e) => {
    e.preventDefault(); setMsg(''); setBusy(true);
    try { await apiCall({ action: 'usernameClaim', username: val }, { retries: 0 }); setEditing(false); setMsg('Saved'); setTimeout(() => setMsg(''), 1500); }
    catch (x) { setMsg(x.message); }
    setBusy(false);
  };
  if (!editing) return (
    <div className="acct-box"><h3>Username</h3><b>@{profile.username}</b> <button className="link" onClick={() => setEditing(true)}>Change</button>{msg && <small className="hint ok"> {msg}</small>}</div>
  );
  return (
    <form className="acct-box" onSubmit={save}>
      <h3>{profile?.username ? 'Change username' : 'Choose your username'}</h3>
      {!profile?.username && <p className="muted small">Every player needs a unique username. Friends use it to find you.</p>}
      <input value={val} onChange={(e) => setVal(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck="false" aria-label="Username" />
      <small className={`hint ${uc.state === 'ok' ? 'ok' : uc.state === 'bad' ? 'bad' : ''}`}>{uc.message}</small>
      {msg && <p className="err" role="alert">{msg}</p>}
      <button className="btn primary wide" disabled={busy || uc.state === 'bad' || uc.state === 'checking' || !val}>Save username</button>
      {profile?.username && <button type="button" className="link" onClick={() => { setEditing(false); setVal(profile.username); setMsg(''); }}>Cancel</button>}
    </form>
  );
}

function AccountSection({ user, onSignOut }) {
  const [open, setOpen] = useState(false); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [info, setInfo] = useState('');
  const hasPassword = user.providerData?.some((p) => p.providerId === 'password');
  const resetPw = async () => { setErr(''); setInfo(''); try { await sendPasswordResetEmail(auth, user.email); setInfo(`A link to change your password was sent to ${user.email}.`); } catch (e) { setErr(friendly(e)); } };
  const del = async () => {
    setErr(''); setBusy(true);
    try {
      if (hasPassword) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw));
      else await reauthenticateWithPopup(user, googleProvider);
      await apiCall({ action: 'accountDelete' }, { retries: 0 });
      try { storePhoto(null); } catch { /* ignore */ }
      await fbSignOut(auth).catch(() => {});
    } catch (e) { setErr(friendly(e)); setBusy(false); }
  };
  return (
    <>
      <div className="acct-box">
        <h3>Account</h3>
        <p className="muted small">{user.email || 'Signed in with Google'}</p>
        {hasPassword && <button className="btn wide" onClick={resetPw}>Change password (email me a link)</button>}
        {info && <p className="hint ok" role="status">{info}</p>}
        <button className="btn ghost wide" onClick={onSignOut}>Sign out</button>
      </div>
      <div className="acct-box">
        <h3>Delete account</h3>
        {!open ? <button className="btn danger wide" onClick={() => setOpen(true)}>Delete my account…</button> : (
          <>
            <p className="muted small">This permanently deletes your profile, username, coins, friends, chats and uploaded files. It cannot be undone.</p>
            {hasPassword && <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter your password to confirm" autoComplete="current-password" aria-label="Password" />}
            {err && <p className="err" role="alert">{err}</p>}
            <button className="btn danger wide" disabled={busy || (hasPassword && pw.length < 6)} onClick={del}>{busy ? 'Deleting…' : 'Yes, delete everything'}</button>
            <button className="link" onClick={() => { setOpen(false); setErr(''); setPw(''); }}>Keep my account</button>
          </>
        )}
      </div>
    </>
  );
}

/** One compact table for every game (replaces a stack of per-game tiles). rows: [{ g, rating?, w, l, d }] */
function StatTable({ t, rows, rating = false }) {
  return (
    <table className="st-table">
      <thead><tr><th scope="col" className="st-game"><span className="sr-only">{t.games}</span></th>{rating && <th scope="col">{t.rating}</th>}<th scope="col">{t.gamesWon}</th><th scope="col">{t.gamesLost}</th><th scope="col">{t.gamesDrawn}</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.g}>
            <th scope="row" className="st-game"><GameIcon game={r.g} size={24} /><span>{t[`${r.g}Name`]}</span></th>
            {rating && <td className="st-rate">{r.rating}</td>}
            <td className="st-w">{r.w}</td><td className="st-l">{r.l}</td><td>{r.d}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Native disclosure: keeps long sections one tap away instead of one long scroll. */
function Group({ title, hint, children, open = false }) {
  return (
    <details className="prof-group" open={open}>
      <summary><span className="pg-title">{title}</span>{hint && <small className="pg-hint">{hint}</small>}<i className="pg-chev" aria-hidden="true" /></summary>
      <div className="pg-body">{children}</div>
    </details>
  );
}

export function ProfileScreen({ t, lang, user, profile, onSignOut }) {
  const [name, setName] = useState(profile?.displayName || '');
  const [avatar, setAvatar] = useState(profile?.avatar || 'lion');
  const [saved, setSaved] = useState(false); const [err, setErr] = useState(''); const [sent, setSent] = useState(false);
  useEffect(() => { if (profile) { setName(profile.displayName); setAvatar(profile.avatar); } }, [profile?.displayName, profile?.avatar]); // eslint-disable-line
  if (!user) return <AuthForm t={t} />;
  const save = async () => {
    setErr('');
    const n = name.trim();
    if (n.length < 2 || n.length > 20) { setErr(t.nameErr); return; }
    try { await updateDoc(doc(db, 'users', user.uid), { displayName: n, avatar, lang }); setSaved(true); setTimeout(() => setSaved(false), 1500); }
    catch (e) { setErr(e.message); }
  };
  const needsVerify = !user.emailVerified && user.providerData?.some((p) => p.providerId === 'password');
  const hero = heroById(avatar); const ownPhoto = profile?.photo && /^data:image\/jpeg;base64,/.test(profile.photo) ? profile.photo : null;
  return (
    <div className="panel prof">
      {needsVerify && (
        <div className="verify-bar" role="status">
          ✉️ Please confirm your email ({user.email}).{' '}
          <button className="link" disabled={sent} onClick={() => { sendEmailVerification(user).then(() => setSent(true)).catch(() => {}); }}>{sent ? 'Link sent' : 'Send the link again'}</button>
        </div>
      )}
      <header className="prof-card">
        <span className="pc-face" style={ownPhoto ? undefined : { background: hero.color }}>{ownPhoto ? <img src={ownPhoto} alt="" /> : <span aria-hidden="true">{hero.glyph}</span>}</span>
        <span className="pc-txt"><b>{profile?.displayName || name || user.displayName || 'Player'}</b><small>{profile?.username ? `@${profile.username}` : (hero.name[lang] || hero.name.en)}</small></span>
      </header>
      <Group title={t.profEdit || 'Edit profile'} hint={profile?.username ? `@${profile.username}` : undefined} open>
        {profile && <UsernameCard profile={profile} user={user} />}
        <form className="prof-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="form-label">{t.name}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="nickname" autoCapitalize="words" enterKeyHint="done" aria-describedby="prof-hint" /><small id="prof-hint" className="muted">{t.nameHint}</small></label>
          {err && <p className="err" role="alert">{err}</p>}
          <button type="submit" className="btn primary wide" aria-live="polite">{saved ? `✓ ${t.savedOk}` : t.save}</button>
        </form>
      </Group>
      <Group title={t.setPhoto || 'Profile picture'} hint={ownPhoto ? '📷' : hero.glyph}>
        <PhotoPicker lang={lang} heroId={avatar} onChange={(url) => updateDoc(doc(db, 'users', user.uid), { photo: url || '' }).catch(() => {})} />
        <p className="muted small pg-or">{t.avatar}</p>
        <div className="heroes">
          {HEROES.map((h) => (
            <button type="button" key={h.id} className={`hero-pick${avatar === h.id ? ' on' : ''}`} onClick={() => setAvatar(h.id)} aria-pressed={avatar === h.id} title={h.name[lang] || h.name.en}>
              <span className="hero big" style={{ background: h.color }}>{h.glyph}</span>
              <small>{h.name[lang] || h.name.en}</small>
            </button>
          ))}
        </div>
        <button type="button" className="btn small wide" onClick={save}>{saved ? `✓ ${t.savedOk}` : t.save}</button>
      </Group>
      <Group title={t.progress} open>
        <StatTable t={t} rating rows={GAME_LIST.filter((g) => !GAMES[g].offlineOnly).map((g) => {
          const f = statFields(g);
          return { g, rating: profile?.[f.rating] ?? 1000, w: profile?.[f.wins] ?? 0, l: profile?.[f.losses] ?? 0, d: profile?.[f.draws] ?? 0 };
        })} />
      </Group>
      <Group title={t.profAccount || 'Account'} hint={user.email || undefined}><AccountSection user={user} onSignOut={onSignOut} /></Group>
    </div>
  );
}

/* ───────── Progress (on-device): streak, record, achievements, history ───────── */
export function ProgressScreen({ t, lang }) {
  const [p, setP] = useState(null); const [tab, setTab] = useState('stats');
  useEffect(() => { setP(loadProgress()); }, []);
  if (!p) return null;
  const tone = { w: t.youWin, l: t.youLose, d: t.draw };
  const earned = ACHIEVEMENTS.filter((a) => p.ach[a.id]).length;
  const tabs = [['stats', t.progress || 'Stats'], ['ach', `${t.achievements} ${earned}/${ACHIEVEMENTS.length}`], ['recent', t.recent]];
  const onKey = (e) => { // arrow keys move between tabs, as in any tablist
    const i = tabs.findIndex(([id]) => id === tab); const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { e.preventDefault(); setTab(tabs[(i + d + tabs.length) % tabs.length][0]); }
  };
  return (
    <div className="panel">
      <div className="prog-top">
        <div><b>🔥 {p.streak}</b><span>{t.streakDays(p.streak)}</span></div>
        <div><b>{p.best}</b><span>{t.bestStreak}</span></div>
      </div>
      <div className="seg prog-tabs" role="tablist" aria-label={t.progress || 'Progress'} onKeyDown={onKey}>
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" id={`pt-${id}`} aria-selected={tab === id} aria-controls="pt-panel" tabIndex={tab === id ? 0 : -1} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      <div id="pt-panel" role="tabpanel" aria-labelledby={`pt-${tab}`} className="pt-panel">
        {tab === 'stats' && <StatTable t={t} rows={GAME_LIST.map((g) => { const r = p.rec[g] || { w: 0, l: 0, d: 0 }; return { g, w: r.w, l: r.l, d: r.d }; })} />}
        {tab === 'ach' && (
          <div className="ach-grid">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.id} className={`ach${p.ach[a.id] ? ' on' : ''}`}><i>{a.icon}</i>{a[lang] || a.en}</div>
            ))}
          </div>
        )}
        {tab === 'recent' && (
          <div className="hist">
            {p.hist.length === 0 && <p className="muted">{t.noGames}</p>}
            {p.hist.slice(0, 10).map((h, i) => (
              <div key={i}><span>{t[`${h.g}Name`]}</span><span className={h.r}>{tone[h.r === 'win' ? 'w' : h.r === 'lose' ? 'l' : 'd']}</span><small className="muted">{new Date(h.at).toLocaleDateString(lang === 'am' ? 'am-ET' : undefined)}</small></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


/* Stone chooser: pick a set; each chip previews Player 1's and Player 2's stone. */
function StonePicker({ t, lang, value, onPick }) {
  const cur = stoneSet(value);
  const [kind, setKind] = useState(cur.kind);
  const sets = STONE_SETS.filter((s) => s.kind === kind);
  return (
    <div className="stonepick">
      <div className="set-row stonepick-h"><span>💎 {t.stones}</span></div>
      <p className="muted small">{t.stonesSub}</p>
      <div className="seg stone-kinds" role="tablist" aria-label={t.stones}>
        {KINDS.map((k) => <button key={k.id} role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'on' : ''} onClick={() => setKind(k.id)}>{lang === 'am' ? k.am : k.en}</button>)}
      </div>
      <div className="stone-grid">
        {sets.map((s) => (
          <button key={s.id} className={`stone-opt${value === s.id ? ' on' : ''}`} aria-pressed={value === s.id} onClick={() => { sfx.tap(); onPick(s.id); }}>
            <span className="stone-prev" data-stone={s.kind} style={stoneVars(s)}>
              <i className="seed a v0" /><i className="seed a v1" /><i className="seed b v2" /><i className="seed b v0" />
            </span>
            <span className="stone-name">{s.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────── Settings ───────── */
/** One settings line: label (and optional hint) on the left, control on the right; an optional slider sits underneath and greys out when its switch is off. */
function SetRow({ label, hint, children, slider, sliderOn = true }) {
  return (
    <div className="set-item">
      <div className="set-row"><span>{label}{hint && <small className="set-hint">{hint}</small>}</span>{children}</div>
      {slider && <div className={`set-slider${sliderOn ? '' : ' off'}`}>{slider}</div>}
    </div>
  );
}

export function SettingsScreen({ t, lang, heroId, onLang, music, onMusic, muted, onMute, settings, onSettings }) {
  const set = (k, v) => onSettings({ ...settings, [k]: v });
  const Seg = ({ value, opts, onPick, label }) => (
    <div className="seg" role="group" aria-label={label}>
      {opts.map(([v, text]) => <button type="button" key={String(v)} className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onPick(v)}>{text}</button>)}
    </div>
  );
  const onOff = (value, onPick, label) => <Seg label={label} value={value} onPick={onPick} opts={[[true, t.on], [false, t.off]]} />;
  const vol = (k, label) => <input type="range" min="0.1" max="1" step="0.05" value={settings[k]} aria-label={label} onChange={(e) => set(k, +e.target.value)} />;
  const voiceLabel = t.voice || 'Bingo caller voice';
  const state = (on) => (on ? t.on : t.off);
  return (
    <div className="panel set-page">
      <Group title={t.setSound || 'Sound & vibration'} hint={`🎵 ${state(music)} · 🔊 ${state(!muted)}`} open>
        <SetRow label={`🎵 ${t.music}`} slider={vol('music', `${t.music} ${t.volume}`)} sliderOn={music}>{onOff(music, onMusic, t.music)}</SetRow>
        <SetRow label={`🔊 ${t.sound}`} slider={vol('sfx', `${t.sound} ${t.volume}`)} sliderOn={!muted}>{onOff(!muted, (v) => onMute(!v), t.sound)}</SetRow>
        <SetRow label={`📳 ${t.vibration}`}>{onOff(!!settings.haptics, (v) => set('haptics', v), t.vibration)}</SetRow>
        <SetRow label={`🎙 ${voiceLabel}`}>{onOff(settings.voice !== false, (v) => set('voice', v), voiceLabel)}</SetRow>
      </Group>
      <Group title={t.setDisplay || 'Language & display'} hint={lang === 'am' ? t.langAm : t.langEn} open>
        <SetRow label={`🌐 ${t.language}`}><Seg label={t.language} value={lang} onPick={onLang} opts={[['en', t.langEn], ['am', t.langAm]]} /></SetRow>
        <SetRow label={`Aa ${t.textSize}`}><Seg label={t.textSize} value={settings.text} onPick={(v) => set('text', v)} opts={[['normal', t.textNormal], ['large', `${t.textNormal}+`], ['xlarge', `${t.textNormal}++`]]} /></SetRow>
        <SetRow label={`◐ ${t.contrast}`}>{onOff(!!settings.contrast, (v) => set('contrast', v), t.contrast)}</SetRow>
      </Group>
      <Group title={t.setGameplay || 'Gameplay'}>
        <SetRow label={`🐢 ${t.paceLabel}`}><Seg label={t.paceLabel} value={settings.pace === 'normal' ? 'normal' : 'slow'} onPick={(v) => set('pace', v)} opts={[['slow', t.paceSlow], ['normal', t.paceNormal]]} /></SetRow>
        <SetRow label={`✓ ${t.assist || 'Show ready fours'}`}>{onOff(!!settings.assist, (v) => set('assist', v), t.assist || 'Show ready fours')}</SetRow>
        <SetRow label={`🎭 ${t.genderLabel}`}><Seg label={t.genderLabel} value={settings.gender || 'auto'} onPick={(v) => set('gender', v)} opts={[['auto', t.genderAuto], ['m', t.genderMale], ['f', t.genderFemale]]} /></SetRow>
        <StonePicker t={t} lang={lang} value={settings.stones} onPick={(v) => set('stones', v)} />
      </Group>
      <Group title={t.setPhoto || 'Profile picture'}><PhotoPicker lang={lang} heroId={heroId} /></Group>
      <Group title={t.setApp || 'App'}><AppActions /></Group>
    </div>
  );
}
