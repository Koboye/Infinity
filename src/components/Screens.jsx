'use client';
import React, { useEffect, useRef, useState } from 'react';
import AppActions from './AppActions';
import {
  collection, query, orderBy, limit, getDocs, doc, updateDoc, getDoc,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInAnonymously, updateProfile,
} from 'firebase/auth';
import { auth, db, googleProvider, apiCall } from '@/lib/firebase';
import { newGame, playMove, collectAll } from '@/lib/gebeta/engine.js';
import { chooseMove } from '@/lib/gebeta/ai.js';
import SwipePicker from '@/components/SwipePicker';
import { newGame as ckNew, playMove as ckPlay, legalMoves as ckLegal } from '@/lib/checkers/engine.js';
import { chooseCheckersMove } from '@/lib/checkers/ai.js';
import { HEROES, heroById } from '@/lib/i18n';
import { GAME_LIST, GAMES, gameInfo, statFields } from '@/lib/games.js';
import { GameIcon } from './GameIcons';
import SwipeRail from './SwipeRail';
import CheckersBoard from './checkers/CheckersBoard';
import { useCheckersAnimator } from './checkers/useCheckersAnimator';
import { Tile } from './dominoes/Tile';
import { sfx } from '@/lib/sound';
import { load as loadProgress, ACHIEVEMENTS, dailyGame, dailyDone } from '@/lib/progress';
import Board from './Board';
import { useAnimator } from './useAnimator';
import { KINDS, STONE_SETS, stoneSet, stoneVars } from '@/lib/stones';

export const Tibeb = () => <div className="tibeb" aria-hidden="true" />;

/* ───────── Home ───────── */
function DemoBoard() {
  const [g, setG] = useState(() => newGame('gebeta'));
  const gRef = useRef(g);
  const anim = useAnimator(g.pits, { relay: '', captured: () => '', extra: '' }, 1, g.own, g.flag);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (anim.busy) return;
    const id = setTimeout(() => {
      let cur = gRef.current;
      if (cur.over) { cur = newGame('gebeta'); gRef.current = cur; setG(cur); anim.reset(cur.pits, cur.own, cur.flag); return; }
      const pre = collectAll(cur);
      const m = chooseMove(pre.state, 'gebeta', 'easy');
      const r = playMove(pre.state, m, 'gebeta');
      gRef.current = r.state; setG(r.state);
      anim.enqueue({ steps: [...pre.steps, ...r.steps], final: r.state.pits, own: r.state.own, flag: r.state.flag });
    }, 900);
    return () => clearTimeout(id);
  }, [anim.busy]); // eslint-disable-line
  return (
    <div className="demo" aria-hidden="true">
      <Board pits={anim.pits} own={anim.own} flag={anim.flag} viewSeat={0} isLegal={() => false} onPit={() => {}} active={anim.active} />
    </div>
  );
}

function CheckersDemo() {
  const [g, setG] = useState(() => ckNew('flying'));
  const gRef = useRef(g);
  const anim = useCheckersAnimator(g.board, { kinged: '', jumped: () => '' });
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (anim.busy) return undefined;
    const id = setTimeout(() => {
      let cur = gRef.current;
      if (cur.over) { cur = ckNew('flying'); gRef.current = cur; setG(cur); anim.reset(cur.board); return; }
      const m = chooseCheckersMove(cur, 'flying', 'easy');
      if (!m) return;
      const r = ckPlay(cur, m.from, m.path, 'flying');
      gRef.current = r.state; setG(r.state);
      anim.enqueue({ hops: r.hops, final: r.state.board, promote: r.promoted });
    }, 1000);
    return () => clearTimeout(id);
  }, [anim.busy]); // eslint-disable-line
  return <div className="demo ckdemo" aria-hidden="true"><CheckersBoard pieces={anim.pieces} viewSeat={0} last={anim.last} /></div>;
}

