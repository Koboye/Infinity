'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newGame, playMove, resolveHuff, legalMoves, counts } from '@/lib/checkers/engine.js';
import { chooseCheckersMove, chooseHuffPick } from '@/lib/checkers/ai.js';
import { sfx } from '@/lib/sound';
import { useCheckersAnimator } from './useCheckersAnimator';
import { useCheckersInput } from './useCheckersInput';
import CheckersBoard from './CheckersBoard';
import { MatchFrame } from '../MatchView';
import ResultOverlay from '../ResultOverlay';
import { useTurnClock } from '../useTurnClock';

export const ckReason = (t, r, board) => {
  if (r === 'blocked' && board && (counts(board)[0] === 0 || counts(board)[1] === 0)) return t.rCaptured;
  return ({ blocked: t.rBlocked, repetition: t.rRepetition, moves: t.rMoves, agreed: t.rAgreed }[r] || '');
};
export const SideDot = ({ seat, t }) => <span className={`side-dot s${seat}`} title={seat === 0 ? t.dark : t.light} />;

/** Offline checkers: vs computer (human is Dark, seat 0) or pass-and-play on one device. */
export default function CheckersLocal({ t, mode, level, ruleset, me, onExit, onLeave }) {
  const [game, setGame] = useState(() => newGame(ruleset));
  const [round, setRound] = useState(0);
  const [hint, setHint] = useState(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hist, setHist] = useState([]);
  const gameRef = useRef(game);
  const doneSound = useRef(false);
  const anim = useCheckersAnimator(game.board, t);

  const players = mode === 'ai'
    ? [{ name: me.name, hero: me.hero }, { name: t.computer, hero: 'horse' }]
    : [{ name: t.player1, hero: 'lion' }, { name: t.player2, hero: 'queen' }];

  const moves = useMemo(() => (game.over ? [] : legalMoves(game, ruleset)), [game, ruleset]);
  const humanTurn = mode === 'pass' || game.turn === 0;
  const enabled = !anim.busy && !game.over && humanTurn;

  const play = useCallback((move) => {
    const r = playMove(gameRef.current, move.from, move.path, ruleset);
    if (!r.ok) return;
    if (mode === 'ai' && gameRef.current.turn === 0) setHist((h) => [...h, gameRef.current].slice(-10));
    gameRef.current = r.state;
    setGame(r.state);
    anim.enqueue({ hops: r.hops, final: r.state.board, promote: r.promoted, huffed: r.huffed });
  }, [anim, ruleset, mode]);

  // Dama huff: after a missed capture the opponent removes one of the pieces that missed it.
  const pending = game.pendingHuff || null;
  const pickPiece = useCallback((square) => {
    const r = resolveHuff(gameRef.current, square, ruleset);
    if (!r.ok) return;
    gameRef.current = r.state;
    setGame(r.state);
    anim.enqueue({ hops: [], final: r.state.board, promote: false, huffed: r.huffed });
  }, [anim, ruleset]);

  const input = useCheckersInput({ moves, enabled, onMove: play, resetKey: `${round}:${game.turn}:${game.noProgress}:${game.board.join('')}`, strict: ruleset === 'dama' });

  // Computer's turn
  useEffect(() => {
    if (mode !== 'ai' || game.over || game.turn !== 1 || anim.busy) return;
    const id = setTimeout(() => {
      if (gameRef.current.pendingHuff) { const sq = chooseHuffPick(gameRef.current, ruleset); if (sq != null) pickPiece(sq); return; }
      const m = chooseCheckersMove(gameRef.current, ruleset, level); if (m) play(m);
    }, pending ? 900 : 500);
    return () => clearTimeout(id);
  }, [mode, game, anim.busy, level, ruleset, play, pickPiece, pending]);

  const clock = useTurnClock({
    running: enabled, seat: game.turn, resetKey: `${round}:${game.turn}:${game.board.join('')}`,
    onExpire: () => {
      if (gameRef.current.pendingHuff) { const sq = chooseHuffPick(gameRef.current, ruleset); if (sq != null) pickPiece(sq); return; }
      const m = chooseCheckersMove(gameRef.current, ruleset, 'easy'); if (m) play(m);
    },
  });
  useEffect(() => { setHint(null); }, [game.turn]);
  const finished = game.over && !anim.busy;
  useEffect(() => {
    if (!finished || doneSound.current) return;
    doneSound.current = true;
    (mode === 'ai' && game.winner === 1) ? sfx.lose() : game.winner === 'draw' ? sfx.tap() : sfx.win();
  }, [finished, game.winner, mode]);

  const askHint = () => {
    if (hintsLeft <= 0 || !enabled || mode !== 'ai') return;
    const m = chooseCheckersMove(gameRef.current, ruleset, 'hard');
    if (!m) return;
    setHintsLeft((n) => n - 1); setHint({ from: m.from, to: m.path[0] }); sfx.tap();
    setTimeout(() => setHint(null), 2500);
  };
  const canUndo = mode === 'ai' && hist.length > 0 && !anim.busy && !game.over && game.turn === 0;
  const undo = () => {
    if (!canUndo) return;
    const prev = hist[hist.length - 1]; setHist(hist.slice(0, -1)); setHint(null);
    gameRef.current = prev; setGame(prev); anim.reset(prev.board); sfx.tap();
  };
  const again = () => { setHist([]); setHint(null); setHintsLeft(3); const g = newGame(ruleset); gameRef.current = g; doneSound.current = false; setGame(g); anim.reset(g.board); setRound((r) => r + 1); };

  const c = counts(game.board);
  let status = '';
  if (!game.over) {
    if (pending) status = enabled ? t.pickHuff : t.theirPick(players[game.turn].name);
    else if (ruleset !== 'dama' && enabled && moves.length && moves[0].caps.length) status = t.mustCapture;
    else if (mode === 'ai') status = game.turn === 0 ? t.yourTurn : t.theirTurn(t.computer);
    else status = t.theirTurn(players[game.turn].name);
  }

  let title, tone = 'win';
  if (game.winner === 'draw') { title = t.draw; tone = 'draw'; }
  else if (mode === 'ai') { title = game.winner === 0 ? t.youWin : t.youLose; tone = game.winner === 0 ? 'win' : 'lose'; }
  else title = t.wins(players[game.winner]?.name || '');

  return (
    <MatchFrame
      key={round} t={t} players={players} viewSeat={0} turn={game.turn} scores={c} scoreLabel={t.piecesLabel}
      badges={[<SideDot key="a" seat={0} t={t} />, <SideDot key="b" seat={1} t={t} />]}
      flash={anim.flash} status={status} timer={clock}
      board={(
        <CheckersBoard
          pieces={anim.pieces} viewSeat={0} selected={input.from} picked={input.picked} targets={input.targets}
          movable={input.movable} last={anim.last} onSquare={(sq) => { if (pending) { if (enabled && pending.options.includes(sq)) pickPiece(sq); } else input.onSquare(sq); }} pick={pending ? pending.options : []} label={t.checkersName} dama={ruleset === 'dama'} hint={hint} onSwipe={input.onSwipe} hideTargets={ruleset === 'dama'} heroes={players.map((p) => p.hero)}
        />
      )}
      overlay={finished && (
        <ResultOverlay title={title} tone={tone} sub={ckReason(t, game.reason, game.board)} score={c}>
          <button className="btn primary" onClick={again}>{t.playAgain}</button>
          <button className="btn" onClick={onExit}>{t.backHome}</button>
        </ResultOverlay>
      )}
    >
      <div className="match-actions">
        {input.canStop && <button className="btn primary" onClick={input.stopChain}>⏹ {t.stopChain}</button>}
        {mode === 'ai' && <button className="btn" disabled={!canUndo} onClick={undo}>↶ {t.undo}</button>}
        {mode === 'ai' && <button className="btn" disabled={!enabled || hintsLeft <= 0} onClick={askHint}>💡 {t.hint} ({hintsLeft})</button>}
        <button className="btn ghost" onClick={onLeave || onExit}>{t.leave}</button>
      </div>
    </MatchFrame>
  );
}
