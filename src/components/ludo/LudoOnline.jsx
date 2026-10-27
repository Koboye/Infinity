'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiCall } from '@/lib/firebase';
import { legalMoves, distinctMoves, pathOf, finishOf, previewAll, progressOf } from '@/lib/ludo/engine.js';
import { PANEL_SLOT as SLOT, viewOf } from '@/lib/ludo/layout.js';
import { heroById } from '@/lib/i18n';
import { sfx } from '@/lib/sound';
import LudoBoard, { COLORS } from './LudoBoard';
import { Die } from './LudoGame';
import { capturedDiff, retInit, animateReturn } from '@/lib/ludo/ret.js';
import { useMatchLifecycle } from '../online/useMatch';
import { RoomControls, RoomResult } from '../online/RoomParts';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const parse = (room) => { try { const s = JSON.parse(room.lg); return s && Array.isArray(s.pos) ? s : null; } catch { return null; } };
const ORDER = { top: ['tl', 'top', 'tr'], bottom: ['bl', 'br'] };
const NO_FLY = new Set();

/** Online Ludo (2 players). The SERVER rolls the die and checks every move; this view only shows the shared state and sends taps. */
export default function LudoOnline({ t, lang, room, uid, code, onExit, onSwitchRoom, confirm }) {
  const [game, setGame] = useState(() => parse(room));
  const gameRef = useRef(game);
  const [faces, setFaces] = useState(() => [0, 1].map((p) => (game && game.phase === 'move' && game.turn === p ? game.dice : null)));
  const [rollIds, setRollIds] = useState([0, 0]);
  const [rolling, setRolling] = useState(false);
  const [anim, setAnim] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [ret, setRet] = useState(null), [retTrail, setRetTrail] = useState(null);
  const seqRef = useRef(room.moveSeq), queuedRef = useRef(room.moveSeq), queue = useRef([]), running = useRef(false), alive = useRef(true), autoSent = useRef(-1);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const L = useMatchLifecycle({ t, lang, room, uid, code, busy, onExit, onSwitchRoom, confirm });
  const { seat } = L;
  const viewRef = useRef(0);

  // play every server update in order: roll → tumble the die, move → hop the pawn, then show the new state
  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true; setBusy(true);
    while (queue.current.length && alive.current) {
      const r = queue.current.shift(), ns = parse(r), lm = r.lastMove;
      if (!ns) continue;
      if (r.moveSeq === seqRef.current + 1 && lm) {
        if (lm.kind === 'roll') {
          setRolling(true); setFaces((f) => f.map((v, k) => (k === lm.by ? lm.value : v))); setRollIds((ids) => ids.map((v, k) => (k === lm.by ? v + 1 : v))); sfx.dice();
          await wait(720); if (!alive.current) return;
          setRolling(false);
          if (lm.forfeited) { setFlash({ text: t.ludoSixes, kind: 'bad', k: Math.random() }); sfx.pass(); }
          else if (lm.none) { setNote(t.ludoNoMove); sfx.pass(); await wait(650); setNote(''); }
        } else if (lm.kind === 'move') {
          const s0 = gameRef.current;
          if (s0) for (const pos of pathOf(s0, lm.from, lm.to)) { if (!alive.current) return; setAnim({ p: lm.by, i: lm.i, pos }); sfx.hop(); await wait(lm.from === -1 ? 200 : 140); }
          setAnim(null); sfx.land();
          if (lm.caps) {
            const caps = capturedDiff(s0, ns, lm.by, lm.i);
            gameRef.current = ns; setGame(ns); setRet(retInit(caps));
            setFlash({ text: t.ludoCapture, kind: 'good', k: Math.random() }); sfx.kick?.(false);
            await animateReturn(s0, caps, { setRet, setRetTrail, wait, alive: () => alive.current, view: viewRef.current });
          }
          else if (lm.home) { setFlash({ text: t.ludoHomeFlash, kind: 'good', k: Math.random() }); sfx.home?.(); }
        }
      } else { setAnim(null); setRolling(false); }
      seqRef.current = r.moveSeq; gameRef.current = ns; setGame(ns);
      setFaces((f) => f.map((v, k) => (ns.phase === 'move' && ns.turn === k ? ns.dice : v)));
    }
    running.current = false; if (alive.current) setBusy(false);
  }, [t]);
  useEffect(() => {
    if (room.moveSeq > queuedRef.current || (room.status === 'finished' && room.moveSeq >= queuedRef.current && room.moveSeq !== seqRef.current)) { queuedRef.current = room.moveSeq; queue.current.push(room); drain(); }
  }, [room, drain]);

  const people = [0, 1].map((p) => { const h = heroById(room.avatars?.[p]); return { name: room.names?.[p] || '…', glyph: h?.glyph || '🙂' }; });
  const g = game || parse(room);
  const view = g ? viewOf(g.seats[seat] ?? 0) : 0;   // my pawns are ALWAYS bottom-left (yellow) on my own screen
  viewRef.current = view;
  const dp = (st) => (st + view) % 4;
  const idle = !busy && !rolling && !anim;
  const myTurn = L.myTurn && idle && g && !g.over;
  const canRoll = myTurn && g.phase === 'roll' && !sending;
  const legal = useMemo(() => new Set(myTurn && g.phase === 'move' ? legalMoves(g).map((i) => `${g.turn}:${i}`) : []), [g, myTurn]);
  const previews = useMemo(() => (legal.size ? new Map(previewAll(g).map((pv) => [`${g.turn}:${pv.i}`, pv])) : null), [g, legal]);

  const roll = useCallback(async () => { if (sending) return; setSending(true); try { await L.api({ action: 'roll' }); } catch { /* shown by L.err */ } setSending(false); }, [L, sending]);
  const pick = useCallback(async (i) => { if (sending) return; setSending(true); try { await L.api({ action: 'move', i }); } catch { /* shown by L.err */ } setSending(false); }, [L, sending]);
  // a single real choice is played for you after a beat
  useEffect(() => {
    if (!myTurn || !g || g.phase !== 'move' || sending || autoSent.current === room.moveSeq) return undefined;
    const d = distinctMoves(g); if (d.length !== 1) return undefined;
    const id = setTimeout(() => { autoSent.current = room.moveSeq; pick(d[0]); }, 450);
    return () => clearTimeout(id);
  }, [myTurn, g, sending, room.moveSeq, pick]);

  if (!g) return <div className="panel center"><p>{t.roomGone}</p></div>;
  const slotNames = {}; g.seats.forEach((st, p) => { slotNames[dp(st)] = p === seat ? t.you : people[p]?.name; });
  const toks = [];
  g.pos.forEach((arr, p) => arr.forEach((pos, i) => { const mv = anim && anim.p === p && anim.i === i; const rk = ret ? ret[`${p}:${i}`] : undefined; const back = rk !== undefined && rk !== null; toks.push({ p, i, seat: g.seats[p], pos: back ? rk : mv ? anim.pos : pos, moving: mv, back }); }));
  const seatNow = g.seats[g.turn], color = COLORS[dp(seatNow)], F = finishOf(g.board);
  const homeCount = (p) => g.pos[p].filter((x) => x === F).length;
  const status = g.over ? '' : rolling ? '…' : note || (g.phase === 'move' ? (myTurn ? t.ludoPick : t.ludoRolled(people[g.turn].name, g.dice)) : L.myTurn ? t.ludoYourTurn : t.ludoTurnOf(people[g.turn].name));
  const clock = L.playing && L.secondsLeft != null ? { left: Math.min(L.secondsLeft, L.turnMax), max: L.turnMax } : null;

  return (
    <div className={`ludo ${g.board}`} style={{ '--tc': color, '--step': '0.14s' }}>
      {['top', 'bottom'].map((row) => {
        const here = ORDER[row].map((sl) => g.seats.findIndex((st) => SLOT[g.board][dp(st)] === sl)).filter((p) => p >= 0);
        return (
          <div key={row} className={`ludo-row ${row}${row === 'bottom' ? ' after' : ''}`} hidden={here.length === 0} style={{ order: row === 'bottom' ? 3 : 0 }}>
            {here.map((p) => {
              const st = g.seats[p], on = g.turn === p && !g.over, slot = SLOT[g.board][dp(st)], mine = on && canRoll && p === seat;
              return (
                <div key={p} className={`ludo-panel ${slot}${on ? ' on' : ''}${p === seat ? ' me' : ''}`} style={{ '--pc': COLORS[dp(st)] }} aria-current={on ? 'true' : undefined}>
                  <Die value={faces[p]} rolling={rolling && on} rollId={rollIds[p]} color={COLORS[dp(st)]} disabled={!mine} onRoll={roll} label={`${t.ludoRoll} — ${people[p].name}`} ms={720} />
                  <div className="info">
                    <b className="nm"><span className="av">{people[p].glyph}</span><span className="tx">{p === seat ? t.you : people[p].name}</span></b>
                    <span className="pips">{g.pos[p].map((x, k) => <i key={k} className={x === F ? 'home' : x >= 0 ? 'out' : ''} />)}</span>
                    <span className="bar"><i style={{ width: `${Math.round(progressOf(g, p) * 100)}%` }} /></span>
                  </div>
                  {on && clock && <span className={`tclock${clock.left <= 5 ? ' low' : ''}`} role="timer"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, clock.left / clock.max))})` }} /><b>{clock.left}</b></span>}
                  {L.emotes[p] && <em className="emo" key={L.emotes[p].k}>{L.emotes[p].text}</em>}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="ludo-board" style={{ order: 1 }}>
        <LudoBoard board={g.board} seats={g.seats} tokens={toks} legal={legal} onPick={pick} hintKey={null} turnSeat={seatNow} previews={previews} trail={null} retTrail={retTrail} fx={[]} flying={NO_FLY} view={view} names={slotNames} youSlot={dp(g.seats[seat] ?? 0)} />
        {flash && <div className={`flash ${flash.kind}`} key={flash.k} onAnimationEnd={() => setFlash(null)}>{flash.text}</div>}
      </div>
      <div className={`ludo-dock${canRoll ? ' ready' : ''}`} style={{ '--dc': color, order: 4 }}>
        <div className="ludo-say" aria-live="polite"><b>{L.err || status}</b></div>
      </div>
      <div style={{ order: 5, width: '100%' }}><RoomControls t={t} lang={lang} L={L} /></div>
      <RoomResult t={t} room={room} L={L} score={[homeCount(seat), homeCount(1 - seat)]} detail="" />
    </div>
  );
}
