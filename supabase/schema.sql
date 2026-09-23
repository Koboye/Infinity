-- ═══════════════════════════════════════════════════════════════════
-- Gebeya Link — v2 multi-tenant schema
-- ═══════════════════════════════════════════════════════════════════
-- Model:
--   company        — the paying customer (an MFI, distributor, cooperative...)
--   company_admins — humans who log in (Supabase Auth) to run the dashboard
--   shops          — one row per shopkeeper device the company has provisioned.
--                    Each shop authenticates with a bearer TOKEN (shown once,
--                    stored here only as a hash), never with email/password —
--                    shopkeepers should never have to manage a login.
--   shops.snapshot — the shop's full local data (items/people/ledger/sales/...),
--                    the exact JSON already produced by exportData() in the
--                    existing app. Storing it as one jsonb blob per shop keeps
--                    v2 simple and correct: the offline app is unchanged, the
--                    backend just gains a mirror of what each shop already
--                    has, so the company can see it. A columnar/relational
--                    version (queryable sales rows, etc.) is a clean v3
--                    migration once volume justifies it — this ships today.
--
-- Run this once in the Supabase SQL editor for a fresh project.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── companies ──────────────────────────────────────────────────────
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial',              -- 'trial' | 'starter' | 'growth' | 'enterprise'
  shop_limit int not null default 5,                -- enforced on provision; raise per plan
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'trialing', -- trialing|active|past_due|canceled
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

-- ── company_admins ─────────────────────────────────────────────────
-- Links a Supabase Auth user to the company(ies) they can administer.
create table company_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null default 'owner',               -- 'owner' | 'admin'
  created_at timestamptz not null default now()
);
create index company_admins_company_idx on company_admins(company_id);

-- ── shops ──────────────────────────────────────────────────────────
create table shops (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  town text,
  phone text,
  token_hash text not null unique,                  -- sha256(plaintext token); plaintext shown once at provision time and never stored
  active boolean not null default true,              -- flip to false to instantly cut off sync (fired agent, non-payer)
  snapshot jsonb,                                    -- last pushed exportData() blob
  snapshot_updated_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index shops_company_idx on shops(company_id);

-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
-- API routes for shop devices use the SERVICE ROLE key (bypasses RLS,
-- and does its own token_hash check in code — see /api/sync/*).
-- RLS below governs only the admin dashboard, which uses normal
-- Supabase Auth sessions with the anon key.
-- ═══════════════════════════════════════════════════════════════════

alter table companies enable row level security;
alter table company_admins enable row level security;
alter table shops enable row level security;

create policy "admins read own company"
  on companies for select
  using (id in (select company_id from company_admins where user_id = auth.uid()));

create policy "admins read own membership"
  on company_admins for select
  using (user_id = auth.uid());

create policy "admins read own shops"
  on shops for select
  using (company_id in (select company_id from company_admins where user_id = auth.uid()));

create policy "admins update own shops"
  on shops for update
  using (company_id in (select company_id from company_admins where user_id = auth.uid()));

-- Inserts (new company signup, new shop provisioning, new admin invite)
-- go through API routes using the service role key, which bypasses RLS
-- entirely and applies its own checks (auth session, shop_limit, plan).
