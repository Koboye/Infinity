// Fair "who starts" draw for offline games (0 = player 1, 1 = player 2 / the computer).
//
// One unbiased coin from the platform's cryptographic generator: each side wins with probability exactly 1/2, and every
// draw is independent of the ones before. (An earlier version forced the other side after two wins in a row; that
// removed streaks but made the draw predictable and no longer a true 50 / 50 sequence, so it is gone.)
import { fairCoin } from './fairRandom.js';

export function drawStarter(_game = 'x', flip = fairCoin) {
  return flip() === 1 ? 1 : 0;
}
