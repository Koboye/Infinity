// Client-side game catalogue (what the menus need to know about each game).
export const GAME_LIST = ['gebeta', 'checkers', 'dominoes'];

export const GAMES = {
  gebeta: { id: 'gebeta', rulesets: ['gebeta', 'classic'], defaultRuleset: 'gebeta', accent: '#F2B632' },
  checkers: { id: 'checkers', rulesets: ['american', 'flying'], defaultRuleset: 'american', accent: '#C23B2A' },
  dominoes: { id: 'dominoes', rulesets: ['draw', 'block'], defaultRuleset: 'draw', targets: [50, 100], defaultTarget: 50, accent: '#4FA36B' },
};
export const gameInfo = (id) => GAMES[id] || GAMES.gebeta;

/** Per-game stat field names on the user document (Gebeta keeps the original un-suffixed ones). */
export function statFields(game) {
  const s = !game || game === 'gebeta' ? '' : `_${game}`;
  return { rating: `rating${s}`, wins: `wins${s}`, losses: `losses${s}`, draws: `draws${s}`, games: `games${s}` };
}
