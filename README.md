# ገበያ Link — Gebeya Link

Sell, track stock, and keep the credit book — built for shops and traders
in Ethiopian towns. Fully offline-first: every sale is saved on the phone
the instant it happens, in Amharic first / English second.

## Status: ready to ship as v1

This build is clean — **no mock data, no placeholder accounts, no seeded
items or sales.** A fresh install opens straight into setup and starts
with an empty store; everything a shopkeeper sees is data they entered.

## Stack

Next.js 15 · React 19 · Tailwind · Framer Motion · Zustand (persisted to
`localStorage`) · lucide-react. No backend, no API keys, no signup —
`env.example` is a placeholder for version 2 (SMS/Telegram sync), not a
requirement to run v1.

```
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start   # production
```

## What's built (v1 — matches screens 1–13 of the design doc)

- **Onboarding** — language, phone, 4-digit PIN, shop setup
- **Home** — today's sales & profit (animated), low-stock / overdue
  alerts, an optional daily sales goal with a progress bar, and a
  streak indicator for consecutive days logged — a light nudge to open
  the app daily, not a dark pattern (no fake urgency, no nagging)
- **Sell** — 3-tap sale: pick items → cash / Telebirr / credit → receipt,
  shareable by SMS
- **Buy stock** — same pattern, cash or credit from a supplier
- **Stock** — red / gold / green status at a glance, add/edit items,
  stock count with a missing-value report (this is what catches theft
  and mistakes)
- **Book** — customer & supplier ledgers, full statement, partial or
  full payments, one-tap SMS reminder, one-tap call
- **More** — Reports (today/week/month + best sellers), Expenses,
  Settings (language, Ethiopian/Gregorian calendar, dark mode, PIN
  lock, JSON backup/restore), Help

**Delivery, Market prices and Staff roles are intentionally marked
"Soon"** in the More menu — they're version 2/3 per the design doc's
build order, not missing features. Wire them up when the backend for
them exists; the navigation already has their place reserved.

## Design system

`src/lib/theme.js` is the single source of truth — green (main action /
stock fine), gold (warning / due soon), red (overdue / out of stock).
Colour never carries meaning alone: every status also has a word or a
number. Tap targets ≥48px, 14px+ type, Amharic labels first. Dark mode
is a real second palette (`COLORS_DARK`), not just a filter.

## Before a public launch

- Check tax-receipt rules with ERCA and any carrier-licensing rules
  before enabling delivery.
- Test the onboarding → sell → stock count loop with 5 real shopkeepers
  and watch where they hesitate — the design doc's own advice, and
  still the fastest way to find friction this build can't predict.
- Decide the backup story for a lost/broken phone before scaling past a
  handful of shops — right now `Settings → Backup` produces one JSON
  file the owner keeps themselves; a cloud sync (Firebase, Supabase,
  etc.) is the natural v2 addition once you're ready to add a backend.