function BingoDemo() {
  const L = ['B', 'I', 'N', 'G', 'O'];
  return (
    <div className="demo bingodemo" aria-hidden="true">
      <div className="bdemo-grid">
        {L.map((c, i) => <span key={c} className={`bhead l${i}`}>{c}</span>)}
        {[7, 22, 38, 51, 64, 3, 19, 41, 58, 72, 12, 27, 0, 47, 66, 9, 30, 35, 55, 70, 14, 24, 44, 49, 75].map((n, i) => (
          <i key={i} className={`bcell mini${[0, 6, 12, 18, 24].includes(i) ? ' on' : ''}${i === 12 ? ' free' : ''}`}>{i === 12 ? '★' : n}</i>
        ))}
      </div>
    </div>
  );
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
  const idx = Math.max(0, GAME_LIST.indexOf(game));
  return (
    <SwipeRail className="rail-games" label={t.pickGame} items={GAME_LIST.map((id) => ({ id }))} value={idx} selectOnSwipe onSelect={(i) => onPick(GAME_LIST[i])}
      renderItem={({ id }, i, on) => (
        <button type="button" className={`gp gp-card${on ? ' on' : ''}${GAMES[id].comingSoon ? ' soon' : ''}`} onClick={() => onPick(id)} style={{ '--accent': GAMES[id].accent }}>
          <GameIcon game={id} size={44} />
          <b>{t[`${id}Name`]}</b>
          <small>{GAMES[id].comingSoon ? t.comingSoon : t[`${id}Tag`]}</small>
        </button>
      )} />
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

function ActionRail({ t, go, offlineOnly, noPass }) {
  const items = [
    ...(!offlineOnly ? [{ id: 'online', c: '#FF5C8A', icon: '🌍', title: t.playFriendOnline, sub: t.playFriendOnlineSub }] : []),
    { id: 'ai', c: '#F2B632', icon: '🤖', title: t.playComputer, sub: t.playComputerSub },
    ...(!noPass ? [{ id: 'pass', c: '#35E0C2', icon: '🤝', title: t.passPlay, sub: t.passPlaySub }] : []),
  ];
  const [cur, setCur] = useState(() => Math.max(0, items.findIndex((x) => x.id === 'ai')));
  return (
    <>
      <SwipeRail className="rail-actions" label="Play" items={items} value={cur} onSettle={setCur} onSelect={(i) => setCur(i)}
        renderItem={(it) => (
          <button type="button" className="act-card" style={{ '--c': it.c }} onClick={() => go(it.id)}>
            <span className="act-icon" aria-hidden="true">{it.icon}</span>
            <span className="act-txt"><b>{it.title}</b><small>{it.sub}</small></span>
            <span className="act-go" aria-hidden="true">›</span>
          </button>
        )} />
      {items.length > 1 && <p className="swipe-hint" aria-hidden="true">‹ {t.swipeHint} ›</p>}
    </>
  );
}

export function Home({ t, go, onlineOn, user, profile, game, onPickGame }) {
  const hero = heroById(profile?.avatar);
  const offlineOnly = !!gameInfo(game).offlineOnly;
  const soon = !!gameInfo(game).comingSoon;
  return (
    <div className="home">
      <div className="brand">
        <svg className="crest" viewBox="0 0 74 38" aria-hidden="true"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF0B8" /><stop offset=".55" stopColor="#E9B64A" /><stop offset="1" stopColor="#A9741A" /></linearGradient></defs><path d="M6 32 L10 12 L24 22 L37 5 L50 22 L64 12 L68 32 Z" fill="url(#cg)" stroke="#6d4a0c" strokeWidth="1.2" strokeLinejoin="round" /><rect x="6" y="32" width="62" height="5" rx="2" fill="url(#cg)" stroke="#6d4a0c" strokeWidth="1.2" /><circle cx="10" cy="11" r="3" fill="#d6193f" stroke="#6d4a0c" /><circle cx="37" cy="4.5" r="3.2" fill="#2559d6" stroke="#6d4a0c" /><circle cx="64" cy="11" r="3" fill="#d6193f" stroke="#6d4a0c" /></svg>
        <h1 className="brand-am">ገበጣ</h1>
        <p className="brand-en">{t.subtitle}</p>
      </div>
      <DailyCard t={t} onPick={onPickGame} />
      <GamePicker t={t} game={game} onPick={onPickGame} />
      {game === 'gebeta' && <DemoBoard />}
      {game === 'checkers' && <CheckersDemo />}
      {game === 'bingo' && <BingoDemo />}
      {soon && (
        <div className="coming-soon" role="status">
          <DominoDemo />
          <span className="cs-badge">{t.comingSoon}</span>
          <p>{t.comingSoonSub(t[`${game}Name`])}</p>
        </div>
      )}
      {!soon && <ActionRail t={t} go={go} offlineOnly={offlineOnly} noPass={!!gameInfo(game).noPass} />}
      <SwipeRail className="rail-dock" label="More" dots={false} itemClass="dock-item" value={-1}
        items={[{ id: 'progress' }, ...(!offlineOnly && !soon ? [{ id: 'leaders' }] : []), ...(!soon ? [{ id: 'rules' }] : []), { id: 'profile' }]}
        renderItem={({ id }) => (
          <button type="button" className={`dock-chip dc-${id}`} onClick={() => go(id)}>
            {id === 'progress' && <>🔥 {t.progress}</>}
            {id === 'leaders' && <>🏆 {t.leaderboard}</>}
            {id === 'rules' && <>📖 {t.rules}</>}
            {id === 'profile' && (user ? <><span className="mini-hero" style={{ background: hero.color }}>{hero.glyph}</span> {profile?.displayName || t.profile}</> : <>👤 {t.profile}</>)}
          </button>
        )} />
    </div>
  );
}

/* ───────── Setup (computer / pass) ───────── */
export function Setup({ t, mode, game, onStart }) {
  const info = gameInfo(game);
  const [level, setLevel] = useState('medium');
  const [ruleset, setRuleset] = useState(info.defaultRuleset);
  const [target, setTarget] = useState(info.defaultTarget);
  const [ultra, setUltra] = useState(false);        // Checkers: Ultra meter
  const [careless, setCareless] = useState(false);  // Checkers: the computer may overlook captures (you can claim the piece)
  const [sudden, setSudden] = useState(false);      // Checkers: Sudden Death after 5 minutes
  const [numCards, setNumCards] = useState(1);      // Bingo: 1-4 cards
  const [ludoPlayers, setLudoPlayers] = useState(4);  // Ludo: 2 / 3 (fair triangle) / 4
  return (
    <div className="panel">
      {mode === 'ai' && (
        <SwipePicker
          label={t.levelTitle} prevLabel={t.swipePrev} nextLabel={t.swipeNext}
          value={level} onChange={setLevel}
          items={LEVELS.map((l) => ({ id: l.id, title: t[l.id], sub: t.levelSub[l.id], pips: l.pips, tone: l.tone }))}
        />
      )}
      <RulesetPicker t={t} game={game} value={ruleset} onChange={setRuleset} />
      {game === 'dominoes' && <TargetPicker t={t} value={target} onChange={setTarget} />}
      {game === 'checkers' && <p className="muted small">{t.ckFirst}</p>}
      {game === 'checkers' && (
        <fieldset className="seg-group">
          <legend>{t.modesTitle}</legend>
          <label className="check"><input type="checkbox" checked={ultra} onChange={(e) => setUltra(e.target.checked)} /> {t.ultraMeter}</label>
          {mode === 'ai' && <label className="check"><input type="checkbox" checked={careless} onChange={(e) => setCareless(e.target.checked)} /> {t.careless}</label>}
          <label className="check"><input type="checkbox" checked={sudden} onChange={(e) => setSudden(e.target.checked)} /> {t.suddenDeath}</label>
        </fieldset>
      )}
      {game === 'ludo' && (
        <fieldset className="seg-group">
          <legend>{t.ludoPlayers}</legend>
          <div className="seg">
            {[2, 3, 4].map((n) => <button key={n} className={ludoPlayers === n ? 'on' : ''} onClick={() => setLudoPlayers(n)} aria-pressed={ludoPlayers === n}>{n}</button>)}
          </div>
          <p className="muted small">{ludoPlayers === 3 ? t.ludoTriangleNote : t.ludoSquareNote}</p>
        </fieldset>
      )}
      {game === 'bingo' && (
        <fieldset className="seg-group">
          <legend>{t.cardsLabel}</legend>
          <div className="seg">
            {[1, 2, 3, 4].map((n) => <button key={n} className={numCards === n ? 'on' : ''} onClick={() => setNumCards(n)} aria-pressed={numCards === n}>{n}</button>)}
          </div>
        </fieldset>
      )}
      <button className="btn primary wide start-cta" onClick={() => onStart({ level, ruleset, target, opts: { ultra, suddenDeath: sudden, careless, cards: numCards, players: ludoPlayers } })}>{mode === 'ai' ? t.playComputer : t.passPlay}</button>
    </div>
  );
}

const TONES = ['#FFB020', '#35E0C2', '#FF5C8A', '#8A78FF', '#7BE06B', '#FF8A4C'];
const LEVELS = [{ id: 'easy', pips: 1, tone: '#7BE06B' }, { id: 'medium', pips: 2, tone: '#FFB020' }, { id: 'hard', pips: 3, tone: '#FF5C8A' }];

export function RulesetPicker({ t, game, value, onChange }) {
  if (gameInfo(game).rulesets.length < 2) return null; // only one way to play — nothing to choose
  return (
    <SwipePicker
      label={t.gameTypeTitle} prevLabel={t.swipePrev} nextLabel={t.swipeNext}
      value={value} onChange={onChange}
      items={gameInfo(game).rulesets.map((id, k) => { const [name, sub] = t.rs[game][id]; return { id, title: name, sub: t.rsShort?.[game]?.[id] || sub, tone: TONES[k % TONES.length] }; })}
    />
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
  const title = game === 'checkers' ? t.rulesTitleCheckers : game === 'dominoes' ? t.rulesTitleDominoes : game === 'bingo' ? t.rulesTitleBingo : game === 'ludo' ? t.rulesTitleLudo : t.rulesTitle;
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
    try { const r = await apiCall({ game, ruleset, options: game === 'dominoes' ? { target } : {}, ...body }); if (body.action === 'join' && r.own && r.status === 'waiting') setErr(t.ownRoom); else onEnter(r.code); } catch (e) { setErr(e.message); }
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
    if (n.length < 2 || n.length > 20) { setErr(t.nameErr); return; }
    try { await updateDoc(doc(db, 'users', user.uid), { displayName: n, avatar, lang }); setSaved(true); setTimeout(() => setSaved(false), 1500); }
    catch (e) { setErr(e.message); }
  };
  return (
    <div className="panel">
      {GAME_LIST.filter((g) => !GAMES[g].offlineOnly).map((g) => {
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

/* ───────── Progress (on-device): streak, record, achievements, history ───────── */
export function ProgressScreen({ t, lang }) {
  const [p, setP] = useState(null);
  useEffect(() => { setP(loadProgress()); }, []);
  if (!p) return null;
  const tone = { w: t.youWin, l: t.youLose, d: t.draw };
  return (
    <div className="panel">
      <div className="prog-top">
        <div><b>🔥 {p.streak}</b><span>{t.streakDays(p.streak)}</span></div>
        <div><b>{p.best}</b><span>{t.bestStreak}</span></div>
      </div>
      {GAME_LIST.map((g) => {
        const r = p.rec[g] || { w: 0, l: 0, d: 0 };
        return (
          <div key={g} className="stats-game">
            <span className="sg-name"><GameIcon game={g} size={26} /> {t[`${g}Name`]}</span>
            <div className="stats">
              <div><b>{r.w}</b><span>{t.gamesWon}</span></div>
              <div><b>{r.l}</b><span>{t.gamesLost}</span></div>
              <div><b>{r.d}</b><span>{t.gamesDrawn}</span></div>
              <div><b>{r.w + r.l + r.d}</b><span>{t.games}</span></div>
            </div>
          </div>
        );
      })}
      <h3>{t.achievements}</h3>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={`ach${p.ach[a.id] ? ' on' : ''}`}><i>{a.icon}</i>{a[lang] || a.en}</div>
        ))}
      </div>
      <h3>{t.recent}</h3>
      <div className="hist">
        {p.hist.length === 0 && <p className="muted">{t.noGames}</p>}
        {p.hist.slice(0, 10).map((h, i) => (
          <div key={i}><span>{t[`${h.g}Name`]}</span><span className={h.r}>{tone[h.r === 'win' ? 'w' : h.r === 'lose' ? 'l' : 'd']}</span><small className="muted">{new Date(h.at).toLocaleDateString(lang === 'am' ? 'am-ET' : undefined)}</small></div>
        ))}
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
export function SettingsScreen({ t, lang, onLang, music, onMusic, muted, onMute, settings, onSettings }) {
  const set = (k, v) => onSettings({ ...settings, [k]: v });
  const Seg = ({ value, opts, onPick, label }) => (
    <div className="seg" role="group" aria-label={label}>
      {opts.map(([v, text]) => <button key={String(v)} className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onPick(v)}>{text}</button>)}
    </div>
  );
  return (
    <div className="panel">
      <div className="set-row"><span>{t.language}</span><Seg label={t.language} value={lang} onPick={onLang} opts={[['en', t.langEn], ['am', t.langAm]]} /></div>
      <div className="set-row"><span>🎵 {t.music}</span><Seg label={t.music} value={music} onPick={onMusic} opts={[[true, 'On'], [false, 'Off']]} /></div>
      <div className="set-row"><span>{t.volume}</span><input type="range" min="0.1" max="1" step="0.05" value={settings.music} aria-label={t.music + ' ' + t.volume} onChange={(e) => set('music', +e.target.value)} /></div>
      <div className="set-row"><span>🔊 {t.sound}</span><Seg label={t.sound} value={!muted} onPick={(v) => onMute(!v)} opts={[[true, 'On'], [false, 'Off']]} /></div>
      <div className="set-row"><span>{t.volume}</span><input type="range" min="0.1" max="1" step="0.05" value={settings.sfx} aria-label={t.sound + ' ' + t.volume} onChange={(e) => set('sfx', +e.target.value)} /></div>
      <div className="set-row"><span>📳 {t.vibration}</span><Seg label={t.vibration} value={settings.haptics} onPick={(v) => set('haptics', v)} opts={[[true, 'On'], [false, 'Off']]} /></div>
      <div className="set-row"><span>🐢 {t.paceLabel}</span><Seg label={t.paceLabel} value={settings.pace === 'normal' ? 'normal' : 'slow'} onPick={(v) => set('pace', v)} opts={[['slow', t.paceSlow], ['normal', t.paceNormal]]} /></div>
      <div className="set-row"><span>🎭 {t.genderLabel}</span><Seg label={t.genderLabel} value={settings.gender || 'auto'} onPick={(v) => set('gender', v)} opts={[['auto', t.genderAuto], ['m', t.genderMale], ['f', t.genderFemale]]} /></div>
      <StonePicker t={t} lang={lang} value={settings.stones} onPick={(v) => set('stones', v)} />
      <div className="set-row"><span>{t.textSize}</span><Seg label={t.textSize} value={settings.text} onPick={(v) => set('text', v)} opts={[['normal', 'A'], ['large', 'A+'], ['xlarge', 'A++']]} /></div>
      <div className="set-row"><span>🔊 {t.voice || 'Bingo caller voice'}</span><Seg label={t.voice || 'Bingo caller voice'} value={settings.voice !== false} onPick={(v) => set('voice', v)} opts={[[true, 'On'], [false, 'Off']]} /></div>
      <div className="set-row"><span>✓ {t.assist || 'Show ready fours'}</span><Seg label={t.assist || 'Show ready fours'} value={!!settings.assist} onPick={(v) => set('assist', v)} opts={[[false, 'Off'], [true, 'On']]} /></div>
      <div className="set-row"><span>{t.contrast}</span><Seg label={t.contrast} value={settings.contrast} onPick={(v) => set('contrast', v)} opts={[[false, 'Off'], [true, 'On']]} /></div>
      <AppActions />
    </div>
  );
}
