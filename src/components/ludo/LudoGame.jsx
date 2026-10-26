'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  newGame, applyRoll, applyMove, legalMoves, distinctMoves, chooseToken, rollDie, pathOf, finishOf,
  previewAll, hintMove, progressOf, serializeGame, restoreGame,
} from '@/lib/ludo/engine.js';
import { tokenXY, trailXY, PANEL_SLOT as SLOT } from '@/lib/ludo/layout.js';
import { sfx } from '@/lib/sound';
import ResultOverlay from '../ResultOverlay';
import { useTurnClock } from '../useTurnClock';
import LudoBoard, { COLORS } from './LudoBoard';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
// rotation (x, y in degrees) that brings each face of the cube to the front; opposite faces sum to 7
const ORIENT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
const store = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { window.localStorage.removeItem(k); } catch { /* private mode */ } },
};

/** A real 3D die: it tumbles in the air and lands exactly on the rolled face. */
function Die({ value, rolling, rollId, color, disabled, onRoll, label, ms }) {
  const [fx, fy] = ORIENT[value || 1];
  const sx = fx + 360 * (2 + (rollId % 2)), sy = fy - 360 * (2 + (rollId % 3));
  return (
    <button className={`ludo-die3d${rolling ? ' rolling' : ''}${!disabled ? ' ready' : ''}${value ? '' : ' idle'}`} style={{ '--dc': color, '--roll': `${ms}ms` }} onClick={onRoll} disabled={disabled} aria-label={label}>
      <span className="hopper" key={`h${rollId}`}>
        <span className="tilt">
          <span key={rollId} className="cube" style={{ '--fx': `${fx}deg`, '--fy': `${fy}deg`, '--sx': `${sx}deg`, '--sy': `${sy}deg` }}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <span key={n} className={`face f${n}`}>{Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n].includes(i) ? (n === 1 ? 'pip one' : 'pip') : ''} />)}</span>
            ))}
          </span>
        </span>
      </span>
      <span className="die-shadow" />
    </button>
  );
}

// where each seat's base sits, so its panel (and its die) goes next to it
const ORDER = { top: ['tl', 'top', 'tr'], bottom: ['bl', 'br'] };
const initialOf = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();

