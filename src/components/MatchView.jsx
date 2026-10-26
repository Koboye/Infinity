'use client';
import React, { useEffect, useRef } from 'react';
import { sfx } from '@/lib/sound';
import Board from './Board';
import { heroById } from '@/lib/i18n';
import { famText } from '@/lib/gebeta/engine.js';
import { TURN_SECONDS } from '@/lib/games.js';

export function PlayerCard({ player, score, active, timer, timerMax = TURN_SECONDS, pos, emote, t, badge, scoreLabel }) {
  const hero = heroById(player.hero);
  return (
    <div className={`pcard ${pos}${active ? ' on' : ''}${timer != null ? ' clocked' : ''}`} style={timer != null ? { '--p': Math.max(0, Math.min(1, timer / timerMax)) } : undefined}>
      <span className={`hero${player.photo ? ' photo' : ''}`} style={{ background: hero.color }}>{player.photo ? <img src={player.photo} alt="" /> : hero.glyph}</span>
      <span className="pname">{player.name}</span>
      {badge}
      {timer != null && <span className={`timer${timer <= 10 ? ' low' : ''}`}>{t.timeLeft(timer)}</span>}
      <span className="pscore" aria-label={`${score} ${scoreLabel || t.seedsLabel}`}>{score}</span>
      {emote && <span className="emote" key={emote.k}>{emote.text}</span>}
    </div>
  );
}

/**
 * Game-agnostic match chrome: opponent card on top, the game's own `board` in the middle,
 * your card below, a status line, optional controls (children) and an overlay.
 * `scores` is indexed by seat; `badges` (optional) by seat as well.
 */
export function MatchFrame({
  t, players, viewSeat = 0, turn, scores, timer, emotes, status, board, children, overlay, flash, badges, scoreLabel, boardClass = '',
}) {
  const top = 1 - viewSeat;
  // One consistent clock behaviour in every game, offline or online: a tick for each of the last five seconds (only for the human side).
  const left = timer ? timer.left : null, tickSeat = timer ? timer.seat : null, prevLeft = useRef(null);
  useEffect(() => {
    if (left != null && prevLeft.current != null && left !== prevLeft.current && left > 0 && left <= 5 && tickSeat === viewSeat) sfx.tick();
    prevLeft.current = left;
  }, [left, tickSeat, viewSeat]);
  return (
    <div className="match">
      <PlayerCard player={players[top]} score={scores[top]} active={turn === top} timer={timer?.seat === top ? timer.left : null} timerMax={timer?.max} pos="top" emote={emotes?.[top]} t={t} badge={badges?.[top]} scoreLabel={scoreLabel} />
      <div className={`board-wrap ${boardClass}`}>
        {board}
        {flash && <div className={`flash ${flash.kind}`} key={flash.k}>{flash.text}</div>}
      </div>
      <PlayerCard player={players[viewSeat]} score={scores[viewSeat]} active={turn === viewSeat} timer={timer?.seat === viewSeat ? timer.left : null} timerMax={timer?.max} pos="bottom" emote={emotes?.[viewSeat]} t={t} badge={badges?.[viewSeat]} scoreLabel={scoreLabel} />
      <div className="status" aria-live="polite">{status}</div>
      {children}
      {overlay}
    </div>
  );
}

/** Gebeta's match view (kept for the seed game). */
export default function MatchView({ pits, own = null, flag = null, raw = false, flash: _noFlash, viewSeat = 0, isLegal, canCollect, onPit, active, hand: _hand, t, hintPit = null, ruleset = null, ...rest }) {
  return (
    <MatchFrame
      t={t} viewSeat={viewSeat} scores={raw ? [pits[6], pits[13]] : [famText(pits[6]), famText(pits[13])]} scoreLabel={t.familiesLabel}
      badges={viewSeat === 1
        ? [<i key="b" className="stone-dot seed b" aria-hidden="true" />, <i key="a" className="stone-dot seed a" aria-hidden="true" />]
        : [<i key="a" className="stone-dot seed a" aria-hidden="true" />, <i key="b" className="stone-dot seed b" aria-hidden="true" />]}
      board={<Board pits={pits} own={own} flag={flag} viewSeat={viewSeat} isLegal={isLegal} canCollect={canCollect} onPit={onPit} active={active} storeLabel={t.store} hintPit={hintPit} ruleset={ruleset} />}
      {...rest}
    />
  );
}
