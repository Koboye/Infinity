'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/supabase/useSession';

type Shop = {
  id: string; name: string; town: string | null; phone: string | null; active: boolean;
  lastSeenAt: string | null; snapshotUpdatedAt: string | null; hasData: boolean;
  revenueToday: number; salesCountToday: number; lowStock: number; outstandingCredit: number;
};

function birr(n: number) {
  return `${Math.round(n).toLocaleString()} birr`;
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never synced';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function AdminDashboard() {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await apiFetch('/api/shops');
    if (!res.ok) { setError(res.body?.error || 'Could not load shops.'); return; }
    setShops(res.body.shops);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (shop: Shop) => {
    setShops((prev) => prev?.map((s) => (s.id === shop.id ? { ...s, active: !s.active } : s)) ?? prev);
    const res = await apiFetch(`/api/shops/${shop.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !shop.active }),
    });
    if (!res.ok) load(); // revert by reloading truth from server
  };

  const totals = shops?.reduce(
    (a, s) => ({ revenue: a.revenue + s.revenueToday, credit: a.credit + s.outstandingCredit, shops: a.shops + 1 }),
    { revenue: 0, credit: 0, shops: 0 }
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Shops</h1>
        <Link href="/admin/shops/new" className="bg-accent text-white text-sm rounded-md px-4 py-2 font-medium">
          + Add shop
        </Link>
      </div>

      {error && <div className="text-sm text-danger mb-4">{error}</div>}

      {shops && shops.length > 0 && totals && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-bg-elev1 border border-border rounded-xl p-4">
            <div className="text-xs text-text-secondary">Shops</div>
            <div className="text-2xl font-semibold mt-1">{totals.shops}</div>
          </div>
          <div className="bg-bg-elev1 border border-border rounded-xl p-4">
            <div className="text-xs text-text-secondary">Revenue today (all shops)</div>
            <div className="text-2xl font-semibold mt-1">{birr(totals.revenue)}</div>
          </div>
          <div className="bg-bg-elev1 border border-border rounded-xl p-4">
            <div className="text-xs text-text-secondary">Outstanding credit</div>
            <div className="text-2xl font-semibold mt-1">{birr(totals.credit)}</div>
          </div>
        </div>
      )}

      {shops === null && !error && <div className="text-sm text-text-secondary">Loading…</div>}

      {shops && shops.length === 0 && (
        <div className="bg-bg-elev1 border border-border rounded-xl p-8 text-center">
          <div className="font-medium mb-1">No shops yet</div>
          <div className="text-sm text-text-secondary mb-4">
            Add your first shop to get a code the shopkeeper enters on their phone.
          </div>
          <Link href="/admin/shops/new" className="bg-accent text-white text-sm rounded-md px-4 py-2 font-medium">
            + Add shop
          </Link>
        </div>
      )}

      {shops && shops.length > 0 && (
        <div className="bg-bg-elev1 border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary border-b border-border">
                <th className="px-4 py-3 font-medium">Shop</th>
                <th className="px-4 py-3 font-medium">Today</th>
                <th className="px-4 py-3 font-medium">Low stock</th>
                <th className="px-4 py-3 font-medium">Credit out</th>
                <th className="px-4 py-3 font-medium">Last sync</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-text-secondary text-xs">{s.town || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    {s.hasData ? `${birr(s.revenueToday)} · ${s.salesCountToday} sales` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {s.lowStock > 0 ? <span className="text-warning font-medium">{s.lowStock} items</span> : '—'}
                  </td>
                  <td className="px-4 py-3">{s.outstandingCredit > 0 ? birr(s.outstandingCredit) : '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{timeAgo(s.snapshotUpdatedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(s)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        s.active ? 'bg-accent-soft text-accent' : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {s.active ? 'Active' : 'Suspended'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