/** Ludo vs the computer (or friends on one device). 2 / 3 / 4 players; 3 players play on the fair triangle. */
export default function LudoGame({ t, mode, level = 'medium', ruleset = 'classic', opts = {}, me, onExit }) {
  const players = [2, 3, 4].includes(opts.players) ? opts.players : 4;
  const tokens = ruleset === 'quick' ? 2 : 4;
  const saveKey = `ludo.save.${mode}`;
  const [game, setGame] = useState(() => newGame({ players, tokens, start: 0 }));
  const [faces, setFaces] = useState(() => Array(players).fill(null));   // last value each player rolled
  const [rolling, setRolling] = useState(false);
  const [rollIds, setRollIds] = useState(() => Array(players).fill(0));
  const [anim, setAnim] = useState(null);       // { p, i, pos } while a token hops
  const [flash, setFlash] = useState(null);
  const [auto, setAuto] = useState(true);
  const [fast, setFast] = useState(false);
  const [note, setNote] = useState('');
  const [hintKey, setHintKey] = useState(null);
  const [trail, setTrail] = useState(null);
  const [fx, setFx] = useState([]);
  const [flying, setFlying] = useState(() => new Set());
  const [showLog, setShowLog] = useState(false);
  const [timerOn, setTimerOn] = useState(true);   // turn timer (remembered per device)
  const streak = useRef(0);                      // turns in a row the clock had to play for you
  const [offer, setOffer] = useState(null);     // an unfinished game found in storage
  const gameRef = useRef(game), busy = useRef(false), alive = useRef(true), fxId = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // restore preferences and offer to resume an unfinished game
  useEffect(() => {
    setFast(store.get('ludo.fast') === '1'); setTimerOn(store.get('ludo.timer') !== '0');
    const lg = store.get('ludo.log'); setShowLog(lg == null ? window.innerHeight >= 780 : lg === '1');   // tall screens keep the real move log open
    const raw = store.get(saveKey);
    if (!raw) return;
    try {
      const o = JSON.parse(raw), g = restoreGame(o.game, { players, tokens });
      if (g && o.level === level && g.moves > 0) setOffer(g); else store.del(saveKey);
    } catch { store.del(saveKey); }
  }, [saveKey, players, tokens, level]);
  const toggleFast = () => { setFast((f) => { store.set('ludo.fast', f ? '0' : '1'); return !f; }); };
  const sp = fast ? 0.55 : 1;

  const people = useMemo(() => Array.from({ length: players }, (_, p) => {
    const human = mode === 'pass' || p === 0;
    const comps = players - 1;
    return { human, photo: p === 0 ? me.photo || null : null, name: p === 0 ? me.name : mode === 'pass' ? t.ludoPlayerN(p + 1) : comps > 1 ? `${t.computer} ${p}` : t.computer };
  }), [players, mode, me.name, me.photo, t]);

  const commit = useCallback((s) => { gameRef.current = s; setGame(s); }, []);
  const say = useCallback((text, kind = 'info') => { setFlash({ text, kind, k: Math.random() }); }, []);
  const burst = useCallback((x, y, color, kind) => {
    const id = ++fxId.current;
    setFx((l) => [...l, { id, x, y, color, kind, k: id }]);
    setTimeout(() => { if (alive.current) setFx((l) => l.filter((f) => f.id !== id)); }, 1200);
  }, []);

  // keep an unfinished game so that it can be picked up again later
  useEffect(() => {
    if (offer) return;
    if (game.over) { store.del(saveKey); return; }
    if (game.moves > 0 || game.stats.rolls.some((n) => n > 0)) store.set(saveKey, JSON.stringify({ level, game: serializeGame(game) }));
  }, [game, offer, saveKey, level]);

  const doMove = useCallback(async (i) => {
    const s0 = gameRef.current; if (busy.current || s0.over) return;
    const m = applyMove(s0, i); if (!m.ok) return;
    busy.current = true; setNote(''); setHintKey(null); setTrail(null);
    const seat = s0.seats[s0.turn], steps = pathOf(s0, m.from, m.to);
    for (const pos of steps) { if (!alive.current) return; setAnim({ p: s0.turn, i, pos }); sfx.hop(); await wait((m.from === -1 ? 260 : 170) * sp); }
    if (!alive.current) return;
    setAnim(null); commit(m.state); sfx.land();
    setTrail({ seat, pts: trailXY(s0.board, seat, m.from, m.to), k: m.state.moves });
    if (m.leaves) { const xy = tokenXY(s0.board, seat, 0, i); burst(xy.x, xy.y, COLORS[seat], 'out'); }
    if (m.captured.length) {
      const fly = new Set();
      m.captured.forEach((c) => {
        const cs = s0.seats[c.p], xy = tokenXY(s0.board, cs, s0.pos[c.p][c.i], c.i);
        burst(xy.x, xy.y, COLORS[cs], 'hit'); fly.add(`${c.p}:${c.i}`);
      });
      setFlying(fly); setTimeout(() => { if (alive.current) setFlying(new Set()); }, 900);
      sfx.kick(false); say(t.ludoCaptureMsg ? t.ludoCaptureMsg(people[s0.turn].name, people[m.captured[0].p].name) : t.ludoCapture, 'good');
    } else if (m.finishes) {
      const xy = tokenXY(s0.board, seat, finishOf(s0.board), i); burst(xy.x, xy.y, COLORS[seat], 'home');
      sfx.home(); say(t.ludoHomeFlash, 'good');
    } else if (m.bonus) { say(t.ludoBonus, 'info'); }
    if (m.state.over) { if (mode === 'pass' || m.state.ranks[0] === 0) sfx.win(); else sfx.lose(); }
    busy.current = false;
  }, [commit, say, burst, t, sp, people, mode]);

  const doRoll = useCallback(async () => {
    const s0 = gameRef.current; if (busy.current || s0.over || s0.phase !== 'roll') return;
    busy.current = true; setRolling(true); setNote(''); setHintKey(null); sfx.dice();
    const value = rollDie();
    const who = s0.turn; setFaces((f) => f.map((v, k) => (k === who ? value : v))); setRollIds((r) => r.map((v, k) => (k === who ? v + 1 : v)));   // the cube in that player's own area tumbles to the rolled face
    await wait(900 * sp);
    if (!alive.current) return;
    setRolling(false);
    const r = applyRoll(s0, value);
    if (r.forfeited) { say(t.ludoSixes, 'bad'); sfx.pass(); commit(r.state); }
    else if (r.none) { setNote(t.ludoNoMove); sfx.pass(); await wait(700 * sp); if (!alive.current) return; commit(r.state); }
    else commit(r.state);
    busy.current = false;
  }, [commit, say, t, sp]);

  const paused = !!offer;
  // drive the turn: computers roll and move by themselves; a human with a single real choice can be auto-moved
  useEffect(() => {
    if (paused || game.over || busy.current || rolling || anim) return undefined;
    const cur = people[game.turn]; let id;
    if (game.phase === 'roll' && !cur.human) id = setTimeout(doRoll, (700 + Math.random() * 450) * sp);
    else if (game.phase === 'move') {
      if (!cur.human) id = setTimeout(() => doMove(chooseToken(gameRef.current, level)), (650 + Math.random() * 400) * sp);
      else if (auto && distinctMoves(game).length === 1) id = setTimeout(() => doMove(distinctMoves(gameRef.current)[0]), 420 * sp);
    }
    return () => clearTimeout(id);
  }, [game, rolling, anim, people, level, auto, doRoll, doMove, paused, sp]);

  const cur = people[game.turn];
  const humanTurn = cur.human && !game.over && !paused;
  const idle = !rolling && !anim;
  const legal = useMemo(() => new Set(humanTurn && game.phase === 'move' && idle ? legalMoves(game).map((i) => `${game.turn}:${i}`) : []), [game, humanTurn, idle]);
  const previews = useMemo(() => (legal.size ? new Map(previewAll(game).map((pv) => [`${game.turn}:${pv.i}`, pv])) : null), [game, legal]);
  const toks = [];
  game.pos.forEach((arr, p) => arr.forEach((pos, i) => { const mv = anim && anim.p === p && anim.i === i; toks.push({ p, i, seat: game.seats[p], pos: mv ? anim.pos : pos, moving: mv }); }));
  const seatNow = game.seats[game.turn], color = COLORS[seatNow];
  const F = finishOf(game.board);
  const homeCount = (p) => game.pos[p].filter((x) => x === F).length;
  const canRoll = humanTurn && game.phase === 'roll' && idle && !busy.current;
  const canHint = humanTurn && game.phase === 'move' && idle && legal.size > 1;
  // smart turn clock: 12 s to roll, 18 s to choose; a player who keeps letting it run out gets less time (never under 6 s)
  const needsInput = humanTurn && idle && !paused && (game.phase === 'roll' || !(auto && distinctMoves(game).length === 1));
  const secs = Math.max(6, (game.phase === 'roll' ? 12 : 18) - 3 * Math.min(streak.current, 2));
  const clock = useTurnClock({
    running: timerOn && needsInput && !game.over, seat: game.turn, seconds: secs,
    resetKey: `${game.turn}|${game.phase}|${game.moves}|${game.stats.rolls.reduce((a, b) => a + b, 0)}`,
    onExpire: () => {
      if (busy.current || !alive.current) return;
      streak.current += 1; say(t.ludoAutoPlayed, 'bad');
      const g = gameRef.current;
      if (g.phase === 'roll') doRoll(); else doMove(chooseToken(g, 'medium'));
    },
  });
  useEffect(() => { if (clock && clock.left > 0 && clock.left <= 5) sfx.tick?.(); }, [clock?.left]); // eslint-disable-line react-hooks/exhaustive-deps
  const userRoll = () => { streak.current = 0; doRoll(); };
  const userPick = (i) => { streak.current = 0; doMove(i); };
  const toggleTimer = () => setTimerOn((v) => { store.set('ludo.timer', v ? '0' : '1'); return !v; });
  const status = game.over ? '' : rolling ? '…' : note || (game.phase === 'move' ? (humanTurn ? t.ludoPick : t.ludoRolled(cur.name, game.dice))
    : humanTurn ? (mode === 'pass' ? t.ludoTurnOf(cur.name) : t.ludoYourTurn) : t.ludoTurnOf(cur.name));

  // space / enter rolls the die
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const tag = (e.target && e.target.tagName) || ''; if (['BUTTON', 'INPUT', 'TEXTAREA', 'A'].includes(tag) || (e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button')) return;
      if (canRoll) { e.preventDefault(); doRoll(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [canRoll, doRoll]);

  useEffect(() => { if (!hintKey) return undefined; const id = setTimeout(() => setHintKey(null), 3200); return () => clearTimeout(id); }, [hintKey]);
  const hint = () => { const i = hintMove(gameRef.current); if (i != null) { setHintKey(`${game.turn}:${i}`); sfx.tap(); } };

  const winner = game.over ? game.ranks[0] : null;
  const youWon = winner === 0;
  const reset = (g) => { busy.current = false; setFaces(Array(players).fill(null)); setAnim(null); setNote(''); setHintKey(null); setTrail(null); setFx([]); setFlying(new Set()); setFlash(null); commit(g); };
  const restart = () => { store.del(saveKey); reset(newGame({ players, tokens, start: Math.floor(Math.random() * players) })); };
  const resume = () => { const g = offer; setOffer(null); reset(g); if (g.phase === 'move') setFaces((f) => f.map((v, k) => (k === g.turn ? g.dice : v))); };
  const fresh = () => { store.del(saveKey); setOffer(null); };

  const recent = game.log.slice(-6).reverse();
  const statsTable = game.over && (
    <div className="ludo-stats" role="table" aria-label={t.ludoStatsTitle}>
      <div className="row head" role="row"><span /><span /><span title={t.ludoStatRolls}>🎲</span><span title={t.ludoStatSixes}>6️⃣</span><span title={t.ludoStatHits}>⚔️</span><span title={t.ludoStatLost}>🏠</span></div>
      {game.ranks.map((p, r) => (
        <div className="row" role="row" key={p} style={{ '--pc': COLORS[game.seats[p]] }}>
          <span className="rk">{t.ludoRank(r)}</span><b><i className="dot" />{people[p].name}</b>
          <span>{game.stats.rolls[p]}</span><span>{game.stats.sixes[p]}</span><span>{game.stats.captures[p]}</span><span>{game.stats.lost[p]}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`ludo ${game.board}`} style={{ '--tc': color, '--step': `${0.17 * sp}s` }}>
      {['top', 'bottom'].map((row) => {
        const seatsHere = ORDER[row].map((sl) => game.seats.findIndex((st) => SLOT[game.board][st] === sl)).filter((p) => p >= 0);
        return (
          <div key={row} className={`ludo-row ${row}${row === 'bottom' ? ' after' : ''}`} hidden={seatsHere.length === 0} style={row === 'bottom' ? { order: 3 } : { order: 0 }}>
            {seatsHere.map((p) => {
              const seat = game.seats[p], pp = people[p], on = game.turn === p && !game.over, done = game.ranks.includes(p), slot = SLOT[game.board][seat];
              const mine = on && canRoll;
              return (
                <div key={p} className={`ludo-panel ${slot}${on ? ' on' : ''}${done ? ' done' : ''}`} style={{ '--pc': COLORS[seat] }} aria-current={on ? 'true' : undefined}
                  title={t.ludoTokenCount ? t.ludoTokenCount(homeCount(p), game.tokensPer) : undefined}>
                  <Die value={faces[p]} rolling={rolling && on} rollId={rollIds[p]} color={COLORS[seat]} disabled={!mine} onRoll={userRoll} label={`${t.ludoRoll} — ${pp.name}`} ms={900 * sp} />
                  <div className="info">
                    <b className="nm"><span className={`av${pp.photo ? ' photo' : ''}`}>{pp.photo ? <img src={pp.photo} alt="" /> : pp.human ? initialOf(pp.name) : '🤖'}</span><span className="tx">{pp.name}</span></b>
                    <span className="pips">{game.pos[p].map((x, k) => <i key={k} className={x === F ? 'home' : x >= 0 ? 'out' : ''} />)}</span>
                    <span className="bar"><i style={{ width: `${Math.round(progressOf(game, p) * 100)}%` }} /></span>
                  </div>
                  {on && clock && <span className={`tclock${clock.left <= 5 ? ' low' : ''}`} role="timer" aria-label={t.ludoTimer}><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, clock.left / clock.max))})` }} /><b>{clock.left}</b></span>}
                  {on && game.sixes > 0 && <span className={`sixes${game.sixes >= 2 ? ' warn' : ''}`} title="sixes in a row">6×{game.sixes}</span>}
                  {done && <em>{t.ludoRank(game.ranks.indexOf(p))}</em>}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="ludo-board" style={{ order: 1 }}>
        <LudoBoard board={game.board} seats={game.seats} tokens={toks} legal={legal} onPick={userPick} hintKey={hintKey} turnSeat={seatNow} previews={previews} trail={trail} fx={fx} flying={flying} />
        {flash && <div className={`flash ${flash.kind}`} key={flash.k} onAnimationEnd={() => setFlash(null)}>{flash.text}</div>}
      </div>
      <div className={`ludo-dock${canRoll ? ' ready' : ''}`} style={{ '--dc': color, order: 4 }}>
        <div className="ludo-say" aria-live="polite"><b>{status}</b>{canRoll && <small>{t.ludoRollHint}</small>}</div>
        <div className="ludo-tools">
          <button type="button" className="tool" onClick={hint} disabled={!canHint} title={t.ludoHintBtn}><span aria-hidden="true">💡</span> {t.ludoHintBtn}</button>
          <button type="button" className={`tool${fast ? ' on' : ''}`} onClick={toggleFast} aria-pressed={fast}><span aria-hidden="true">⚡</span> {t.ludoFast}</button>
          <button type="button" className={`tool${showLog ? ' on' : ''}`} onClick={() => setShowLog((v) => { store.set('ludo.log', v ? '0' : '1'); return !v; })} aria-pressed={showLog}><span aria-hidden="true">📜</span> {t.ludoShowLog}</button>
          <button type="button" className={`tool${timerOn ? ' on' : ''}`} onClick={toggleTimer} aria-pressed={timerOn} title={t.ludoTimer}><span aria-hidden="true">⏱</span> {t.ludoTimer}</button>
          <button type="button" className={`tool${auto ? ' on' : ''}`} onClick={() => setAuto((v) => !v)} aria-pressed={auto} title={t.ludoAuto}><span aria-hidden="true">🎯</span> {t.ludoAutoShort || 'Auto'}</button>
        </div>
        {showLog && (
          <ol className="ludo-log" aria-label={t.ludoShowLog}>
            {recent.length === 0 && <li className="empty">—</li>}
            {recent.map((e) => (
              <li key={e.n} style={{ '--pc': COLORS[game.seats[e.p]] }}><i className="dot" /><span className="n">{e.n}</span><b>{people[e.p].name}</b><span className="d">🎲 {e.dice}</span>
                {e.out && <span title="out">🚀</span>}{e.cap > 0 && <span title="capture">⚔️{e.cap > 1 ? `×${e.cap}` : ''}</span>}{e.home && <span title="home">🏠</span>}</li>
            ))}
          </ol>
        )}
      </div>
      {offer && (
        <div className="ludo-modal" role="dialog" aria-modal="true" aria-label={t.ludoResumeTitle}>
          <div className="card">
            <div className="ico" aria-hidden="true">🎲</div>
            <h3>{t.ludoResumeTitle}</h3>
            <p>{t.ludoResumeSub}</p>
            <div className="acts"><button className="btn primary" onClick={resume}>{t.resume}</button><button className="btn ghost" onClick={fresh}>{t.ludoNewGame}</button></div>
          </div>
        </div>
      )}
      {game.over && (
        <ResultOverlay title={mode === 'pass' ? t.ludoWinner(people[winner].name) : youWon ? t.ludoYouWin : t.ludoWinner(people[winner].name)} tone={mode === 'pass' || youWon ? 'win' : 'lose'}
          sub={statsTable}>
          <button className="btn primary" onClick={restart}>{t.playAgain}</button>
          <button className="btn ghost" onClick={onExit}>{t.backHome}</button>
        </ResultOverlay>
      )}
    </div>
  );
}
