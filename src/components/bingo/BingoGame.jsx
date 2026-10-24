'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  newGame, callNext, mark, canMark, claim, toGo, completed, letterOf, LETTERS, FREE, CALL_SECONDS, AI_LEVELS,
} from '@/lib/bingo/engine.js';
import { sfx } from '@/lib/sound';
import { speakBall, stopSpeaking, speechSupported } from '@/lib/speech';
import { MatchFrame } from '../MatchView';
import ResultOverlay from '../ResultOverlay';

const rand = (a, b) => a + Math.random() * (b - a);

/** Bingo vs the computer. Marking is manual: nothing tells you a called number is on your card. */
export default function BingoGame({ t, level, ruleset, me, onExit, onLeave }) {
  const [game, setGame] = useState(() => newGame(ruleset));
  const [round, setRound] = useState(0);
  const [secs, setSecs] = useState(3);          // seconds until the next call (the first one comes after 3)
  const [auto, setAuto] = useState(false);       // optional assist: mark my numbers for me
  const [shake, setShake] = useState(null);
  const [flash, setFlash] = useState(null);
  const [paused, setPaused] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const warnedAm = useRef(false);
  const pausedRef = useRef(false);
  const gameRef = useRef(game);
  const timers = useRef([]);
  const doneSound = useRef(false);
  const cfg = AI_LEVELS[level] || AI_LEVELS.medium;
  const players = [{ name: me.name, hero: me.hero }, { name: t.computer, hero: 'shield' }];

  const commit = useCallback((s) => { gameRef.current = s; setGame(s); }, []);
  // Timers that fire while the game is paused wait and try again, so nothing happens behind the pause screen.
  const later = useCallback((fn, ms) => {
    const run = () => { if (pausedRef.current) { const id2 = setTimeout(run, 250); timers.current.push(id2); return; } fn(); };
    const id = setTimeout(run, ms); timers.current.push(id);
  }, []);
  const say = useCallback((text, kind = 'extra') => { setFlash({ text, kind, k: Math.random() }); later(() => setFlash(null), 1400); }, [later]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); stopSpeaking(); }, []);

  // ── the caller: one ball every CALL_SECONDS ──
  useEffect(() => {
    if (game.over) return undefined;
    const id = setInterval(() => { if (pausedRef.current) return; setSecs((s) => { const n = s <= 1 ? 0 : s - 1; if (n > 0 && n <= 3) sfx.tick(); return n; }); }, 1000);
    return () => clearInterval(id);
  }, [game.over, round]);
  useEffect(() => {
    if (secs > 0 || gameRef.current.over) return;
    const s = callNext(gameRef.current);
    commit(s); setSecs(CALL_SECONDS); sfx.ball();
  }, [secs, commit]);

  // ── the computer reacts to each new ball ──
  const aiCheck = useCallback(() => {
    const s = gameRef.current;
    if (s.over) return;
    if (completed(s, 1) && s.lock[1] === 0) {
      later(() => {
        const cur = gameRef.current; if (cur.over) return;
        const r = claim(cur, 1); commit(r.state);
        if (r.ok) { sfx.bingoCall(); say(`${t.computer}: BINGO!`, 'relay'); }
      }, rand(...cfg.shout));
    }
  }, [cfg, commit, later]);
  const lastCalled = game.called[game.called.length - 1];
  // Read every new ball aloud, in the language the player chose (English or አማርኛ).
  useEffect(() => {
    if (lastCalled == null || !voiceOn) return;
    const lang = document.documentElement.lang === 'am' ? 'am' : 'en';
    const r = speakBall(lastCalled, lang);
    if (r === 'en-fallback' && !warnedAm.current) { warnedAm.current = true; say(t.noAmVoice || 'No Amharic voice on this phone — reading the balls in English.', 'relay'); }
  }, [lastCalled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (lastCalled == null) return;
    const s = gameRef.current;
    const idx = s.cards[1].indexOf(lastCalled);
    if (idx >= 0 && Math.random() >= cfg.miss) {
      later(() => {
        const cur = gameRef.current;
        if (cur.over || !canMark(cur, 1, idx)) return;
        commit(mark(cur, 1, idx)); aiCheck();
      }, rand(...cfg.mark));
    }
    if (auto) {
      const mine = s.cards[0].indexOf(lastCalled);
      if (mine >= 0) later(() => { const cur = gameRef.current; if (!cur.over && canMark(cur, 0, mine)) { commit(mark(cur, 0, mine)); sfx.tap(); } }, 500);
    }
  }, [lastCalled]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePause = () => { const p = !pausedRef.current; pausedRef.current = p; setPaused(p); if (p) stopSpeaking(); sfx.tap(); };
  const toggleVoice = () => { const v = !voiceOn; setVoiceOn(v); if (!v) stopSpeaking(); else if (lastCalled) speakBall(lastCalled, document.documentElement.lang === 'am' ? 'am' : 'en'); sfx.tap(); };
  const tapCell = (i) => {
    const s = gameRef.current;
    if (pausedRef.current || s.over || i === FREE || s.marks[0][i]) return;
    if (!canMark(s, 0, i)) { setShake(i); later(() => setShake(null), 400); sfx.pass(); return; } // not called (yet)
    commit(mark(s, 0, i)); sfx.place();
  };
  const shout = () => {
    const s = gameRef.current;
    if (s.over || pausedRef.current) return;
    const r = claim(s, 0); commit(r.state);
    if (r.ok) { sfx.bingoCall(); say('BINGO!', 'capture'); } else if (r.error === 'false') { sfx.pass(); say(t.bingoFalse, 'relay'); }
  };

  const finished = game.over;
  useEffect(() => {
    if (!finished || doneSound.current) return;
    doneSound.current = true;
    if (game.winner === 1) sfx.lose(); else if (game.winner === 0) sfx.cheer();
  }, [finished, game.winner]);
  const again = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    const g = newGame(ruleset); gameRef.current = g; doneSound.current = false; setGame(g); setSecs(3); pausedRef.current = false; setPaused(false); setRound((r) => r + 1);
  };

    const winLine = game.winner === 0 || game.winner === 1 ? game.winLine : null;
  const locked = game.lock[0] > 0;
  const mine = game.cards[0];
  const toGoMe = toGo(game, 0), toGoAi = toGo(game, 1);

  let title, tone = 'win';
  if (game.winner === 'draw') { title = t.draw; tone = 'draw'; }
  else { title = game.winner === 0 ? t.youWin : t.youLose; tone = game.winner === 0 ? 'win' : 'lose'; }

  const status = game.over ? '' : locked ? t.bingoLocked(game.lock[0]) : game.called.length ? t.bingoStatus : t.bingoStart;

  const ball = lastCalled ? `${letterOf(lastCalled)}${lastCalled}` : '—';
  const recent = game.called.slice(-6, -1).reverse();

  const board = (
    <div className="bingo" key={round}>
      <div className="bingo-caller" aria-live="polite">
        <div className={`bball l${lastCalled ? 'BINGO'.indexOf(letterOf(lastCalled)) : 5}`} key={lastCalled || 0}>
          <small>{lastCalled ? letterOf(lastCalled) : ''}</small><b>{lastCalled || '—'}</b>
        </div>
        <div className="bcall-meta">
          <span className="bnext" aria-label={t.bingoNext(secs)}><i style={{ '--p': `${(secs / CALL_SECONDS) * 100}%` }} /><em>{game.over ? '' : secs}</em></span>
          <div className="brecent">{recent.map((n) => <span key={n} className={`bchip l${'BINGO'.indexOf(letterOf(n))}`}>{letterOf(n)}{n}</span>)}</div>
          <span className="bcount">{game.called.length}/75 · {t[`bingoR_${game.ruleset}`]}</span>
        </div>
      </div>
      <div className="bcard" role="grid" aria-label={t.bingoName}>
        {LETTERS.map((L, c) => <span key={L} className={`bhead l${c}`}>{L}</span>)}
        {mine.map((n, i) => {
          const m = game.marks[0][i];
          const cls = `bcell${i === FREE ? ' free' : ''}${m ? ' on' : ''}${shake === i ? ' shake' : ''}${winLine && winLine.includes(i) && game.winner === 0 ? ' win' : ''}`;
          return <button key={i} type="button" role="gridcell" className={cls} aria-pressed={m} onClick={() => tapCell(i)}>{i === FREE ? '★' : n}</button>;
        })}
      </div>
      <button type="button" className="bingo-btn" disabled={game.over || locked || paused} onClick={shout}>
        {t.bingoBtn}{locked ? ` · ${game.lock[0]}` : ''}
      </button>
      <div className="bside">
        <div className="bmini" aria-label={t.computer}>
          {game.cards[1].map((n, i) => <i key={i} className={`${game.marks[1][i] ? 'on' : ''}${winLine && winLine.includes(i) && game.winner === 1 ? ' win' : ''}`} />)}
        </div>
        <div className="bsheet" aria-label={t.bingoCalled}>
          {LETTERS.map((L, c) => (
            <div key={L} className="brow">
              <b className={`l${c}`}>{L}</b>
              {Array.from({ length: 15 }, (_, k) => c * 15 + k + 1).map((n) => <i key={n} className={game.called.includes(n) ? 'on' : ''}>{n}</i>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <MatchFrame
      key={round} t={t} players={players} viewSeat={0} turn={-1} scores={[toGoMe, toGoAi]} scoreLabel={t.bingoToGo}
      flash={flash} status={status} board={board} boardClass="bingo-wrap"
      overlay={paused && !finished ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t.paused || 'Paused'}>
          <div className="dialog coach">
            <h3>⏸ {t.paused || 'Paused'}</h3>
            <p>{t.pausedSub || 'The balls have stopped. Your card is hidden until you resume.'}</p>
            <div className="result-actions">
              <button className="btn ghost" onClick={onLeave || onExit}>{t.leave}</button>
              <button className="btn primary" onClick={togglePause}>▶ {t.resume || 'Resume'}</button>
            </div>
          </div>
        </div>
      ) : finished && (
        <ResultOverlay title={title} tone={tone} sub={game.winner === 'draw' ? '' : t.bingoWonBy(game.winner === 0 ? me.name : t.computer, game.called.length)}>
          <button className="btn primary" onClick={again}>{t.playAgain}</button>
          <button className="btn" onClick={onExit}>{t.backHome}</button>
        </ResultOverlay>
      )}
    >
      <div className="match-actions">
        {speechSupported() && <button className={`btn${voiceOn ? ' on' : ''}`} aria-pressed={voiceOn} onClick={toggleVoice}>{voiceOn ? '🔊' : '🔇'} {voiceOn ? (t.voiceOn || 'Voice on') : (t.voiceOff || 'Voice off')}</button>}
        <button className="btn" disabled={finished} onClick={togglePause}>{paused ? '▶' : '⏸'} {paused ? (t.resume || 'Resume') : (t.pause || 'Pause')}</button>
        <button className={`btn${auto ? ' on' : ''}`} aria-pressed={auto} onClick={() => setAuto((a) => !a)}>{auto ? '✓ ' : ''}{t.bingoAuto}</button>
        <button className="btn ghost" onClick={onLeave || onExit}>{t.leave}</button>
      </div>
    </MatchFrame>
  );
}
