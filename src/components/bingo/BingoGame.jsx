'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  newGame, callNext, mark, canMark, claim, toGo, completed, cardsOf, chestAt, instantDaub, doubleDaub, grantShield,
  letterOf, LETTERS, FREE, CALL_SECONDS, AI_LEVELS, FREEZE_MS, PERFECT_MS, POWER_MAX,
} from '@/lib/bingo/engine.js';
import { sfx } from '@/lib/sound';
import { speakBall, stopSpeaking, speechSupported } from '@/lib/speech';
import { MatchFrame } from '../MatchView';
import ResultOverlay from '../ResultOverlay';

const rand = (a, b) => a + Math.random() * (b - a);

/** Bingo vs the computer. Marking is manual: nothing tells you a called number is on your card. */
export default function BingoGame({ t, level, ruleset, me, opts = {}, onExit, onLeave }) {
  const numCards = Math.max(1, Math.min(4, opts.cards || 1));
  const [game, setGame] = useState(() => newGame(ruleset, Math.random, numCards));
  const [charge, setCharge] = useState(0);        // Perfect Daubs charge the power-up meter
  const [coins, setCoins] = useState(0);          // treasure chests
  const [frozenLeft, setFrozenLeft] = useState(0); // false BINGO: board frozen
  const frozenUntil = useRef(0);
  const calledAt = useRef(0);
  const firedAt = useRef(0);   // touch fires on pointer-down (zero lag); the click that follows is ignored
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
  useEffect(() => { calledAt.current = Date.now(); }, [lastCalled]);
  useEffect(() => {
    if (!frozenLeft) return undefined;
    const id = setTimeout(() => setFrozenLeft(Math.max(0, Math.ceil((frozenUntil.current - Date.now()) / 1000))), 300);
    return () => clearTimeout(id);
  }, [frozenLeft]);
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
      later(() => {
        let cur = gameRef.current; if (cur.over) return;
        for (const c of cardsOf(cur, 0)) { const ix = c.card.indexOf(lastCalled); if (ix >= 0 && canMark(cur, 0, ix, c.k)) cur = mark(cur, 0, ix, c.k); }
        commit(cur); sfx.tap();
      }, 500);
    }
  }, [lastCalled]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePause = () => { const p = !pausedRef.current; pausedRef.current = p; setPaused(p); if (p) stopSpeaking(); sfx.tap(); };
  const toggleVoice = () => { const v = !voiceOn; setVoiceOn(v); if (!v) stopSpeaking(); else if (lastCalled) speakBall(lastCalled, document.documentElement.lang === 'am' ? 'am' : 'en'); sfx.tap(); };
  const buzz = (ms = 14) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };
  const tapCell = (i, k = 0) => {
    const s = gameRef.current;
    const card = cardsOf(s, 0)[k];
    if (pausedRef.current || s.over || !card || i === FREE || card.marks[i]) return;
    if (Date.now() < frozenUntil.current) { sfx.pass(); buzz(40); return; }          // frozen after a false BINGO
    if (!canMark(s, 0, i, k)) { setShake(`${k}:${i}`); later(() => setShake(null), 400); sfx.pass(); buzz(30); return; } // not called (yet)
    const n = card.card[i];
    commit(mark(s, 0, i, k)); sfx.place(); buzz();
    if (n === lastCalled && Date.now() - calledAt.current <= PERFECT_MS) {            // Perfect Daub: charge the power-up meter
      setCharge((c) => Math.min(POWER_MAX, c + 1)); say(t.perfect, 'extra');
    }
    const loot = chestAt(s, n);
    if (loot) { setCoins((c) => c + loot); say(t.chestOpen(loot), 'capture'); sfx.cheer?.(); }
  };
  const usePower = (kind) => {
    const s = gameRef.current;
    if (charge < POWER_MAX || s.over || pausedRef.current) return;
    if (Date.now() < frozenUntil.current) { sfx.pass(); return; }
    if (kind === 'shield') commit(grantShield(s, 0));
    else commit((kind === 'instant' ? instantDaub : doubleDaub)(s, 0).state);
    setCharge(0); sfx.bingoCall(); buzz(25);
  };
  const shout = () => {
    const s = gameRef.current;
    if (s.over || pausedRef.current || Date.now() < frozenUntil.current) return;
    const r = claim(s, 0); commit(r.state);
    if (r.ok) { sfx.bingoCall(); say(s.ruleset === 'full' ? t.jackpot : 'BINGO!', 'capture'); }
    else if (r.error === 'shielded') { sfx.tap(); say(t.bingoShield, 'extra'); }
    else if (r.error === 'false') {
      sfx.pass(); buzz(120);
      frozenUntil.current = Date.now() + FREEZE_MS; setFrozenLeft(Math.ceil(FREEZE_MS / 1000));
      say(t.bingoFrozen(Math.ceil(FREEZE_MS / 1000)), 'relay');
    }
  };

  const finished = game.over;
  useEffect(() => {
    if (!finished || doneSound.current) return;
    doneSound.current = true;
    if (game.winner === 1) sfx.lose(); else if (game.winner === 0) sfx.cheer();
  }, [finished, game.winner]);
  const again = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    const g = newGame(ruleset, Math.random, numCards); gameRef.current = g; doneSound.current = false; frozenUntil.current = 0; setFrozenLeft(0); setCharge(0); setCoins(0); setGame(g); setSecs(3); pausedRef.current = false; setPaused(false); setRound((r) => r + 1);
  };

    const winLine = game.winner === 0 || game.winner === 1 ? game.winLine : null;
  const locked = game.lock[0] > 0;
  const myCards = cardsOf(game, 0);
  const frozen = frozenLeft > 0 && !game.over;
  const toGoMe = toGo(game, 0), toGoAi = toGo(game, 1);

  let title, tone = 'win';
  if (game.winner === 'draw') { title = t.draw; tone = 'draw'; }
  else { title = game.winner === 0 ? t.youWin : t.youLose; tone = game.winner === 0 ? 'win' : 'lose'; }

  const status = game.over ? '' : frozen ? t.bingoFrozen(frozenLeft) : locked ? t.bingoLocked(game.lock[0]) : game.called.length ? t.bingoStatus : t.bingoStart;

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
      <div className={`bcards n${myCards.length}${frozen ? ' frozen' : ''}`}>
        {myCards.map((c) => (
          <div key={c.k} className="bcard" role="grid" aria-label={t.bingoName}>
            {LETTERS.map((L, col) => <span key={L} className={`bhead l${col}`}>{L}</span>)}
            {c.card.map((n, i) => {
              const m = c.marks[i];
              const hot = myCards.length > 1 && !m && n > 0 && n === lastCalled;   // smart highlight on multi-card play
              const cls = `bcell${i === FREE ? ' free' : ''}${m ? ' on' : ''}${shake === `${c.k}:${i}` ? ' shake' : ''}${hot ? ' pulse' : ''}${chestAt(game, n) && !m && i !== FREE ? ' chest' : ''}${winLine && game.winner === 0 && game.winCard === c.k && winLine.includes(i) ? ' win' : ''}`;
              return <button key={i} type="button" role="gridcell" className={cls} aria-pressed={m} onPointerDown={(e) => { if (e.pointerType !== 'mouse') { firedAt.current = Date.now(); tapCell(i, c.k); } }} onClick={() => { if (Date.now() - firedAt.current < 600) return; tapCell(i, c.k); }}>{i === FREE ? '★' : n}</button>;
            })}
          </div>
        ))}
      </div>
      <div className="bpower" aria-label={t.powerLabel}>
        <span className="bmeter"><i style={{ '--p': `${(charge / POWER_MAX) * 100}%` }} /></span>
        <span className="bcoins">🪙 {coins}</span>
        {charge >= POWER_MAX && !game.over && (
          <span className="bpw">
            <button type="button" className="btn on" onClick={() => usePower('instant')}>⚡ {t.pwInstant}</button>
            <button type="button" className="btn on" onClick={() => usePower('double')}>✦ {t.pwDouble}</button>
            <button type="button" className="btn on" onClick={() => usePower('shield')}>🛡 {t.pwShield}{game.shield[0] ? ` ×${game.shield[0]}` : ''}</button>
          </span>
        )}
        {charge < POWER_MAX && game.shield[0] > 0 && <span className="bcoins">🛡 ×{game.shield[0]}</span>}
      </div>
      <button type="button" className="bingo-btn" disabled={game.over || locked || paused || frozen} onClick={shout}>
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
