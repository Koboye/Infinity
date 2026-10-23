'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { newMatch, dealRound, playTile, drawTile, mustDraw as engineMustDraw, getRules } from '@/lib/dominoes/engine.js';
import { chooseDominoPlay } from '@/lib/dominoes/ai.js';
import { sfx } from '@/lib/sound';
import { MatchFrame } from '../MatchView';
import ResultOverlay from '../ResultOverlay';
import DominoTable from './Table';
import RoundOverlay from './RoundOverlay';

/** Offline dominoes: vs computer (you are seat 0) or pass-and-play (a curtain hides each hand between turns). */
export default function DominoesLocal({ t, mode, level, ruleset, target, me, onExit, onLeave }) {
  const [game, setGame] = useState(() => newMatch(ruleset, target));
  const [round, setRound] = useState(0);
  const [flash, setFlash] = useState(null);
  const [lastCode, setLastCode] = useState(null);
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
    const r = playTile(gameRef.current, tile, end);
    if (!r.ok) return;
    sfx.place(); setLastCode(`${r.tile[0]}${r.tile[1]}`);
    commit(r.state); announcePasses(r.autoPasses);
  }, []); // eslint-disable-line
  const doDraw = useCallback(() => {
    const r = drawTile(gameRef.current);
    if (!r.ok) return;
    sfx.draw(); commit(r.state); announcePasses(r.autoPasses);
  }, []); // eslint-disable-line

  const humanSeat = mode === 'ai' ? 0 : game.turn;
  const playing = game.phase === 'play';
  const aiTurn = mode === 'ai' && playing && game.turn === 1;
  const needCurtain = mode === 'pass' && playing && curtainFor !== game.turn;
  const myTurn = playing && !aiTurn && !needCurtain;
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

  const over = game.phase === 'over';
  useEffect(() => {
    if (!over || doneSound.current) return;
    doneSound.current = true;
    (mode === 'ai' && game.winner === 1) ? sfx.lose() : sfx.win();
  }, [over, game.winner, mode]);

  const nextRound = () => { setCurtainFor(null); setLastCode(null); commit(dealRound(gameRef.current)); };
  const again = () => { const g = newMatch(ruleset, target); gameRef.current = g; doneSound.current = false; setGame(g); setRound((r) => r + 1); setCurtainFor(null); setLastCode(null); };

  let status = '';
  if (playing) {
    if (aiTurn) status = t.theirTurn(t.computer);
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
      flash={flash} status={status}
      badges={[0, 1].map((s) => <span key={s} className="side-dot-txt">{t.tilesLeft(game.hands[s].length)}</span>)}
      board={(
        <DominoTable
          t={t} chain={game.chain} hand={showHand} oppCount={game.hands[oppSeat].length} boneyardCount={game.boneyard.length}
          drawing={drawing} myTurn={myTurn} mustDraw={myTurn && mustDraw} mustLead={game.mustLead}
          onPlay={doPlay} onDraw={doDraw} lastCode={lastCode} hideHand={needCurtain}
        />
      )}
      overlay={(
        <>
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
      <div className="match-actions"><button className="btn ghost" onClick={onLeave || onExit}>{t.leave}</button></div>
    </MatchFrame>
  );
}
