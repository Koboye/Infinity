/**
 * Browser Supabase client (anon key). Used by the admin dashboard
 * (src/app/admin/**) for login/session and RLS-governed reads.
 * The shopkeeper app itself never uses this — devices talk to our
 * own API routes, not Supabase directly (see src/lib/sync.js).
 */
'use client';
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function supabaseBrowser() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  _client = createClient(url, key);
  return _client;
}
