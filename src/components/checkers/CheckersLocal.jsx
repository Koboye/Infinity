'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newGame, playMove, resolveHuff, legalMoves, counts, suddenDeath, forfeit, capturers, getRules, seatOf, ULTRA_MAX } from '@/lib/checkers/engine.js';
import { chooseCheckersMove } from '@/lib/checkers/ai.js';
import { chooseCheckersMoveAsync, chooseHuffPickAsync } from '@/lib/checkers/aiClient.js';
import { thinkWaitMs } from '@/lib/games.js';
import { sfx } from '@/lib/sound';
import { useCheckersAnimator } from './useCheckersAnimator';
import { useCheckersInput } from './useCheckersInput';
import CheckersBoard from './CheckersBoard';
import { MatchFrame } from '../MatchView';
import ResultOverlay from '../ResultOverlay';
import SpinOverlay from '../SpinOverlay';
import { drawStarter } from '@/lib/starter.js';
import { useTurnClock } from '../useTurnClock';

export const ckReason = (t, r, board) => {
  if (r === 'blocked' && board && (counts(board)[0] === 0 || counts(board)[1] === 0)) return t.rCaptured;
  return ({ blocked: t.rBlocked, repetition: t.rRepetition, moves: t.rMoves, agreed: t.rAgreed, timeout: t.rTimeout }[r] || '');
};
export const SideDot = ({ seat, t }) => <span className={`side-dot s${seat}`} title={seat === 0 ? t.dark : t.light} />;

