'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  collection, query, orderBy, limit, getDocs, doc, updateDoc, getDoc,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInAnonymously, updateProfile,
} from 'firebase/auth';
import { auth, db, googleProvider, apiCall } from '@/lib/firebase';
import { newGame, playMove, PITS } from '@/lib/gebeta/engine.js';
import { chooseMove } from '@/lib/gebeta/ai.js';
import { newGame as ckNew, playMove as ckPlay, legalMoves as ckLegal } from '@/lib/checkers/engine.js';
import { chooseCheckersMove } from '@/lib/checkers/ai.js';
import { HEROES, heroById } from '@/lib/i18n';
import { GAME_LIST, GAMES, gameInfo, statFields } from '@/lib/games.js';
import { GameIcon } from './GameIcons';
import CheckersBoard from './checkers/CheckersBoard';
import { useCheckersAnimator } from './checkers/useCheckersAnimator';
import { Tile } from './dominoes/Tile';
import { sfx } from '@/lib/sound';
import Board from './Board';
import { useAnimator } from './useAnimator';

export const Tibeb = () => <div className="tibeb" aria-hidden="true" />;

/* ───────── Home ───────── */
function DemoBoard() {
  const [g, setG] = useState(() => newGame('gebeta'));
  const gRef = useRef(g);
  const anim = useAnimator(g.pits, { relay: '', captured: () => '', extra: '' });
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (anim.busy) return;
    const id = setTimeout(() => {
      let cur = gRef.current;
      if (cur.over) { cur = newGame('gebeta'); gRef.current = cur; setG(cur); anim.reset(cur.pits); return; }
      const m = chooseMove(cur, 'gebeta', 'easy');
      const r = playMove(cur, m, 'gebeta');
      gRef.current = r.state; setG(r.state);
      anim.enqueue({ steps: r.steps, final: r.state.pits });
    }, 900);
    return () => clearTimeout(id);
  }, [anim.busy]); // eslint-disable-line
  return (
    <div className="demo" aria-hidden="true">
      <Board pits={anim.pits} viewSeat={0} isLegal={() => false} onPit={() => {}} active={anim.active} />
    </div>
  );
}

function CheckersDemo() {
  const [g, setG] = useState(() => ckNew('american'));
  const gRef = useRef(g);
  const anim = useCheckersAnimator(g.board, { kinged: '', jumped: () => '' });
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (anim.busy) return undefined;
    const id = setTimeout(() => {
      let cur = gRef.current;
      if (cur.over) { cur = ckNew('american'); gRef.current = cur; setG(cur); anim.reset(cur.board); return; }
      const m = chooseCheckersMove(cur, 'american', 'easy');
      if (!m) return;
      const r = ckPlay(cur, m.from, m.path, 'american');
      gRef.current = r.state; setG(r.state);
      anim.enqueue({ hops: r.hops, final: r.state.board, promote: r.promoted });
    }, 1000);
    return () => clearTimeout(id);
  }, [anim.busy]); // eslint-disable-line
  return <div className="demo ckdemo" aria-hidden="true"><CheckersBoard pieces={anim.pieces} viewSeat={0} last={anim.last} /></div>;
}

function DominoDemo() {
  const tiles = [[3, 5], [5, 5], [5, 1], [1, 6], [6, 2]];
  return (
    <div className="demo domdemo" aria-hidden="true" style={{ '--u': '30px' }}>
      <div className="dline-row">
        {tiles.map(([a, b], i) => <Tile key={i} a={a} b={b} vertical={a === b} className="placed demo-t" style={{ animationDelay: `${i * 0.35}s` }} />)}
      </div>
      <div className="dhand demo-hand">
        {[[0, 4], [2, 6], [3, 3], [1, 2], [4, 5]].map(([a, b]) => <Tile key={`${a}${b}`} a={a} b={b} vertical className="hand ok" />)}
      </div>
    </div>
  );
}

export function GamePicker({ t, game, onPick }) {
  return (
    <div className="gamepick" role="tablist" aria-label={t.pickGame}>
      {GAME_LIST.map((id) => (
        <button key={id} role="tab" aria-selected={game === id} className={`gp${game === id ? ' on' : ''}`} onClick={() => onPick(id)} style={{ '--accent': GAMES[id].accent }}>
          <GameIcon game={id} size={40} />
          <b>{t[`${id}Name`]}</b>
          <small>{t[`${id}Tag`]}</small>
        </button>
      ))}
    </div>
  );
}

