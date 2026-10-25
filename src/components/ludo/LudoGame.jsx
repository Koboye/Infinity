'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  newGame, applyRoll, applyMove, legalMoves, distinctMoves, chooseToken, rollDie, pathOf, finishOf,
} from '@/lib/ludo/engine.js';
import { sfx } from '@/lib/sound';
import ResultOverlay from '../ResultOverlay';
import LudoBoard, { COLORS } from './LudoBoard';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function Die({ value, rolling, color, disabled, onRoll, label }) {
  return (
    <button className={`ludo-die${rolling ? ' rolling' : ''}${!disabled ? ' ready' : ''}`} style={{ '--dc': color }} onClick={onRoll} disabled={disabled} aria-label={label}>
      <span className="face">
        {Array.from({ length: 9 }, (_, i) => <i key={i} className={value && PIPS[value].includes(i) ? 'pip' : ''} />)}
      </span>
    </button>
  );
}

/** Ludo vs the computer (or friends on one device). 2 / 3 / 4 players; 3 players play on the fair triangle. */
export default function LudoGame({ t, mode, level = 'medium', ruleset = 'classic', opts = {}, me, onExit }) {
  const players = [2, 3, 4].includes(opts.players) ? opts.players : 4;
  const tokens = ruleset === 'quick' ? 2 : 4;
  const [game, setGame] = useState(() => newGame({ players, tokens, start: 0 }));
  const [face, setFace] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [anim, setAnim] = useState(null);       // { p, i, pos } while a token hops
  const [flash, setFlash] = useState(null);
  const [auto, setAuto] = useState(true);
  const [note, setNote] = useState('');
  const gameRef = useRef(game), busy = useRef(false), alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const people = useMemo(() => Array.from({ length: players }, (_, p) => {
    const human = mode === 'pass' || p === 0;
    const comps = players - 1;
    return { human, name: p === 0 ? me.name : mode === 'pass' ? t.ludoPlayerN(p + 1) : comps > 1 ? `${t.computer} ${p}` : t.computer };
  }), [players, mode, me.name, t]);

  const commit = useCallback((s) => { gameRef.current = s; setGame(s); }, []);
  const say = useCallback((text, kind = 'info') => { setFlash({ text, kind, k: Math.random() }); }, []);

  const doMove = useCallback(async (i) => {
    const s0 = gameRef.current; if (busy.current || s0.over) return;
    const m = applyMove(s0, i); if (!m.ok) return;
    busy.current = true; setNote('');
    const steps = pathOf(s0, m.from, m.to);
    for (const pos of steps) { if (!alive.current) return; setAnim({ p: s0.turn, i, pos }); sfx.move(); await wait(m.from === -1 ? 220 : 150); }
    if (!alive.current) return;
    setAnim(null); commit(m.state);
    if (m.captured.length) { sfx.kick(false); say(t.ludoCapture, 'good'); }
    else if (m.finishes) { sfx.king(); say(t.ludoHomeFlash, 'good'); }
    else if (m.bonus) { say(t.ludoBonus, 'info'); }
    if (m.state.over) { sfx.win(); }
    busy.current = false;
  }, [commit, say, t]);

  const doRoll = useCallback(async () => {
    const s0 = gameRef.current; if (busy.current || s0.over || s0.phase !== 'roll') return;
    busy.current = true; setRolling(true); setNote(''); sfx.draw();
    const value = rollDie();
    for (let k = 0; k < 7; k++) { if (!alive.current) return; setFace(1 + Math.floor(Math.random() * 6)); await wait(70 + k * 12); }
    if (!alive.current) return;
    setFace(value); setRolling(false);
    const who = gameRef.current.turn;
    const r = applyRoll(s0, value);
    if (r.forfeited) { say(t.ludoSixes, 'bad'); sfx.pass(); commit(r.state); }
    else if (r.none) { setNote(t.ludoNoMove); sfx.pass(); await wait(650); if (!alive.current) return; commit(r.state); }
    else commit(r.state);
    busy.current = false; void who;
  }, [commit, say, t]);

  // drive the turn: computers roll and move by themselves; a human with a single real choice can be auto-moved
  useEffect(() => {
    if (game.over || busy.current || rolling || anim) return undefined;
    const cur = people[game.turn]; let id;
    if (game.phase === 'roll' && !cur.human) id = setTimeout(doRoll, 750 + Math.random() * 500);
    else if (game.phase === 'move') {
      if (!cur.human) id = setTimeout(() => doMove(chooseToken(gameRef.current, level)), 650 + Math.random() * 450);
      else if (auto && distinctMoves(game).length === 1) id = setTimeout(() => doMove(distinctMoves(gameRef.current)[0]), 420);
    }
    return () => clearTimeout(id);
  }, [game, rolling, anim, people, level, auto, doRoll, doMove]);

  const cur = people[game.turn];
  const humanTurn = cur.human && !game.over;
  const legal = useMemo(() => new Set(humanTurn && game.phase === 'move' && !rolling && !anim ? legalMoves(game).map((i) => `${game.turn}:${i}`) : []), [game, humanTurn, rolling, anim]);
  const toks = [];
  game.pos.forEach((arr, p) => arr.forEach((pos, i) => { toks.push({ p, i, seat: game.seats[p], pos: anim && anim.p === p && anim.i === i ? anim.pos : pos }); }));
  const color = COLORS[game.seats[game.turn]];
  const homeCount = (p) => game.pos[p].filter((x) => x === finishOf(game.board)).length;
  const canRoll = humanTurn && game.phase === 'roll' && !rolling && !busy.current;
  const status = game.over ? '' : rolling ? '…' : note || (game.phase === 'move' ? (humanTurn ? t.ludoPick : t.ludoRolled(cur.name, game.dice))
    : humanTurn ? (mode === 'pass' ? t.ludoTurnOf(cur.name) : t.ludoYourTurn) : t.ludoTurnOf(cur.name));

  const winner = game.over ? game.ranks[0] : null;
  const youWon = winner === 0;
  const restart = () => { busy.current = false; setFace(null); setAnim(null); setNote(''); commit(newGame({ players, tokens, start: Math.floor(Math.random() * players) })); };

  return (
    <div className={`ludo ${game.board}`}>
      <div className="ludo-players" style={{ '--n': players }}>
        {people.map((pp, p) => (
          <div key={p} className={`ludo-chip${game.turn === p && !game.over ? ' on' : ''}${game.ranks.includes(p) ? ' done' : ''}`} style={{ '--pc': COLORS[game.seats[p]] }}>
            <i className="dot" /><b>{pp.name}</b>
            <span className="cnt">{homeCount(p)}/{game.tokensPer}</span>
            {game.ranks.includes(p) && <em>{t.ludoRank(game.ranks.indexOf(p))}</em>}
          </div>
        ))}
      </div>
      <div className="ludo-board">
        <LudoBoard board={game.board} seats={game.seats.map((s) => s)} tokens={toks} legal={legal} onPick={doMove} />
        {flash && <div className={`flash ${flash.kind}`} key={flash.k} onAnimationEnd={() => setFlash(null)}>{flash.text}</div>}
      </div>
      <div className="ludo-dock" style={{ '--dc': color }}>
        <Die value={face} rolling={rolling} color={color} disabled={!canRoll} onRoll={doRoll} label={t.ludoRoll} />
        <div className="ludo-say" aria-live="polite"><b>{status}</b>{canRoll && <small>{t.ludoRollHint}</small>}</div>
        <label className="ludo-auto"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> {t.ludoAuto}</label>
      </div>
      {game.over && (
        <ResultOverlay title={mode === 'pass' ? t.ludoWinner(people[winner].name) : youWon ? t.ludoYouWin : t.ludoWinner(people[winner].name)} tone={mode === 'pass' || youWon ? 'win' : 'lose'}
          sub={game.ranks.map((p, r) => `${t.ludoRank(r)} ${people[p].name}`).join(' · ')}>
          <button className="btn primary" onClick={restart}>{t.playAgain}</button>
          <button className="btn ghost" onClick={onExit}>{t.backHome}</button>
        </ResultOverlay>
      )}
    </div>
  );
}
