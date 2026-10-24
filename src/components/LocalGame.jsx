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
  const [game, setGame] = useState(() => newGame(ruleset));
  const [round, setRound] = useState(0);
  const [hintPit, setHintPit] = useState(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hist, setHist] = useState([]);
  const anim = useAnimator(game.pits, t, 1, game.own, game.flag);
  const doneSound = useRef(false);

  const players = mode === 'ai'
    ? [{ name: me.name, hero: me.hero }, { name: t.computer, hero: 'shield' }]
    : [{ name: t.player1, hero: 'lion' }, { name: t.player2, hero: 'queen' }];

  const gameRef = useRef(game);
  // `auto` = the computer, which always taps its ripe families before it moves.
  const play = useCallback((pit, auto = false) => {
    const pre = auto ? collectAll(gameRef.current) : { state: gameRef.current, steps: [] };
    const r = playMove(pre.state, pit, ruleset);
    if (!r.ok) return;
    gameRef.current = r.state;
    setGame(r.state);
    anim.enqueue({ steps: [...pre.steps, ...r.steps], final: r.state.pits, own: r.state.own, flag: r.state.flag });
  }, [anim, ruleset]);
  const doCollect = (i) => {
    const r = collect(gameRef.current, i);
    if (!r.ok) return;
    if (mode === 'ai') setHist((h) => [...h, gameRef.current].slice(-10));
    gameRef.current = r.state; setGame(r.state); setHintPit(null);
    anim.enqueue({ steps: r.steps, final: r.state.pits, own: r.state.own, flag: r.state.flag });
  };

  const humanTurn = mode === 'pass' || game.turn === 0;
  const isLegal = (i) => !anim.busy && !game.over && humanTurn && holesOf(game, game.turn).includes(i) && game.pits[i] > 0 && !(game.flag && game.flag[i]);
  const canCollect = (i) => !anim.busy && !game.over && humanTurn && collectable(game, game.turn).includes(i);
  const onPit = (i) => { if (canCollect(i)) { sfx.tap(); doCollect(i); return; } if (isLegal(i)) { sfx.tap(); setHintPit(null); if (mode === 'ai') setHist((h) => [...h, gameRef.current].slice(-10)); play(i); } };
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
    }, 650);
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

  const again = () => { setHist([]); setHintPit(null); setHintsLeft(3); const g = newGame(ruleset); gameRef.current = g; doneSound.current = false; setGame(g); anim.reset(g.pits, g.own, g.flag); setRound((r) => r + 1); };

  let status;
  if (game.over) status = '';
  else if (mode === 'ai') status = game.turn === 0 ? t.yourTurn : t.theirTurn(t.computer);
  else status = t.theirTurn(players[game.turn].name);

  let title, tone = 'win';
  if (game.winner === 'draw') { title = t.draw; tone = 'draw'; }
  else if (mode === 'ai') { title = game.winner === 0 ? t.youWin : t.youLose; tone = game.winner === 0 ? 'win' : 'lose'; }
  else title = t.wins(players[game.winner]?.name || '');

  return (
    <MatchView
      key={round}
      t={t} pits={anim.pits} own={anim.own} flag={anim.flag} canCollect={canCollect} turn={game.turn} viewSeat={0} players={players}
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
