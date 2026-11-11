// Screen-size fit: the page shell is designed for a ~390px-wide phone and scaled by k for every other screen.
export const DESIGN_W = 390, DESIGN_H = 600, K_MIN = 0.8, K_MAX = 1.6;

/** Scale factor for a visible area of w × h CSS px. Portrait: by width. Landscape: by whichever side is tighter. */
export function fitScale(w, h) {
  const k = w >= h ? Math.min(w / DESIGN_W, h / DESIGN_H) : w / DESIGN_W;
  return Math.round(Math.min(K_MAX, Math.max(K_MIN, k)) * 1000) / 1000;
}
