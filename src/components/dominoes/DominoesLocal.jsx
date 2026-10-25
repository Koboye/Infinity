'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { newMatch, dealRound, playTile, drawTile, mustDraw as engineMustDraw, getRules } from '@/lib/dominoes/engine.js';
import { chooseDominoPlay } from '@/lib/dominoes/ai.js';
import { sfx } from '@/lib/sound';
import { MatchFrame } from '../MatchView';
import ResultOverlay from '../ResultOverlay';
import DominoTable from './Table';
import RoundOverlay from './RoundOverlay';
import { useTurnClock } from '../useTurnClock';
import SpinOverlay from '../SpinOverlay';

/** Offline dominoes: vs computer (you are seat 0) or pass-and-play (a curtain hides each hand between turns). */
export default function DominoesLocal({ t, mode, level, ruleset, target, me, onExit, onLeave }) {
  const [game, setGame] = useState(() => newMatch(ruleset, target));
  const [round, setRound] = useState(0);
  const [spinning, setSpinning] = useState(true); // the first round opens with a spin wheel (the coin was already tossed)
  const [first0] = useState(() => game.turn);
  const [flash, setFlash] = useState(null);
  const [lastCode, setLastCode] = useState(null);
  const [hintTile, setHintTile] = useState(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hist, setHist] = useState([]);
  const [curtainFor, setCurtainFor] = useState(null); // pass-and-play: seat that has confirmed they are looking
  const gameRef = useRef(game);
  const doneSound = useRef(false);
  const flashTimer = useRef(null);

  const players = mode === 'ai'
    ? [{ name: me.name, hero: me.hero }, { name: t.computer, hero: 'shield' }]
    : [{ name: t.player1, hero: 'lion' }, { name: t.player2, hero: 'queen' }];
  const names = players.map((p) => p.name);
  const drawing = getRules(ruleset).drawing;

  const say = (text, kind = 'extra') => {
    clearTimeout(flashTimer.current);
    setFlash({ text, kind, k: Math.random() });
    flashTimer.current = setTimeout(() => setFlash(null), 1300);
  };
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const commit = (s) => { gameRef.current = s; setGame(s); };
  const announcePasses = (list) => list.forEach((seat) => { sfx.pass(); say(t.passedMsg(names[seat]), 'relay'); });

  const doPlay = useCallback((tile, end) => {
    setHintTile(null);
    if (mode === 'ai' && gameRef.current.turn === 0) setHist((h) => [...h, gameRef.current].slice(-10));
    const r = playTile(gameRef.current, tile, end);
    if (!r.ok) return;
    sfx.place(); setLastCode(`${r.tile[0]}${r.tile[1]}`);
    commit(r.state); announcePasses(r.autoPasses);
  }, []); // eslint-disable-line
  const doDraw = useCallback(() => {
    if (mode === 'ai' && gameRef.current.turn === 0) setHist((h) => [...h, gameRef.current].slice(-10));
    const r = drawTile(gameRef.current);
    if (!r.ok) return;
    sfx.draw(); commit(r.state); announcePasses(r.autoPasses);
  }, []); // eslint-disable-line

  const humanSeat = mode === 'ai' ? 0 : game.turn;
  const playing = game.phase === 'play';
  const aiTurn = mode === 'ai' && playing && game.turn === 1 && !spinning;
  const needCurtain = mode === 'pass' && playing && curtainFor !== game.turn && !spinning;
  const myTurn = playing && !spinning && !(mode === 'ai' && game.turn === 1) && !needCurtain;
  const mustDraw = playing && engineMustDraw(game);

  // Computer's move (drawing one tile at a time so you can see it)
  useEffect(() => {
    if (!aiTurn) return undefined;
    const id = setTimeout(() => {
      const g = gameRef.current;
      if (engineMustDraw(g)) { doDraw(); return; }
      const p = chooseDominoPlay(g, level);
      if (p) doPlay(p.tile, p.end);
    }, 750);
    return () => clearTimeout(id);
  }, [aiTurn, game, level, doPlay, doDraw]);

  const clock = useTurnClock({
    running: myTurn, seat: game.turn, resetKey: `${round}:${game.turn}:${game.chain.length}:${game.boneyard.length}:${game.hands[0].length}:${game.hands[1].length}`,
    onExpire: () => {
      const g = gameRef.current;
      if (engineMustDraw(g)) { doDraw(); return; }
      const p = chooseDominoPlay(g, 'easy'); if (p) doPlay(p.tile, p.end);
    },
  });
  const over = game.phase === 'over';
  useEffect(() => {
    if (!over || doneSound.current) return;
    doneSound.current = true;
    (mode === 'ai' && game.winner === 1) ? sfx.lose() : sfx.win();
  }, [over, game.winner, mode]);

  const askHint = () => {
    if (hintsLeft <= 0 || !myTurn || mode !== 'ai' || mustDraw) return;
    const p = chooseDominoPlay(gameRef.current, 'hard'); if (!p) return;
    setHintsLeft((n) => n - 1); setHintTile(p.tile); sfx.tap();
  };
  const canUndo = mode === 'ai' && hist.length > 0 && playing && game.turn === 0 && !aiTurn;
  const undo = () => {
    if (!canUndo) return;
    const prev = hist[hist.length - 1]; setHist(hist.slice(0, -1)); setHintTile(null);
    commit(prev); sfx.tap();
  };
  const nextRound = () => { setCurtainFor(null); setLastCode(null); commit(dealRound(gameRef.current)); };
  const again = () => { setSpinning(false); setHist([]); setHintTile(null); setHintsLeft(3); const g = newMatch(ruleset, target); gameRef.current = g; doneSound.current = false; setGame(g); setRound((r) => r + 1); setCurtainFor(null); setLastCode(null); };

  let status = '';
  const fresh = game.round === 1 && !game.chain.length && game.hands.every((h) => h.length === (getRules(ruleset).hand));
  if (playing) {
    if (fresh) status = t.lotteryStart(names[game.turn]);
    else if (aiTurn) status = t.theirTurn(t.computer);
    else if (mustDraw) status = t.mustDrawMsg;
    else if (game.mustLead && !game.chain.length) status = `${mode === 'ai' ? t.yourTurn : t.theirTurn(names[game.turn])} · ${t.leadHint}`;
    else status = mode === 'ai' ? t.yourTurn : t.theirTurn(names[game.turn]);
  }

  let title, tone = 'win';
  if (mode === 'ai') { title = game.winner === 0 ? t.youWin : t.youLose; tone = game.winner === 0 ? 'win' : 'lose'; }
  else title = t.wins(names[game.winner] || '');

  const viewSeat = mode === 'ai' ? 0 : humanSeat;
  const oppSeat = 1 - viewSeat;
  const showHand = game.hands[viewSeat];

  return (
    <MatchFrame
      key={round} t={t} players={players} viewSeat={viewSeat} turn={playing ? game.turn : -1} scores={game.scores} scoreLabel={t.points}
      flash={flash} status={status} timer={clock}
      badges={[0, 1].map((s) => <span key={s} className="side-dot-txt">{t.tilesLeft(game.hands[s].length)}</span>)}
      board={(
        <DominoTable
          t={t} chain={game.chain} hand={showHand} oppCount={game.hands[oppSeat].length} boneyardCount={game.boneyard.length}
          drawing={drawing} myTurn={myTurn} mustDraw={myTurn && mustDraw} mustLead={game.mustLead}
          onPlay={doPlay} onDraw={doDraw} lastCode={lastCode} hideHand={needCurtain} hintTile={hintTile}
        />
      )}
      overlay={(
        <>
          {spinning && <SpinOverlay t={t} names={names} winner={first0} onDone={() => setSpinning(false)} />}
          {needCurtain && (
            <div className="overlay curtain" role="dialog" aria-modal="true">
              <div className="dialog">
                <p>{t.passPhone(names[game.turn])}</p>
                <button className="btn primary" onClick={() => setCurtainFor(game.turn)}>{t.tapReady}</button>
              </div>
            </div>
          )}
          {game.phase === 'roundOver' && (
            <RoundOverlay t={t} names={names} result={game.roundResult} scores={game.scores} target={game.target} onNext={nextRound} />
          )}
          {over && (
            <ResultOverlay title={title} tone={tone} sub={t.playTo(game.target)} score={game.scores}>
              <button className="btn primary" onClick={again}>{t.playAgain}</button>
              <button className="btn" onClick={onExit}>{t.backHome}</button>
            </ResultOverlay>
          )}
        </>
      )}
    >
      <div className="match-actions">
        {mode === 'ai' && <button className="btn" disabled={!canUndo} onClick={undo}>↶ {t.undo}</button>}
        {mode === 'ai' && <button className="btn" disabled={!myTurn || mustDraw || hintsLeft <= 0} onClick={askHint}>💡 {t.hint} ({hintsLeft})</button>}
        <button className="btn ghost" onClick={onLeave || onExit}>{t.leave}</button>
      </div>
    </MatchFrame>
  );
}