export function Home({ t, go, onlineOn, user, profile, game, onPickGame }) {
  const hero = heroById(profile?.avatar);
  return (
    <div className="home">
      <div className="brand">
        <h1 className="brand-am">ገበጣ</h1>
        <p className="brand-en">Gebeta · {t.subtitle}</p>
      </div>
      <GamePicker t={t} game={game} onPick={onPickGame} />
      {game === 'gebeta' && <DemoBoard />}
      {game === 'checkers' && <CheckersDemo />}
      {game === 'dominoes' && <DominoDemo />}
      <nav className="menu" aria-label="Menu">
        <button className="menu-item primary" onClick={() => go('online')}>
          <span className="mi-title">{t.playFriendOnline}</span><span className="mi-sub">{t.playFriendOnlineSub}</span>
        </button>
        <button className="menu-item" onClick={() => go('ai')}>
          <span className="mi-title">{t.playComputer}</span><span className="mi-sub">{t.playComputerSub}</span>
        </button>
        <button className="menu-item" onClick={() => go('pass')}>
          <span className="mi-title">{t.passPlay}</span><span className="mi-sub">{t.passPlaySub}</span>
        </button>
      </nav>
      <div className="menu-row">
        <button className="btn" onClick={() => go('leaders')}>{t.leaderboard}</button>
        <button className="btn" onClick={() => go('rules')}>{t.rules}</button>
        <button className="btn" onClick={() => go('profile')}>
          {user ? <><span className="mini-hero" style={{ background: hero.color }}>{hero.glyph}</span> {profile?.displayName || t.profile}</> : t.profile}
        </button>
      </div>
    </div>
  );
}

/* ───────── Setup (computer / pass) ───────── */
export function Setup({ t, mode, game, onStart }) {
  const info = gameInfo(game);
  const [level, setLevel] = useState('medium');
  const [ruleset, setRuleset] = useState(info.defaultRuleset);
  const [target, setTarget] = useState(info.defaultTarget);
  return (
    <div className="panel">
      {mode === 'ai' && (
        <fieldset className="seg-group">
          <legend>{t.playComputer}</legend>
          <div className="seg">
            {['easy', 'medium', 'hard'].map((l) => (
              <button key={l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)} aria-pressed={level === l}>{t[l]}</button>
            ))}
          </div>
        </fieldset>
      )}
      <RulesetPicker t={t} game={game} value={ruleset} onChange={setRuleset} />
      {game === 'dominoes' && <TargetPicker t={t} value={target} onChange={setTarget} />}
      {game === 'checkers' && <p className="muted small">{t.ckFirst}</p>}
      <button className="btn primary wide" onClick={() => onStart({ level, ruleset, target })}>{mode === 'ai' ? t.playComputer : t.passPlay}</button>
    </div>
  );
}

export function RulesetPicker({ t, game, value, onChange }) {
  return (
    <fieldset className="seg-group">
      <legend>{t.ruleset}</legend>
      <div className="cards2">
        {gameInfo(game).rulesets.map((id) => {
          const [name, sub] = t.rs[game][id];
          return (
            <button key={id} className={`opt${value === id ? ' on' : ''}`} onClick={() => onChange(id)} aria-pressed={value === id}>
              <b>{name}</b><span>{sub}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
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
export function RulesScreen({ t, game }) {
  const title = game === 'checkers' ? t.rulesTitleCheckers : game === 'dominoes' ? t.rulesTitleDominoes : t.rulesTitle;
  return (
    <div className="panel rules">
      <h2>{title}</h2>
      <ol>
        {t[`rules_${game}`].map(([head, body]) => (
          <li key={head}><b>{head}</b><p>{body}</p></li>
        ))}
      </ol>
    </div>
  );
}

/* ───────── Auth ───────── */
const friendly = (e) => {
  const c = e?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Wrong email or password.';
  if (c.includes('email-already-in-use')) return 'That email already has an account — sign in instead.';
  if (c.includes('weak-password')) return 'Password needs at least 6 characters.';
  if (c.includes('invalid-email')) return 'Enter a valid email address.';
  if (c.includes('popup-closed')) return '';
  if (c.includes('operation-not-allowed')) return 'This sign-in method is not enabled in Firebase yet.';
  return e?.message || 'Something went wrong.';
};

export function AuthForm({ t }) {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const run = async (fn) => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(friendly(e)); } setBusy(false); };
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'in') await signInWithEmailAndPassword(auth, email.trim(), pw);
      else {
        const n = name.trim();
        if (n.length < 2 || n.length > 20) throw new Error('Display name must be 2–20 characters.');
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
        await updateProfile(cred.user, { displayName: n });
      }
    });
  };
  return (
    <div className="panel auth">
      <p className="muted">{t.onlineNeedsSignIn}</p>
      <button className="btn wide" onClick={() => run(() => signInWithPopup(auth, googleProvider))} disabled={busy}>{t.google}</button>
      <form onSubmit={submit} className="form">
        {mode === 'up' && <label>{t.name}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="nickname" required /></label>}
        <label>{t.email}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>{t.password}<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary wide" disabled={busy}>{mode === 'in' ? t.signIn : t.signUp}</button>
      </form>
      <button className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>{mode === 'in' ? t.noAccount : t.haveAccount}</button>
      <button className="btn ghost wide" onClick={() => run(() => signInAnonymously(auth))} disabled={busy}>{t.guest}</button>
    </div>
  );
}

