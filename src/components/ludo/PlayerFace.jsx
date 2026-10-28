import React from 'react';

/**
 * A player's profile picture with the turn timer drawn as a ring round it. The ring is the same size as the die beside it
 * (both take their size from the panel's --sz). On the player's turn the ring in their colour drains from full to empty as the
 * seconds run out and turns red for the last five; the remaining seconds sit in a small badge on the ring. Off-turn the ring is
 * a quiet full circle in the player's colour.
 */
export default function PlayerFace({ photo = null, glyph = '?', left = null, max = 1, on = false, label = 'timer' }) {
  const timed = on && left != null, frac = timed ? Math.max(0, Math.min(1, left / Math.max(1, max))) : 1, low = timed && left <= 5;
  return (
    <div className={`pf${on ? ' on' : ''}${timed ? ' timed' : ''}${low ? ' low' : ''}`} {...(timed ? { role: 'timer', 'aria-label': `${label}: ${left}` } : {})}>
      <svg className="pf-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="trk" cx="50" cy="50" r="45" />
        <circle className="prog" cx="50" cy="50" r="45" pathLength="1" style={{ strokeDashoffset: 1 - frac }} />
      </svg>
      <span className={`pf-av${photo ? ' photo' : ''}`}>{photo ? <img src={photo} alt="" /> : glyph}</span>
      {timed && <b className="pf-secs">{left}</b>}
    </div>
  );
}
