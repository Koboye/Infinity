'use client';
import React, { useEffect, useState } from 'react';
import { playsFor, sameTile, ends } from '@/lib/dominoes/engine.js';
import { sfx } from '@/lib/sound';
import { Tile } from './Tile';
import Line from './Line';

const sortHand = (h) => h.slice().sort((x, y) => x[0] - y[0] || x[1] - y[1]);

/**
 * The dominoes play area, shared by offline and online games:
 * opponent's face-down tiles, the line, the boneyard, and your hand.
 */
export default function DominoTable({
  t, chain, hand, oppCount, boneyardCount, drawing, myTurn, mustDraw, mustLead, onPlay, onDraw, lastCode, hideHand = false, hint, hintTile = null,
}) {
  const [sel, setSel] = useState(null);
  useEffect(() => { setSel(null); }, [chain.length, myTurn]);

  const plays = myTurn && !hideHand ? playsFor(hand, chain, mustLead) : [];
  const playable = (tile) => plays.some((p) => sameTile(p.tile, tile));
  const e = ends(chain);

  const tapTile = (tile) => {
    if (!myTurn || hideHand) return;
    const options = plays.filter((p) => sameTile(p.tile, tile));
    if (!options.length) { sfx.tap(); return; }
    if (options.length === 1) { setSel(null); onPlay(tile, options[0].end); return; }
    setSel(sel && sameTile(sel, tile) ? null : tile);
  };
  const selOptions = sel ? plays.filter((p) => sameTile(p.tile, sel)) : [];

  return (
    <div className="dtable">
      <div className="dopp" aria-label={t.opponentHand}>
        {Array.from({ length: Math.min(oppCount, 14) }, (_, i) => <Tile key={i} back vertical className="mini" />)}
        <span className="dcount">{t.tilesLeft(oppCount)}</span>
      </div>

      <div className="dfelt">
        <Line chain={chain} lastCode={lastCode} emptyText={t.emptyTable} />
        {drawing && (
          <button type="button" className={`dyard${mustDraw ? ' pulse' : ''}`} onClick={onDraw} disabled={!mustDraw} aria-label={t.drawTile}>
            <span className="dstack"><Tile back vertical className="mini" /><Tile back vertical className="mini" /></span>
            <b>{boneyardCount}</b><small>{mustDraw ? t.drawTile : t.boneyard}</small>
          </button>
        )}
      </div>

      {selOptions.length > 1 && (
        <div className="dchoose" role="group" aria-label={t.chooseEnd}>
          <span>{t.chooseEnd}</span>
          {selOptions.map((p) => (
            <button key={p.end} className="btn primary" onClick={() => { const tile = sel; setSel(null); onPlay(tile, p.end); }}>
              {p.end === 'L' ? `◀ ${t.leftEnd} (${e[0]})` : `${t.rightEnd} (${e[1]}) ▶`}
            </button>
          ))}
        </div>
      )}

      <div className="dhand" aria-label={t.yourHand}>
        {hideHand
          ? Array.from({ length: hand.length }, (_, i) => <Tile key={i} back vertical className="hand" />)
          : sortHand(hand).map((tile) => {
            const ok = playable(tile);
            const selected = sel && sameTile(sel, tile);
            return (
              <Tile
                key={`${tile[0]}${tile[1]}`} a={tile[0]} b={tile[1]} vertical onClick={() => tapTile(tile)}
                className={`hand${myTurn ? (ok ? ' ok' : ' dim') : ''}${selected ? ' picked' : ''}${hintTile && sameTile(hintTile, tile) ? ' hinted' : ''}`}
              />
            );
          })}
      </div>
      {hint && <p className="dhint">{hint}</p>}
    </div>
  );
}
