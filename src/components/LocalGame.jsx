'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { newGame, playMove, collect, collectAll, collectable, holesOf, famText } from '@/lib/gebeta/engine.js';
import { chooseMove } from '@/lib/gebeta/ai.js';
import { chooseMoveAsync } from '@/lib/gebeta/aiClient.js';
import { sfx } from '@/lib/sound';
import { useAnimator } from './useAnimator';
import MatchView from './MatchView';
import ResultOverlay from './ResultOverlay';
import { useTurnClock } from './useTurnClock';

/** Offline play: vs computer (human is seat 0) or pass-and-play on one device. */
export default function LocalGame({ t, mode, level, ruleset, me, onExit, onLeave }) {
  const [first] = useState(() => (Math.random() < 0.5 ? 1 : 0));   // lottery: who starts
  const [startNote, setStartNote] = useState(true);
  const [game, setGame] = useState(() => newGame(ruleset, first));
  const [round, setRound] = useState(0);
  useEffect(() => { setStartNote(true); const id = setTimeout(() => setStartNote(false), 2800); return () => clearTimeout(id); }, [round]);
  const [hintPit, setHintPit] = useState(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hist, setHist] = useState([]);
  const anim = useAnimator(game.pits, t, 1, game.own, game.flag);
  const doneSound = useRef(false);

  const players = mode === 'ai'
    ? [{ name: me.name, hero: me.hero }, { name: t.computer, hero: 'shield' }]
    : [{ name: t.player1, hero: 'lion' }, { name: t.player2, hero: 'queen' }];

  const gameRef = useRef(game);
  const moveCtx = useRef(null);       // the move being animated: lets a tap on a four re-script the rest of it
  const queued = useRef(null);        // a hole tapped early: plays the moment your turn starts
  const frozenUntil = useRef(0);      // Ghost Tap penalty
  const [frozenLeft, setFrozenLeft] = useState(0);
  useEffect(() => {
    if (!frozenLeft) return undefined;
    const id = setTimeout(() => setFrozenLeft(Math.max(0, Math.ceil((frozenUntil.current - Date.now()) / 1000))), 400);
    return () => clearTimeout(id);
  }, [frozenLeft]);
  // `auto` = the computer, which always taps its ripe families before it moves.
  const play = useCallback((pit, auto = false) => {
    const pre = auto ? collectAll(gameRef.current) : { state: gameRef.current, steps: [] };
    const r = playMove(pre.state, pit, ruleset);
    if (!r.ok) return;
    moveCtx.current = { pre: pre.state, preSteps: pre.steps, pit, schedule: [] };
    gameRef.current = r.state;
    setGame(r.state);
    anim.enqueue({ steps: [...pre.steps, ...r.steps], final: r.state.pits, own: r.state.own, flag: r.state.flag });
  }, [anim, ruleset]);
  // Who is entitled to the four in hole i, judged by what the board SHOWS right now (flag 1 → seat 0, 2 → seat 1).
  const entitled = (i) => { const f = anim.flag ? anim.flag[i] : 0; return f === 1 ? 0 : f === 2 ? 1 : -1; };
  const doCollect = (i) => {
    const f = gameRef.current.flag ? gameRef.current.flag[i] : 0;
    const r = collect(gameRef.current, i, f === 1 ? 0 : 1);
    if (!r.ok) return false;
    if (mode === 'ai') setHist((h) => [...h, gameRef.current].slice(-10));
    gameRef.current = r.state; setGame(r.state); setHintPit(null);
    anim.enqueue({ steps: r.steps, final: r.state.pits, own: r.state.own, flag: r.state.flag });
    return true;
  };

  const humanTurn = mode === 'pass' || game.turn === 0;
  const isLegal = (i) => !anim.busy && !game.over && humanTurn && holesOf(game, game.turn).includes(i) && game.pits[i] > 0 && !(game.flag && game.flag[i]);
  // One touch, any time: the moment a four is visible on the board its owner may tap it — even while the seeds are still
  // travelling and even if the turn has already passed to the other side (your own last stone made the four).
  const canCollect = (i) => {
    if (game.over) return false;
    const s = entitled(i);
    if (s < 0 || (mode === 'ai' && s !== 0)) return false;
    return collectable(gameRef.current, s).includes(i);
  };
  // A four is on screen while the stones are still travelling: collect it RIGHT NOW. The rest of the move is
  // re-played from that exact moment, so a stone that would have frozen the four now drops into an empty hole.
  const collectMidMove = (i) => {
    const ctx = moveCtx.current;
    if (!anim.busy || !ctx) return false;
    const f = anim.flag ? anim.flag[i] : 0;
    const s = f === 1 ? 0 : f === 2 ? 1 : -1;
    if (s < 0 || (mode === 'ai' && s !== 0) || anim.pits[i] !== 4) return false;
    const at = anim.shown() - ctx.preSteps.length;
    if (at < 0) return false;
    const schedule = [...ctx.schedule, { at, hole: i, seat: s }];
    const r = playMove(ctx.pre, ctx.pit, ruleset, schedule);
    if (!r.ok) return false;
    const ok = anim.patch({ steps: [...ctx.preSteps, ...r.steps], final: r.state.pits, own: r.state.own, flag: r.state.flag });
    if (!ok) return false;
    ctx.schedule = schedule;
    gameRef.current = r.state; setGame(r.state); setHintPit(null); sfx.tap();
    return true;
  };
  const onPit = (i) => {
    if (game.over) return;
    if (mode === 'ai' && Date.now() < frozenUntil.current) { sfx.pass(); return; } // Ghost Tap freeze
    if (collectMidMove(i)) return;
    if (canCollect(i)) { sfx.tap(); doCollect(i); return; }
    const seatMe = mode === 'ai' ? 0 : game.turn;
    const isHole = i !== 6 && i !== 13;
    const mineNow = isHole && holesOf(gameRef.current, seatMe).includes(i) && gameRef.current.pits[i] > 0 && !(gameRef.current.flag && gameRef.current.flag[i]);
    if (anim.busy || !humanTurn) {            // not your move yet: speed things up and queue the tap
      if (anim.busy) anim.hurry();
      if (mode === 'ai' && mineNow) { queued.current = i; setHintPit(i); sfx.tap(); }
      return;
    }
    if (isLegal(i)) { sfx.tap(); setHintPit(null); queued.current = null; if (mode === 'ai') setHist((h) => [...h, gameRef.current].slice(-10)); play(i); return; }
    // Ghost Tap: poking a hole that is neither a move nor a four you can claim
    if (mode === 'ai' && isHole && anim.pits[i] !== 4) {
      frozenUntil.current = Date.now() + 3000; setFrozenLeft(3); sfx.pass();
    }
  };
  // The queued tap plays as soon as the turn passes to you.
  useEffect(() => {
    if (mode !== 'ai' || queued.current == null || game.over || game.turn !== 0 || anim.busy) return;
    const i = queued.current; queued.current = null; setHintPit(null);
    if (holesOf(game, 0).includes(i) && game.pits[i] > 0 && !(game.flag && game.flag[i])) {
      setHist((h) => [...h, gameRef.current].slice(-10)); play(i);
    }
  }, [mode, game, anim.busy, play]);
  const askHint = () => {
    if (hintsLeft <= 0 || !humanTurn || anim.busy || game.over || mode !== 'ai') return;
    setHintsLeft((n) => n - 1); sfx.tap();
    const snap = gameRef.current;
    chooseMoveAsync(snap, ruleset, 'hard').then((m) => { if (gameRef.current === snap) setHintPit(m); });
  };
  const canUndo = mode === 'ai' && hist.length > 0 && !anim.busy && !game.over && game.turn === 0;
  const undo = () => {
    if (!canUndo) return;
    const prev = hist[hist.length - 1]; setHist(hist.slice(0, -1)); setHintPit(null);
    gameRef.current = prev; setGame(prev); anim.reset(prev.pits, prev.own, prev.flag); sfx.tap();
  };

  // Computer's turn
  useEffect(() => {
    if (mode !== 'ai' || game.over || game.turn !== 1 || anim.busy) return;
    let cancelled = false;
    const id = setTimeout(() => {
      chooseMoveAsync(game, ruleset, level).then((m) => { if (!cancelled && gameRef.current === game && m != null) play(m, true); });
    }, 1000); // a beat for you to tap a four of your own before the computer moves
    return () => { cancelled = true; clearTimeout(id); };
  }, [mode, game, anim.busy, level, ruleset, play]);

  // standard turn clock: when it runs out a move is played for you (stones you left unnoticed stay uncollected)
  const clock = useTurnClock({
    running: !game.over && humanTurn && !anim.busy, seat: game.turn, resetKey: `${round}:${game.turn}:${game.pits.join(',')}`,
    onExpire: () => { const p = chooseMove(gameRef.current, ruleset, 'easy'); if (p != null) play(p, false); },
  });
  const finished = game.over && !anim.busy;
  useEffect(() => {
    if (!finished || doneSound.current) return;
    doneSound.current = true;
    (mode === 'ai' && game.winner === 1) ? sfx.lose() : sfx.win();
  }, [finished, game.winner, mode]);

  const again = () => { queued.current = null; frozenUntil.current = 0; setFrozenLeft(0); setHist([]); setHintPit(null); setHintsLeft(3); const g = newGame(ruleset, Math.random() < 0.5 ? 1 : 0); gameRef.current = g; setStartNote(true); doneSound.current = false; setGame(g); anim.reset(g.pits, g.own, g.flag); setRound((r) => r + 1); };

  let status;
  const untouched = game.pits.every((v, k) => k === 6 || k === 13 || v === 4);
  if (startNote && !game.over && untouched) status = t.lotteryStart(players[game.turn].name);
  else if (frozenLeft > 0 && !game.over) status = t.ghostFrozen(frozenLeft);
  else if (game.over) status = '';
  else if (mode === 'ai') status = game.turn === 0 ? t.yourTurn : t.theirTurn(t.computer);
  else status = t.theirTurn(players[game.turn].name);

  let title, tone = 'win';
  if (game.winner === 'draw') { title = t.draw; tone = 'draw'; }
  else if (mode === 'ai') { title = game.winner === 0 ? t.youWin : t.youLose; tone = game.winner === 0 ? 'win' : 'lose'; }
  else title = t.wins(players[game.winner]?.name || '');

  return (
    <MatchView
      key={round}
      t={t} pits={anim.pits} own={anim.own} flag={anim.flag} canCollect={(i) => !anim.busy && canCollect(i)} turn={game.turn} viewSeat={0} players={players}
      isLegal={isLegal} onPit={onPit} active={anim.active} flash={anim.flash} status={status} hintPit={hintPit} timer={clock}
      overlay={finished && (
        <ResultOverlay title={title} tone={tone} score={[famText(game.pits[6]), famText(game.pits[13])]} sub={t.seedTotals(game.pits[6], game.pits[13])}>
          <button className="btn primary" onClick={again}>{t.playAgain}</button>
          <button className="btn" onClick={onExit}>{t.backHome}</button>
        </ResultOverlay>
      )}
    >
      <div className="match-actions">
        {mode === 'ai' && <button className="btn" disabled={!canUndo} onClick={undo}>↶ {t.undo}</button>}
        {mode === 'ai' && <button className="btn" disabled={!humanTurn || anim.busy || hintsLeft <= 0} onClick={askHint}>💡 {t.hint} ({hintsLeft})</button>}
        <button className="btn ghost" onClick={onLeave || onExit}>{t.leave}</button>
      </div>
    </MatchView>
  );
}