/* ───────── Online lobby ───────── */
export function Lobby({ t, game, onEnter }) {
  const info = gameInfo(game);
  const [ruleset, setRuleset] = useState(info.defaultRuleset);
  const [target, setTarget] = useState(info.defaultTarget);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [saved, setSaved] = useState(null);
  useEffect(() => { try { setSaved(localStorage.getItem('gebeta.room')); } catch {} }, []);
  const call = async (body) => {
    setBusy(true); setErr('');
    try { const r = await apiCall({ game, ruleset, options: game === 'dominoes' ? { target } : {}, ...body }); onEnter(r.code); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div className="panel">
      {saved && <button className="btn primary wide" onClick={() => onEnter(saved)}>{`↺ ${saved}`}</button>}
      <RulesetPicker t={t} game={game} value={ruleset} onChange={setRuleset} />
      {game === 'dominoes' && <TargetPicker t={t} value={target} onChange={setTarget} />}
      <button className="menu-item primary" disabled={busy} onClick={() => call({ action: 'quick' })}>
        <span className="mi-title">{t.quickMatch}</span><span className="mi-sub">{t.quickMatchSub}</span>
      </button>
      <button className="menu-item" disabled={busy} onClick={() => call({ action: 'create' })}>
        <span className="mi-title">{t.createRoom}</span>
      </button>
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
export function ProfileScreen({ t, lang, user, profile, onSignOut }) {
  const [name, setName] = useState(profile?.displayName || '');
  const [avatar, setAvatar] = useState(profile?.avatar || 'lion');
  const [saved, setSaved] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (profile) { setName(profile.displayName); setAvatar(profile.avatar); } }, [profile?.displayName, profile?.avatar]); // eslint-disable-line
  if (!user) return <AuthForm t={t} />;
  const save = async () => {
    setErr('');
    const n = name.trim();
    if (n.length < 2 || n.length > 20) { setErr('Display name must be 2–20 characters.'); return; }
    try { await updateDoc(doc(db, 'users', user.uid), { displayName: n, avatar, lang }); setSaved(true); setTimeout(() => setSaved(false), 1500); }
    catch (e) { setErr(e.message); }
  };
  return (
    <div className="panel">
      {GAME_LIST.map((g) => {
        const f = statFields(g);
        return (
          <div key={g} className="stats-game">
            <span className="sg-name"><GameIcon game={g} size={26} /> {t[`${g}Name`]}</span>
            <div className="stats">
              <div><b>{profile?.[f.rating] ?? 1000}</b><span>{t.rating}</span></div>
              <div><b>{profile?.[f.wins] ?? 0}</b><span>{t.gamesWon}</span></div>
              <div><b>{profile?.[f.losses] ?? 0}</b><span>{t.gamesLost}</span></div>
              <div><b>{profile?.[f.draws] ?? 0}</b><span>{t.gamesDrawn}</span></div>
            </div>
          </div>
        );
      })}
      <fieldset className="seg-group">
        <legend>{t.avatar}</legend>
        <div className="heroes">
          {HEROES.map((h) => (
            <button key={h.id} className={`hero-pick${avatar === h.id ? ' on' : ''}`} onClick={() => setAvatar(h.id)} aria-pressed={avatar === h.id} title={h.name[lang] || h.name.en}>
              <span className="hero big" style={{ background: h.color }}>{h.glyph}</span>
              <small>{h.name[lang] || h.name.en}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="form-label">{t.name}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary wide" onClick={save}>{saved ? '✓' : t.save}</button>
      <button className="btn ghost wide" onClick={onSignOut}>{t.signOut}</button>
    </div>
  );
}
