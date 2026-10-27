// v68: "last played first". Pure helpers (no storage, UI or network) for the order of the game cards on the home screen.
// The newest played game moves to the front; games never played keep the catalogue order; "coming soon" games always go last.
export const RECENT_MAX = 8;

/** Put `id` at the front of the recent list (no duplicates, never longer than RECENT_MAX). Garbage in → clean list out. */
export function touchRecent(list, id) {
  const base = Array.isArray(list) ? list.filter((x) => typeof x === 'string' && x && x !== id) : [];
  return typeof id === 'string' && id ? [id, ...base].slice(0, RECENT_MAX) : base.slice(0, RECENT_MAX);
}

/** Order game ids: playable games by recency (unplayed ones keep their catalogue order), coming-soon games last. */
export function orderGames(ids, recent, isSoon = () => false) {
  const rec = Array.isArray(recent) ? recent : [];
  const rank = (id) => { const i = rec.indexOf(id); return i === -1 ? rec.length + ids.indexOf(id) : i; };
  return [...ids].sort((a, b) => (Number(!!isSoon(a)) - Number(!!isSoon(b))) || (rank(a) - rank(b)));
}
