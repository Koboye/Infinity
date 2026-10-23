// Stone catalog for Gebeta. Each set gives Player 1 (a) and Player 2 (b) a colour, as [highlight, body, shadow].
// Stones take their colour from the side of the board they sit on, so a seed sown across the board changes owner on sight.
export const KINDS = [
  { id: 'gem', en: 'Gems', am: 'ዕንቁ' },
  { id: 'pebble', en: 'Beach stones', am: 'ጠጠር' },
  { id: 'glass', en: 'Glass', am: 'መስታወት' },
  { id: 'shell', en: 'Cowries', am: 'ቅርፊት' },
];

export const STONE_SETS = [
  { id: 'ruby-sapphire', kind: 'gem', name: 'Ruby & Sapphire', a: ['#ffa0b4', '#d6193f', '#6b0620'], b: ['#9cc2ff', '#2559d6', '#0d1f66'] },
  { id: 'emerald-amethyst', kind: 'gem', name: 'Emerald & Amethyst', a: ['#9bf5c2', '#13a65a', '#06512b'], b: ['#e6b4ff', '#8e3fd1', '#41156e'] },
  { id: 'topaz-aqua', kind: 'gem', name: 'Topaz & Aquamarine', a: ['#ffe9a8', '#f0a81a', '#8a5300'], b: ['#b4f7f2', '#25b8b0', '#0b5a60'] },
  { id: 'garnet-peridot', kind: 'gem', name: 'Garnet & Peridot', a: ['#ffa894', '#b3261e', '#4d0b09'], b: ['#eeffaa', '#9bc92a', '#4a6a0b'] },
  { id: 'sand-slate', kind: 'pebble', name: 'Sandstone & Slate', a: ['#f7e8c4', '#d2b27a', '#8a6a3a'], b: ['#9aa7b4', '#4d5b69', '#222b34'] },
  { id: 'rose-jade', kind: 'pebble', name: 'Rose quartz & Jade', a: ['#ffe4ea', '#e8a1b3', '#a05468'], b: ['#c4eed5', '#5fae85', '#2a6048'] },
  { id: 'chalk-obsidian', kind: 'pebble', name: 'Chalk & Obsidian', a: ['#ffffff', '#ece6d6', '#b2a98f'], b: ['#7b7f8c', '#2a2c35', '#08090c'] },
  { id: 'coral-seaglass', kind: 'pebble', name: 'Coral & Sea-glass', a: ['#ffcdb8', '#ee7b5b', '#a63d22'], b: ['#dcf7ef', '#7fc9b8', '#3d8a7b'] },
  { id: 'amber-cobalt', kind: 'glass', name: 'Amber & Cobalt', a: ['#ffe79a', '#f2a31a', '#a85d00'], b: ['#acceff', '#2f6fe0', '#0f2f86'] },
  { id: 'pearl-onyx', kind: 'glass', name: 'Pearl & Onyx', a: ['#ffffff', '#e9e4ff', '#b9b2d8'], b: ['#8a8a94', '#26262e', '#000000'] },
  { id: 'tangerine-teal', kind: 'glass', name: 'Tangerine & Teal', a: ['#ffd0a0', '#f0702a', '#9a3200'], b: ['#9ff0e6', '#10a39a', '#04504c'] },
  { id: 'ivory-ochre', kind: 'shell', name: 'Ivory & Ochre', a: ['#fffdf5', '#efe3c8', '#b7a47a'], b: ['#f0b47e', '#b8672e', '#6b3515'] },
  { id: 'pearl-indigo', kind: 'shell', name: 'Pearl & Indigo', a: ['#ffffff', '#f1ebf4', '#bfb4c9'], b: ['#9aa4e8', '#3d4bb0', '#161d5e'] },
];

export const DEFAULT_STONES = 'ruby-sapphire';
export const stoneSet = (id) => STONE_SETS.find((s) => s.id === id) || STONE_SETS[0];

/** CSS custom properties for one set (used globally on <html> and for the picker previews). */
export function stoneVars(set) {
  const v = {};
  ['a', 'b'].forEach((side) => set[side].forEach((c, i) => { v[`--s${side}${i + 1}`] = c; }));
  return v;
}

export function applyStones(id) {
  if (typeof document === 'undefined') return;
  const set = stoneSet(id), el = document.documentElement;
  el.dataset.stone = set.kind;
  const v = stoneVars(set);
  Object.keys(v).forEach((k) => el.style.setProperty(k, v[k]));
}
