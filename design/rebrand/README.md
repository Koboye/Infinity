# ExamPro rebrand – screens 1 and 2
Open `index.html` in a browser (no build step).
1. Home: hero, level ladder (Grade 1 to Master's), level cards, feature strip.
2. Take test: level tabs, subject picker, live test summary.
Tokens (colors, type) live in `:root` at the top of the file.


## Brand assets (v4)

- Mark: infinity loop in ink (`#0F1B4C`) on a sun-yellow gradient tile (`#FFDB6B` to `#FFB800`). Same mark in the app (`Mark` in `InfinityAuth.jsx`), `public/icon.svg`, PWA icons, Apple touch icon, and the link preview.
- Lockup: `public/infinity-logo.svg` (mark + Bricolage Grotesque 800 wordmark).
- Link preview: `public/og-image.png` (1200x630). Maskable icon keeps the loop inside the 80% safe zone.
- Loading state: the mark draws its own loop (`<Mark live />`), and respects reduced motion.
