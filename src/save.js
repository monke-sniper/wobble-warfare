// Persistent progress + settings in localStorage (always wrapped: storage may be unavailable).
const KEY = 'wobble-warfare-v2';

const DEFAULTS = {
  stars: {}, // levelId -> 1..3
  gauntletBest: 0,
  settings: {
    quality: 'auto', // low | medium | high | auto
    shadows: true,
    volume: 0.7,
    healthBars: true,
    killFeed: true,
    fps: false,
    unitCap: 400,
    corpses: 250,
  },
};

function merge(base, over) {
  const out = { ...base };
  if (!over || typeof over !== 'object') return out;
  for (const k in over) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = merge(base[k], over[k]);
    else out[k] = over[k];
  }
  return out;
}

export const save = (() => {
  try { return merge(DEFAULTS, JSON.parse(localStorage.getItem(KEY))); } catch { return merge(DEFAULTS, null); }
})();

let pending = 0;
export function persist() {
  clearTimeout(pending);
  pending = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage unavailable */ }
  }, 150);
}
