'use client';
import React from 'react';
import { GAMES } from '@/lib/games';
import { GameIcon } from './GameIcons';
import { PracticeNote } from './Wallet';

/** Second screen: after choosing a game, pick how to play. Big two-per-row tiles. */
export default function ModesScreen({ t, lang, game, go, onlineOn }) {
  const g = GAMES[game] || {};
  const offlineOnly = !!g.offlineOnly;
  const tiles = [
    { id: 'ai', c: '#F2B632', icon: '🤖', title: t.playComputer, sub: t.playComputerSub, tag: t.badgeOffline },
    ...(!g.noPass ? [{ id: 'pass', c: '#35E0C2', icon: '🤝', title: t.passPlay, sub: t.passPlaySub, tag: t.badgeOffline }] : []),
    ...(!offlineOnly ? [{ id: 'online', c: '#FF5C8A', icon: '🌍', title: t.playFriendOnline, sub: t.playFriendOnlineSub, tag: t.badgeOnline, live: onlineOn }] : []),
    ...(!offlineOnly ? [{ id: 'leaders', c: '#8E7CFF', icon: '🏆', title: t.leaderboard }] : []),
    { id: 'rules', c: '#4FA3FF', icon: '📖', title: t.rules },
    { id: 'progress', c: '#FF8A3D', icon: '🔥', title: t.progress },
  ];
  return (
    <div className="modes" style={{ '--accent': g.accent || '#F2B632' }}>
      <div className="modes-hero">
        <span className="modes-badge"><GameIcon game={game} size={52} /></span>
        <div><h1>{t[`${game}Name`]}</h1><p>{t.chooseMode}</p></div>
      </div>
      <div className="modes-grid">
        {tiles.map((m, i) => (
          <button key={m.id} type="button" className={`mode-tile${m.sub ? ' big' : ' small'}`} style={{ '--c': m.c, '--i': i }} onClick={() => go(m.id)}>
            {m.tag && <span className={`mode-tag${m.live ? ' live' : ''}`}>{m.tag}</span>}
            <span className="mode-ico" aria-hidden="true">{m.icon}</span>
            <b className="mode-title">{m.title}</b>
            {m.sub && <small className="mode-sub">{m.sub}</small>}
          </button>
        ))}
      </div>
      {onlineOn && !offlineOnly && <PracticeNote lang={lang} />}
    </div>
  );
}
