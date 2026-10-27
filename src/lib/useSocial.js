'use client';
// One live view of everything social for the signed-in player (v73): friends + requests, chats, game invites, the badge count.
// GebetaApp owns the single copy and hands it to the screens, so there is never more than one set of listeners.
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db, apiCall, serverNow } from '@/lib/firebase';
import { badgeCount, emptyFriends, liveInvites } from '@/lib/social';

export function useSocial(uid) {
  const [friends, setFriends] = useState(null);
  const [chats, setChats] = useState([]);
  const [invites, setInvites] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!uid || !db) { setFriends(null); setChats([]); setInvites(null); return undefined; }
    const off = [];
    off.push(onSnapshot(doc(db, 'friends', uid), (s) => setFriends(s.exists() ? { ...emptyFriends(), ...s.data() } : emptyFriends()), () => setFriends(emptyFriends())));
    off.push(onSnapshot(query(collection(db, 'chats'), where('users', 'array-contains', uid)), (s) => setChats(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}));
    off.push(onSnapshot(doc(db, 'invites', uid), (s) => setInvites(s.exists() ? s.data() : null), () => {}));
    return () => off.forEach((f) => f());
  }, [uid]);

  // "I am here" for my friends' green dots: once a minute while the app is visible, and only if I have friends to tell.
  const hasFriends = !!friends && Object.keys(friends.list || {}).length > 0;
  useEffect(() => {
    if (!uid || !hasFriends) return undefined;
    const ping = () => { if (!document.hidden) apiCall({ action: 'presence' }, { retries: 0 }).catch(() => {}); };
    ping(); const id = setInterval(ping, 60000);
    document.addEventListener('visibilitychange', ping);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', ping); };
  }, [uid, hasFriends]);

  // invites expire by themselves: re-check every 20 s
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 20000); return () => clearInterval(id); }, []);

  return useMemo(() => {
    const now = serverNow();
    return { friends, chats, invites: liveInvites(invites, now), badge: uid ? badgeCount({ friends, chats, invites }, uid, now) : 0 };
  }, [friends, chats, invites, uid, tick]);   // eslint-disable-line react-hooks/exhaustive-deps
}
