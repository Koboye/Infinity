// Client-side game catalogue (what the menus need to know about each game).
export const GAME_LIST = ['gebeta', 'checkers', 'dominoes', 'bingo'];

/** The standard turn time every game uses (seconds). */
export const TURN_SECONDS = 30;

export const GAMES = {
  gebeta: { id: 'gebeta', rulesets: ['gebeta'], defaultRuleset: 'gebeta', accent: '#F2B632' },
  checkers: { id: 'checkers', rulesets: ['dama', 'flying', 'american'], defaultRuleset: 'dama', accent: '#C23B2A' },
  bingo: { id: 'bingo', rulesets: ['line', 'corners', 'full'], defaultRuleset: 'line', accent: '#8E3FD1', offlineOnly: true },
  dominoes: { id: 'dominoes', rulesets: ['draw', 'block'], defaultRuleset: 'draw', targets: [50, 100], defaultTarget: 50, accent: '#4FA36B' },
};
export const gameInfo = (id) => GAMES[id] || GAMES.gebeta;

/** Per-game stat field names on the user document (Gebeta keeps the original un-suffixed ones). */
export function statFields(game) {
  const s = !game || game === 'gebeta' ? '' : `_${game}`;
  return { rating: `rating${s}`, wins: `wins${s}`, losses: `losses${s}`, draws: `draws${s}`, games: `games${s}` };
}
