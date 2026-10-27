import gebeta from './gebeta.js';
import checkers from './checkers.js';
import dominoes from './dominoes.js';
import bingo from './bingo.js';
import ludo from './ludo.js';

export const ONLINE = { gebeta, checkers, dominoes, bingo, ludo };
export const GAME_IDS = Object.keys(ONLINE);
export const gameOf = (id) => ONLINE[id] || ONLINE.gebeta;
export const normalizeGame = (id) => (ONLINE[id] ? id : 'gebeta');
