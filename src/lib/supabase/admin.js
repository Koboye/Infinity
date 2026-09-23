/**
 * Server-only Supabase client (service role key).
 * Import this ONLY from API routes (src/app/api/**). It bypasses RLS,
 * so every route using it must do its own authorization check —
 * either a Supabase Auth session (admin routes) or a shop token
 * hash match (device sync routes). Never import this from a
 * 'use client' component — the service role key must never reach
 * the browser bundle.
 */
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function supabaseAdmin() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.'
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
