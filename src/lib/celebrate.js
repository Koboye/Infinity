// Win / lose flavour: pure helpers shared by the result screen and the tests.
//
// Gebeta taunt — the winner "puffs" at the loser. The words agree with the LOSER's gender:
//   man:   እፍ እፍ ገምተሀል እወቀኝ አገማሁህ
//   woman: እፍ እፍ ገምተሻል እወቂኝ አገማሁሽ

/** Only the Queen hero is female by default; the player can override it in Settings (gender: 'm' | 'f' | 'auto'). */
export const genderOfHero = (heroId) => (heroId === 'queen' ? 'f' : 'm');
export const resolveGender = (pref, heroId) => (pref === 'm' || pref === 'f' ? pref : genderOfHero(heroId));

/** The four words of the taunt, in the order they pop up on screen. */
export function gebetaTaunt(loserGender = 'm') {
  return loserGender === 'f'
    ? ['እፍ እፍ', 'ገምተሻል', 'እወቂኝ', 'አገማሁሽ']
    : ['እፍ እፍ', 'ገምተሀል', 'እወቀኝ', 'አገማሁህ'];
}

export const WIN_LINES = {
  en: ['Champion!', 'Masterful!', 'Unstoppable!', 'What a finish!', 'Pure class!'],
  am: ['ሻምፒዮን!', 'ድንቅ ጨዋታ!', 'ማንም አያቆምህም!', 'ምን አይነት ፍፃሜ!', 'ጀግና!'],
};
export const LOSE_LINES = {
  en: ['Even the stones felt sorry for you 🪨', 'Plot twist: the board was winning 😅', 'Shake it off — rematch? 💪', 'That was… a choice 🙈', 'The seeds say: better luck next time 🌱'],
  am: ['ድንጋዮቹም አዘኑልህ 🪨', 'ሰሌዳው ነው ያሸነፈው 😅', 'አትዘን — እንደገና እንሞክር? 💪', 'ያ ደግሞ ምርጫ ነበር 🙈', 'ዘሮቹ ይላሉ፦ በሚቀጥለው ይሳካል 🌱'],
};
export const LOSE_EMOJI = ['🙈', '😵‍💫', '🤦', '🫠', '🥲'];

export const pick = (list, rand = Math.random) => list[Math.floor(rand() * list.length) % list.length];
export const winLine = (lang = 'en', rand = Math.random) => pick(WIN_LINES[lang] || WIN_LINES.en, rand);
export const loseLine = (lang = 'en', rand = Math.random) => pick(LOSE_LINES[lang] || LOSE_LINES.en, rand);
