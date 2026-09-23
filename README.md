# ገበያ Link — Gebeya Link

Sell, track stock, and keep the credit book — built for shops and traders
in Ethiopian towns. Fully offline-first: every sale is saved on the phone
the instant it happens, in Amharic first / English second.

## Status: v1 shipped, v2 (company backend) built — needs your Supabase/Stripe accounts

v1 (below) still works exactly as before with zero configuration — nothing
about the offline shopkeeper experience changed. v2 adds an optional
company backend so a business can license this to a network of shops and
see them all in one dashboard.

## Stack

Next.js 15 · React 19 · Tailwind · Framer Motion · Zustand (persisted to
`localStorage`) · lucide-react. v2 adds Supabase (Postgres + Auth) for
the backend and Stripe for billing — both optional; the app runs fully
without them.

```
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start   # production
```

## v2 — Company backend

**What it is:** a company (an MFI, distributor, cooperative, franchise
owner) signs up, provisions a shop-access code for each shop in their
network, and sees all of them in one dashboard — today's revenue, low
stock, outstanding credit, last sync time per shop — with the ability
to suspend a shop's sync instantly (fired agent, non-payer) without
touching anyone else's data.

**How it works:** the shopkeeper app is unchanged and still fully
functional offline. If (and only if) a shop enters a code under
Settings → Company Sync, the app periodically pushes its existing
`exportData()` snapshot to the backend. If sync ever fails — no
connection, suspended shop, lapsed billing — the app keeps working
normally and nothing local is lost; it just stops updating the
company's copy until sync succeeds again. A shop code also lets a
shopkeeper restore their data onto a replacement phone from the
onboarding screen ("Enter shop code") instead of losing everything to
a lost device.

**Architecture:**
- `supabase/schema.sql` — Postgres schema: `companies`, `company_admins`,
  `shops` (token-hash authenticated, holds a jsonb snapshot per shop).
  RLS policies scope the admin dashboard to each admin's own company;
  shop devices never talk to Supabase directly (see below).
- `src/app/api/sync/*` — the only endpoints a shop device calls
  (`push`, `restore`). They validate the shop's token server-side with
  the Supabase **service role** key, so the key never reaches any
  client.
- `src/app/api/shops/*`, `/api/companies/signup` — admin dashboard
  endpoints, authenticated by the admin's Supabase Auth session token.
- `src/app/api/billing/*` — Stripe Checkout, customer portal, and a
  signature-verified webhook that keeps `subscription_status` current.
- `src/app/admin/**` — the company's dashboard: sign up/in, shop list
  with live metrics, "add a shop" (shows the access code once), billing.
- `src/lib/sync.js`, and the "Company Sync" panel in the app's own
  Settings screen — the device side of all this.

**To turn v2 on:**
1. Create a project at [supabase.com](https://supabase.com).
2. Paste `supabase/schema.sql` into its SQL editor and run it once.
3. Copy `env.example` to `.env.local` and fill in the four `SUPABASE_*`
   values from Project Settings → API.
4. (Optional, for paid plans) Create a Stripe account, a recurring
   Price, and a webhook pointed at `/api/billing/webhook` subscribed to
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`. Fill in the `STRIPE_*` values.
5. `npm run dev`, go to `/admin`, "Create company account".
6. From the dashboard, "Add shop" — copy the code shown (shown once).
7. On a shop's phone: Settings → Company Sync → paste the code.

**What this does not include yet** (be upfront about this before
pitching it as finished): no automated tests, no staging environment,
no rate limiting on the sync endpoints beyond Supabase's own defaults,
no email invites for a second admin (only the signup flow's first
owner), and the dashboard's per-shop numbers come from each shop's
last-synced snapshot rather than a queryable relational schema — fine
at dozens of shops, worth revisiting before hundreds. `npm audit` also
flags a moderate/high advisory in a transitive dependency of Next.js
15 itself (fixed only by a Next 16 major upgrade) — not introduced by
this work, but worth a deliberate upgrade decision before a real launch.

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
- The lost-phone backup story is now solved by v2's shop-code restore
  once a shop is connected; a shop that never connects still relies on
  `Settings → Backup`'s manual JSON export — decide which you expect
  most shops to use before scaling past a handful.
- Before selling v2 to a real company: rotate the Supabase service role
  key if it's ever been pasted anywhere outside `.env.local`, review the
  RLS policies in `supabase/schema.sql` against your actual admin-invite
  flow (a second admin per company isn't wired up yet), and load-test
  `/api/sync/push` at your expected shop count and sync interval.
