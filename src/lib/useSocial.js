'use client';
// One live view of everything social for the signed-in player: friends + requests, chats, game invites, last-seen times, the badge count.
// GebetaApp owns the single copy and hands it to the screens, so there is never more than one set of listeners.
//
// Two ways in, so friends can ALWAYS reach each other:
//   1. Firestore listeners (instant) — used for every part that the project's rules/network allow.
//   2. The `socialSync` API call (the server reads with the Admin SDK) — covers any part whose listener failed (rules or indexes not
//      deployed, blocked websocket…) and also feeds friends' last-seen times. It runs every 4 s while a chat is open, every 15 s otherwise.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db, apiCall, serverNow } from '@/lib/firebase';
import { badgeCount, emptyFriends, liveInvites } from '@/lib/social';

export function useSocial(uid) {
  const [friends, setFriends] = useState(null);
  const [chats, setChats] = useState([]);
  const [invites, setInvites] = useState(null);
  const [seen, setSeen] = useState({});
  const [tick, setTick] = useState(0);
  const [fast, setFast] = useState(false);
  const live = useRef({ friends: false, chats: false, invites: false });   // which listeners have delivered data

  useEffect(() => {
    live.current = { friends: false, chats: false, invites: false };
    if (!uid) { setFriends(null); setChats([]); setInvites(null); setSeen({}); return undefined; }
    if (!db) return undefined;
    const off = [];
    const guard = (name, fn) => [(s) => { live.current[name] = true; fn(s); }, () => { live.current[name] = false; }];
    off.push(onSnapshot(doc(db, 'friends', uid), ...guard('friends', (s) => setFriends(s.exists() ? { ...emptyFriends(), ...s.data() } : emptyFriends()))));
    off.push(onSnapshot(query(collection(db, 'chats'), where('users', 'array-contains', uid)), ...guard('chats', (s) => setChats(s.docs.map((d) => ({ id: d.id, ...d.data() }))))));
    off.push(onSnapshot(doc(db, 'invites', uid), ...guard('invites', (s) => setInvites(s.exists() ? s.data() : null))));
    return () => off.forEach((f) => f());
  }, [uid]);

  // the server-side copy: fills in whatever a listener is not delivering, and the friends' last-seen times
  const sync = useCallback(async () => {
    if (!uid || document.hidden) return;
    try {
      const r = await apiCall({ action: 'socialSync' }, { retries: 0 });
      const l = live.current;
      if (!l.friends) setFriends({ ...emptyFriends(), ...(r.friends || {}) });
      if (!l.chats) setChats(r.chats || []);
      if (!l.invites) setInvites(r.invites || null);
      setSeen(r.seen || {});
    } catch { /* offline: try again on the next round */ }
  }, [uid]);
  useEffect(() => {
    if (!uid) return undefined;
    sync(); const id = setInterval(sync, fast ? 4000 : 15000);
    document.addEventListener('visibilitychange', sync);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', sync); };
  }, [uid, fast, sync]);

  // invites and "typing…" expire by themselves: re-check every 3 s while a chat is open, every 20 s otherwise
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), fast ? 3000 : 20000); return () => clearInterval(id); }, [fast]);

  return useMemo(() => {
    const now = serverNow();
    return { friends, chats, invites: liveInvites(invites, now), seen, badge: uid ? badgeCount({ friends, chats, invites }, uid, now) : 0, boost: setFast, refresh: sync };
  }, [friends, chats, invites, seen, uid, tick, sync]);   // eslint-disable-line react-hooks/exhaustive-deps
}
