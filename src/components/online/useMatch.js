'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Ads from '@/lib/ads';
import { apiCall, serverNow } from '@/lib/firebase';
import { EMOTES } from '@/lib/i18n';
import { sfx } from '@/lib/sound';
import { ONLINE_TURN_SECONDS } from '@/lib/games.js';
import { refresh as refreshWallet } from '@/lib/wallet';

export const setSaved = (code) => { try { code ? localStorage.setItem('gebeta.room', code) : localStorage.removeItem('gebeta.room'); } catch {} };

/**
 * Everything every online game shares: seat, turn timer, claiming a win when the opponent
 * runs out of time, emotes, resign, rematch and the end-of-match sound.
 * `busy` = the game's animator is still replaying a move (we hold the result overlay until it ends).
 */
export function useMatchLifecycle({ t, lang, room, uid, code, busy, onExit, onSwitchRoom, confirm }) {
  const [err, setErr] = useState('');
  const [now, setNow] = useState(serverNow());
  const [emotes, setEmotes] = useState({});
  const claimed = useRef(false);
  const doneSound = useRef(false);

  useEffect(() => { setSaved(code); }, [code]);
  // the entry fee leaves the wallet when the match starts and the prize arrives when it ends: show the server's numbers
  useEffect(() => { if (room.status === 'playing' || room.status === 'finished') refreshWallet(); }, [room.status]);
  useEffect(() => { const id = setInterval(() => setNow(serverNow()), 250); return () => clearInterval(id); }, []);

  // presence heartbeat while the match is on
  useEffect(() => {
    if (room.status !== 'playing') return undefined;
    const ping = () => { if (!document.hidden) apiCall({ action: 'ping', code }, { retries: 0 }).catch(() => {}); };
    ping(); const id = setInterval(ping, 20000);
    document.addEventListener('visibilitychange', ping);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', ping); };
  }, [room.status, code]);

  const seat = room.players.indexOf(uid);
  const playing = room.status === 'playing';
  const myTurn = playing && room.turn === seat && room.phase !== 'roundOver';
  const secondsLeft = playing && room.deadline ? Math.max(0, Math.ceil((room.deadline - now) / 1000)) : null;
  const turnMax = Math.round((room.turnMs || ONLINE_TURN_SECONDS * 1000) / 1000);
  const oppSeen = room.seen?.[1 - seat];
  const oppAway = playing && !!oppSeen && now - oppSeen > 50000;

  // Opponent ran out of time → claim the win (the server re-checks the clock).
  useEffect(() => {
    if (!playing || room.turn === seat || secondsLeft !== 0 || claimed.current) return;
    claimed.current = true;
    apiCall({ action: 'timeout', code }).catch(() => { claimed.current = false; });
  }, [playing, room.turn, seat, secondsLeft, code]);
  useEffect(() => { claimed.current = false; }, [room.moveSeq]);

  const finished = room.status === 'finished' && !busy;
  useEffect(() => {
    if (!finished || doneSound.current) return;
    doneSound.current = true; setSaved(null);
    room.winner === seat ? sfx.win() : room.winner === 'draw' ? sfx.tap() : sfx.lose();
  }, [finished, room.winner, seat]);

  // Emotes from either player
  const emoteAt = room.emote?.at;
  useEffect(() => {
    const e = room.emote;
    if (!e || Date.now() - e.at >= 4000) return;
    const def = EMOTES.find((x) => x.id === e.id);
    if (!def) return;
    setEmotes((m) => ({ ...m, [e.by]: { text: def[lang] || def.en, k: e.at } }));
    const id = setTimeout(() => setEmotes((m) => (m[e.by]?.k === e.at ? { ...m, [e.by]: null } : m)), 3200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emoteAt]);

  const api = useCallback(async (body) => { try { setErr(''); return await apiCall({ code, ...body }); } catch (e) { setErr(e.message); throw e; } }, [code]);
  const resign = async () => { if (await confirm(t.resignConfirm)) { try { await api({ action: 'resign' }); } catch {} } };
  const sendEmote = (id) => apiCall({ action: 'emote', code, id }).catch(() => {});
  const sendChat = (text) => apiCall({ action: 'roomChat', code, text }).catch(() => {});   // v73: free text between the two players
  const chat = room.chat || [];
  const rematch = async () => { try { await Ads.gate(); const r = await api({ action: 'rematch' }); setSaved(null); onSwitchRoom(r.code); } catch {} };
  const exit = () => { setSaved(null); onExit(); };

  return { turnMax, oppAway, seat, playing, myTurn, secondsLeft, err, setErr, emotes, finished, now, api, resign, sendEmote, sendChat, chat, rematch, exit };
}
