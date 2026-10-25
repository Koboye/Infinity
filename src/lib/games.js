// Client-side game catalogue (what the menus need to know about each game).
export const GAME_LIST = ['gebeta', 'checkers', 'dominoes', 'bingo', 'ludo'];

/** The standard turn time every game uses (seconds). */
export const TURN_SECONDS = 30;
/** One online turn length for every game (server deadline), so the clock behaves the same everywhere. */
export const ONLINE_TURN_SECONDS = 60;

/** Every game's computer pauses a random 2.5–3.5 s before it plays, so it never answers instantly (its search runs meanwhile). */
export const COMPUTER_WAIT_MS = [2500, 3500];
export const thinkWaitMs = (rand = Math.random) => COMPUTER_WAIT_MS[0] + rand() * (COMPUTER_WAIT_MS[1] - COMPUTER_WAIT_MS[0]);

export const GAMES = {
  gebeta: { id: 'gebeta', rulesets: ['gebeta', 'ashagro', 'tuz'], defaultRuleset: 'gebeta', accent: '#F2B632' },
  checkers: { id: 'checkers', rulesets: ['flying', 'american'], defaultRuleset: 'flying', accent: '#C23B2A' },
  bingo: { id: 'bingo', rulesets: ['line', 'corners', 'stamp', 'xshape', 'plus', 'full'], defaultRuleset: 'line', accent: '#8E3FD1', noPass: true },
  ludo: { id: 'ludo', rulesets: ['classic', 'quick'], defaultRuleset: 'classic', accent: '#E0452B', offlineOnly: true }, // 2/3/4 players · 3 players use the fair triangle
  dominoes: { id: 'dominoes', rulesets: ['draw', 'block'], defaultRuleset: 'draw', targets: [50, 100], defaultTarget: 50, accent: '#4FA36B', comingSoon: true }, // built but NOT released: shown as "Coming soon" only
};
export const gameInfo = (id) => GAMES[id] || GAMES.gebeta;
/** A game that can actually be played (offline or online). Coming-soon games are only shown in the picker. */
export const isPlayable = (id) => !!GAMES[id] && !GAMES[id].comingSoon;

/** Per-game stat field names on the user document (Gebeta keeps the original un-suffixed ones). */
export function statFields(game) {
  const s = !game || game === 'gebeta' ? '' : `_${game}`;
  return { rating: `rating${s}`, wins: `wins${s}`, losses: `losses${s}`, draws: `draws${s}`, games: `games${s}` };
}