/** Offline checkers: vs computer (human is Dark, seat 0) or pass-and-play on one device. */
export default function CheckersLocal({ t, mode, level, ruleset, me, opts = {}, onExit, onLeave }) {
  const [first0] = useState(() => drawStarter(`checkers-${mode}`));   // the first game: a spin wheel shows the lottery result
  const firstRef = useRef(first0);                                  // later games alternate the opener (X, Y, X, Y …)
  const [spinning, setSpinning] = useState(true);
  const [game, setGame] = useState(() => newGame(ruleset, { ultra: !!opts.ultra, first: first0 }));
  const [startNote, setStartNote] = useState(true);
  const [pre, setPre] = useState(null);        // premove: { from, to }
  const [note, setNote] = useState('');
  const [sdInfo, setSdInfo] = useState('');
  const [round, setRound] = useState(0);
  useEffect(() => { setStartNote(true); const id = setTimeout(() => setStartNote(false), 2800); return () => clearTimeout(id); }, [round]);
  const [hint, setHint] = useState(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hist, setHist] = useState([]);
  const gameRef = useRef(game);
  const doneSound = useRef(false);
  const anim = useCheckersAnimator(game.board, t);

  const players = mode === 'ai'
    ? [{ name: me.name, hero: me.hero }, { name: t.computer, hero: 'horse' }]
    : [{ name: t.player1, hero: 'lion' }, { name: t.player2, hero: 'queen' }];

  const free = !!getRules(ruleset).huff; // capturing is optional: nothing is forced, nothing is highlighted, a skipped capture can be claimed
  const moves = useMemo(() => (game.over ? [] : legalMoves(game, ruleset)), [game, ruleset]);
  const humanTurn = mode === 'pass' || game.turn === 0;
  const enabled = !anim.busy && !game.over && humanTurn && !spinning;

  const play = useCallback((move) => {
    const r = playMove(gameRef.current, move.from, move.path, ruleset);
    if (!r.ok) return;
    setStartNote(false);
    if (mode === 'ai' && gameRef.current.turn === 0) setHist((h) => [...h, gameRef.current].slice(-10));
    gameRef.current = r.state;
    setGame(r.state);
    anim.enqueue({ hops: r.hops, final: r.state.board, promote: r.promoted, huffed: r.huffed });
    if (r.extraTurn) { sfx.king(); setNote(t.ultraExtra); setTimeout(() => setNote(''), 2200); }
  }, [anim, ruleset, mode, t]);

  // Huff forfeit: after a missed capture the player to move MAY touch the piece that missed it and remove it (free action,
  // his turn goes on). Nothing on screen says it is possible; if he just plays a move the claim is gone.
  const pending = game.pendingHuff || null;
  const pickPiece = useCallback((square) => {
    const r = resolveHuff(gameRef.current, square, ruleset);
    if (!r.ok) return;
    gameRef.current = r.state;
    setGame(r.state);
    anim.enqueue({ hops: [], final: r.state.board, promote: false, huffed: r.huffed });
  }, [anim, ruleset]);

  const input = useCheckersInput({ moves, enabled, onMove: play, resetKey: `${round}:${game.turn}:${game.noProgress}:${game.board.join('')}`, strict: free });


  // ── Premove: while the opponent thinks, pick a piece and a square; it plays the instant your turn starts. ──
  const noteLater = (text) => { setNote(text); setTimeout(() => setNote(''), 2200); };
  const premoveTap = (sq) => {
    const g = gameRef.current;
    const mine = g.board[sq] && seatOf(g.board[sq]) === 0;
    if (mine) { sfx.tap(); setPre(pre && pre.from === sq && pre.to == null ? null : { from: sq, to: null }); return; }
    if (pre && pre.from != null) { sfx.tap(); setPre({ from: pre.from, to: sq }); noteLater(t.premoveSet); }
  };
  useEffect(() => {
    if (!pre || pre.to == null || !enabled) return;
    const cand = moves.filter((m) => m.from === pre.from && m.path[m.path.length - 1] === pre.to).sort((a, b) => b.caps.length - a.caps.length);
    setPre(null);
    const m = cand.find((x) => !x.more) || null;
    const rules = getRules(ruleset);
    // No piece is ever obliged to capture, so a premove is never second-guessed (nothing is revealed)
    if (!m) { sfx.pass(); return; }
    play(m);
  }, [pre, enabled, moves, game, ruleset, play, t]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sudden Death: after 5 minutes one piece per side falls every 30 seconds ──
  const startedAt = useRef(Date.now());
  const sdTicks = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); sdTicks.current = 0; setSdInfo(''); }, [round]);
  useEffect(() => {
    if (!opts.suddenDeath || game.over) return undefined;
    const id = setInterval(() => {
      const el = (Date.now() - startedAt.current) / 1000;
      if (el < 300) { if (el > 270) setSdInfo(t.sdWarn(Math.ceil(300 - el))); return; }
      const due = Math.floor((el - 300) / 30) + 1;
      setSdInfo(t.sdNext(Math.max(0, Math.ceil(300 + due * 30 - el))));
      if (due > sdTicks.current && !anim.busy && !gameRef.current.pendingHuff && !gameRef.current.over) {
        const r = suddenDeath(gameRef.current, ruleset);
        if (!r.ok) return;
        sdTicks.current = due;
        gameRef.current = r.state; setGame(r.state); anim.reset(r.state.board); sfx.jump(); noteLater(t.sdHit);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [opts.suddenDeath, game.over, anim, ruleset, t]); // eslint-disable-line react-hooks/exhaustive-deps

  // Computer's turn: it waits 2.5–3.5 s (a different random time each turn, same as every other game) while its search runs in a worker;
  // the move is played when BOTH the wait and the search are done.
  const thinkRef = useRef({ game: null, at: 0, ms: 0 });
  useEffect(() => {
    if (mode !== 'ai' || game.over || game.turn !== 1 || anim.busy || spinning) return;
    if (thinkRef.current.game !== game) thinkRef.current = { game, at: Date.now(), ms: thinkWaitMs() };
    const { at, ms } = thinkRef.current;
    let cancelled = false, timer;
    const waited = new Promise((r) => { timer = setTimeout(r, Math.max(0, at + ms - Date.now())); });
    const snap = game;
    const job = snap.pendingHuff ? chooseHuffPickAsync(snap, ruleset) : chooseCheckersMoveAsync(snap, ruleset, opts.careless && free ? 'easy' : level);
    Promise.all([job, waited]).then(([m]) => {
      if (cancelled || gameRef.current !== snap || m == null) return;
      if (snap.pendingHuff) pickPiece(m); else play(m);
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mode, game, anim.busy, level, ruleset, play, pickPiece, pending, spinning]); // eslint-disable-line react-hooks/exhaustive-deps

  const clock = useTurnClock({
    running: enabled, seat: game.turn, resetKey: `${round}:${game.turn}:${game.board.join('')}`,
    onExpire: () => {
      const m = chooseCheckersMove(gameRef.current, ruleset, 'easy'); if (m) { play(m); noteLater(t.autoPlayed); } // out of time: a move is played for you (a claim is never made for you)
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
    if (free || hintsLeft <= 0 || !enabled || mode !== 'ai') return; // with optional capture the game never tells you what to play
    const snap = gameRef.current;
    setHintsLeft((n) => n - 1); sfx.tap();
    chooseCheckersMoveAsync(snap, ruleset, 'hard').then((m) => {
      if (!m || gameRef.current !== snap) return;
      setHint({ from: m.from, to: m.path[0] });
      setTimeout(() => setHint(null), 2500);
    });
  };
  const canUndo = mode === 'ai' && hist.length > 0 && !anim.busy && !game.over && game.turn === 0;
  const undo = () => {
    if (!canUndo) return;
    const prev = hist[hist.length - 1]; setHist(hist.slice(0, -1)); setHint(null);
    gameRef.current = prev; setGame(prev); anim.reset(prev.board); sfx.tap();
  };
  const again = () => { setHist([]); setPre(null); setHint(null); setHintsLeft(3); firstRef.current = 1 - firstRef.current; const g = newGame(ruleset, { ultra: !!opts.ultra, first: firstRef.current }); gameRef.current = g; setStartNote(true); doneSound.current = false; setGame(g); anim.reset(g.board); setRound((r) => r + 1); };

  const c = counts(game.board);
  let status = '';
  if (!game.over) {
    if (mode === 'ai') status = game.turn === 0 ? t.yourTurn : t.theirTurn(t.computer);
    else status = t.theirTurn(players[game.turn].name);
  }

  if (startNote && !game.over) status = t.lotteryStart(players[game.turn].name);
  if (note && !game.over) status = note;

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
          pieces={anim.pieces} viewSeat={0} selected={input.from ?? (game.turn === 1 ? pre?.from ?? null : null)} picked={input.picked} targets={input.targets}
          movable={input.movable} last={anim.last} onSquare={(sq) => { if (spinning) return; if (pending && enabled && pending.options.includes(sq)) pickPiece(sq); else if (mode === 'ai' && game.turn === 1 && !game.over) premoveTap(sq); else input.onSquare(sq); }} pick={[]} showMovable={!free} label={t.checkersName} hint={pre && pre.to != null ? { from: pre.from, to: pre.to } : hint} onSwipe={input.onSwipe} heroes={players.map((p) => p.hero)} fx={anim.fx} shake={anim.shake}
        />
      )}
      overlay={spinning ? <SpinOverlay t={t} names={players.map((p) => p.name)} winner={first0} onDone={() => setSpinning(false)} /> : finished && (
        <ResultOverlay title={title} tone={tone} sub={ckReason(t, game.reason, game.board)} score={c}>
          <button className="btn primary" onClick={again}>{t.playAgain}</button>
          <button className="btn" onClick={onExit}>{t.backHome}</button>
        </ResultOverlay>
      )}
    >
      {(game.ultra || sdInfo) && (
        <div className="ultra-bar" aria-live="off">
          {game.ultra && <span className="umeter" title={t.ultraMeter}>⚡ {t.ultraLabel} {'●'.repeat(game.ultra[0])}{'○'.repeat(ULTRA_MAX - game.ultra[0])}</span>}
          {sdInfo && <span className="usd">☠ {sdInfo}</span>}
        </div>
      )}
      <div className="match-actions">
        {input.canStop && <button className="btn primary" onClick={input.stopChain}>⏹ {t.stopChain}</button>}
        {mode === 'ai' && <button className="btn" disabled={!canUndo} onClick={undo}>↶ {t.undo}</button>}
        {mode === 'ai' && !free && <button className="btn" disabled={!enabled || hintsLeft <= 0} onClick={askHint}>💡 {t.hint} ({hintsLeft})</button>}
        <button className="btn ghost" onClick={onLeave || onExit}>{t.leave}</button>
      </div>
    </MatchFrame>
  );
}
