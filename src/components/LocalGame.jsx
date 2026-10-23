'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { newGame, playMove, PITS, famText } from '@/lib/gebeta/engine.js';
import { chooseMove } from '@/lib/gebeta/ai.js';
import { sfx } from '@/lib/sound';
import { useAnimator } from './useAnimator';
import MatchView from './MatchView';
import ResultOverlay from './ResultOverlay';

/** Offline play: vs computer (human is seat 0) or pass-and-play on one device. */
export default function LocalGame({ t, mode, level, ruleset, me, onExit, onLeave }) {
  const [game, setGame] = useState(() => newGame(ruleset));
  const [round, setRound] = useState(0);
  const [hintPit, setHintPit] = useState(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hist, setHist] = useState([]);
  const anim = useAnimator(game.pits, t);
  const doneSound = useRef(false);

  const players = mode === 'ai'
    ? [{ name: me.name, hero: me.hero }, { name: t.computer, hero: 'shield' }]
    : [{ name: t.player1, hero: 'lion' }, { name: t.player2, hero: 'queen' }];

  const gameRef = useRef(game);
  const play = useCallback((pit) => {
    const r = playMove(gameRef.current, pit, ruleset);
    if (!r.ok) return;
    gameRef.current = r.state;
    setGame(r.state);
    anim.enqueue({ steps: r.steps, final: r.state.pits, extra: r.extraTurn && !r.state.over });
  }, [anim, ruleset]);

  const humanTurn = mode === 'pass' || game.turn === 0;
  const isLegal = (i) => !anim.busy && !game.over && humanTurn && PITS[game.turn].includes(i) && game.pits[i] > 0;
  const onPit = (i) => { if (isLegal(i)) { sfx.tap(); setHintPit(null); if (mode === 'ai') setHist((h) => [...h, gameRef.current].slice(-10)); play(i); } };
  const askHint = () => {
    if (hintsLeft <= 0 || !humanTurn || anim.busy || game.over || mode !== 'ai') return;
    setHintsLeft((n) => n - 1); setHintPit(chooseMove(gameRef.current, ruleset, 'hard')); sfx.tap();
  };
  const canUndo = mode === 'ai' && hist.length > 0 && !anim.busy && !game.over && game.turn === 0;
  const undo = () => {
    if (!canUndo) return;
    const prev = hist[hist.length - 1]; setHist(hist.slice(0, -1)); setHintPit(null);
    gameRef.current = prev; setGame(prev); anim.reset(prev.pits); sfx.tap();
  };

  // Computer's turn
  useEffect(() => {
    if (mode !== 'ai' || game.over || game.turn !== 1 || anim.busy) return;
    const id = setTimeout(() => play(chooseMove(game, ruleset, level)), 1300);
    return () => clearTimeout(id);
  }, [mode, game, anim.busy, level, ruleset, play]);

  const finished = game.over && !anim.busy;
  useEffect(() => {
    if (!finished || doneSound.current) return;
    doneSound.current = true;
    (mode === 'ai' && game.winner === 1) ? sfx.lose() : sfx.win();
  }, [finished, game.winner, mode]);

  const again = () => { setHist([]); setHintPit(null); setHintsLeft(3); const g = newGame(ruleset); gameRef.current = g; doneSound.current = false; setGame(g); anim.reset(g.pits); setRound((r) => r + 1); };

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
      t={t} pits={anim.pits} turn={game.turn} viewSeat={0} players={players}
      isLegal={isLegal} onPit={onPit} active={anim.active} hand={anim.hand} flash={anim.flash} status={status} hintPit={hintPit}
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
