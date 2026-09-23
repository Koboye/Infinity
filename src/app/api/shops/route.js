import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/adminAuth';

export const runtime = 'nodejs';

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: shops, error } = await db
    .from('shops')
    .select('id, name, town, phone, active, snapshot, snapshot_updated_at, last_seen_at, created_at')
    .eq('company_id', admin.companyId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });

  // Reduce each shop's snapshot to dashboard-relevant numbers only —
  // never ship the shop's full ledger/customer list to the list view.
  const summarized = shops.map((s) => {
    const snap = s.snapshot?.data || null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    const salesToday = snap?.sales?.filter((x) => x.ts >= todayTs) || [];
    const revenueToday = salesToday.reduce((a, x) => a + (x.total || 0), 0);
    const lowStock = snap?.items?.filter((i) => i.qty <= (i.alert || 0)).length || 0;
    const outstandingCredit = (snap?.ledger || []).reduce(
      (a, l) => a + (l.kind === 'charge' ? l.amount : -l.amount), 0
    );
    return {
      id: s.id, name: s.name, town: s.town, phone: s.phone, active: s.active,
      lastSeenAt: s.last_seen_at, snapshotUpdatedAt: s.snapshot_updated_at,
      hasData: !!snap,
      revenueToday, salesCountToday: salesToday.length, lowStock,
      outstandingCredit: Math.max(0, outstandingCredit),
    };
  });

  return NextResponse.json({ ok: true, shops: summarized });
}
