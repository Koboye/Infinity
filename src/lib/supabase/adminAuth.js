/**
 * Authenticates admin-dashboard API requests. The dashboard (browser)
 * sends `Authorization: Bearer <supabase access_token>` from its
 * logged-in session; we verify it server-side with the service role
 * client and look up which company that user administers.
 * Returns { userId, companyId, role } or null if unauthorized.
 */
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function requireAdmin(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const db = supabaseAdmin();
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return null;

  const { data: membership, error: memErr } = await db
    .from('company_admins')
    .select('company_id, role')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (memErr || !membership) return null;

  return { userId: userData.user.id, companyId: membership.company_id, role: membership.role };
}
