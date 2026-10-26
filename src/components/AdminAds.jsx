'use client';
import React, { useCallback, useEffect, useState } from 'react';
import AdOverlay from './AdOverlay';
import { PLACEMENTS, CATEGORIES } from '@/lib/adsCore.js';

// Owner page: add / edit / switch off / delete ads and see the last 7 days of views and taps.
// Protected by ADS_ADMIN_KEY (typed here, kept only for this browser tab). All checks happen on the server.
const today = () => new Date().toISOString().slice(0, 10);
const plus = (d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const blank = () => ({ id: '', advertiser: '', category: 'event', placements: ['splash', 'pre_game'], image: '', clickUrl: '', title: '', titleAm: '', body: '', bodyAm: '', cta: 'Learn more', ctaAm: '', durationSec: 5, weight: 1, start: today(), end: plus(30), active: true });
const PLACE_LABEL = { splash: 'App open', pre_game: 'Before a game', rewarded: 'Watch for +2 spins' };

export default function AdminAds() {
  const [key, setKey] = useState(''); const [data, setData] = useState(null); const [msg, setMsg] = useState({ t: '', ok: false });
  const [form, setForm] = useState(blank()); const [busy, setBusy] = useState(false); const [preview, setPreview] = useState(null);
  useEffect(() => { try { setKey(sessionStorage.getItem('gebeta.adkey') || ''); } catch { /* private mode */ } }, []);

  const api = useCallback(async (body) => {
    const res = await fetch('/api/admin/ads', { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error || `Error ${res.status}`); return j;
  }, [key]);
  const load = useCallback(async () => {
    setBusy(true); setMsg({ t: '', ok: false });
    try { const j = await api(); setData(j); try { sessionStorage.setItem('gebeta.adkey', key); } catch { /* ignore */ } }
    catch (e) { setData(null); setMsg({ t: e.message, ok: false }); }
    setBusy(false);
  }, [api, key]);
  const run = async (body, done) => { setBusy(true); try { await api(body); setMsg({ t: done, ok: true }); await load(); } catch (e) { setMsg({ t: e.message, ok: false }); } setBusy(false); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const togglePlace = (p) => set('placements', form.placements.includes(p) ? form.placements.filter((x) => x !== p) : [...form.placements, p]);
  const status = (a) => (a.active === false ? ['off', 'Off'] : a.end < data.today ? ['ended', 'Ended'] : a.start > data.today ? ['soon', 'Scheduled'] : ['', 'Live']);

  return (
    <main className="adm">
      <h1>Ads</h1>
      <section>
        <label>Admin key<input type="password" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /></label>
        <button type="button" className="btn primary" disabled={busy || !key} onClick={load}>{data ? 'Refresh' : 'Open'}</button>
        {msg.t && <p className={msg.ok ? 'okmsg' : 'err'} role="status">{msg.t}</p>}
      </section>

      {data && <>
        <section>
          <h2 style={{ margin: 0 }}>{form.id && data.ads.some((a) => a.id === form.id) ? `Edit: ${form.id}` : 'New ad'}</h2>
          <div className="row">
            <label>ID (a–z, 0–9, - _)<input value={form.id} onChange={(e) => set('id', e.target.value.toLowerCase())} placeholder="abay-bank-nov" /></label>
            <label>Advertiser<input value={form.advertiser} onChange={(e) => set('advertiser', e.target.value)} placeholder="Abay Bank" /></label>
            <label>Type<select value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          <div className="chips" role="group" aria-label="Where it shows">{PLACEMENTS.map((p) => <label key={p}><input type="checkbox" checked={form.placements.includes(p)} onChange={() => togglePlace(p)} />{PLACE_LABEL[p]}</label>)}</div>
          <label>Picture link (https). Best: 1080×1350, under 300 KB<input value={form.image} onChange={(e) => set('image', e.target.value)} placeholder="https://firebasestorage.googleapis.com/…" /></label>
          <label>Where a tap goes (https, optional)<input value={form.clickUrl} onChange={(e) => set('clickUrl', e.target.value)} placeholder="https://abaybank.example/offer" /></label>
          <div className="row">
            <label>Title (English)<input value={form.title} maxLength={60} onChange={(e) => set('title', e.target.value)} /></label>
            <label>Title (አማርኛ)<input value={form.titleAm} maxLength={60} onChange={(e) => set('titleAm', e.target.value)} /></label>
          </div>
          <div className="row">
            <label>Line of text (English)<input value={form.body} maxLength={140} onChange={(e) => set('body', e.target.value)} /></label>
            <label>Line of text (አማርኛ)<input value={form.bodyAm} maxLength={140} onChange={(e) => set('bodyAm', e.target.value)} /></label>
          </div>
          <div className="row">
            <label>Button (English)<input value={form.cta} maxLength={24} onChange={(e) => set('cta', e.target.value)} /></label>
            <label>Button (አማርኛ)<input value={form.ctaAm} maxLength={24} onChange={(e) => set('ctaAm', e.target.value)} /></label>
            <label>Length, seconds (2–10)<input type="number" min={2} max={10} value={form.durationSec} onChange={(e) => set('durationSec', e.target.value)} /></label>
            <label>Weight (1–100, higher = more often)<input type="number" min={1} max={100} value={form.weight} onChange={(e) => set('weight', e.target.value)} /></label>
          </div>
          <div className="row">
            <label>First day<input type="date" value={form.start} onChange={(e) => set('start', e.target.value)} /></label>
            <label>Last day (included)<input type="date" value={form.end} onChange={(e) => set('end', e.target.value)} /></label>
          </div>
          <div className="acts">
            <button type="button" className="btn" disabled={!form.image} onClick={() => setPreview({ ...form, durationSec: Number(form.durationSec) || 5 })}>Preview</button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => run({ action: 'save', ad: form }, `Saved “${form.id}”.`)}>Save</button>
            <button type="button" className="btn ghost" onClick={() => setForm(blank())}>Clear</button>
          </div>
        </section>

        {data.ads.length === 0 && <p>No ads yet. Add the first one above.</p>}
        {data.ads.map((a) => { const [cls, label] = status(a); const s = data.stats[a.id] || { impressions: 0, clicks: 0, rewarded: 0 }; const ctr = s.impressions ? ((s.clicks / s.impressions) * 100).toFixed(1) : '0.0';
          return (
            <article key={a.id}>
              <div className="head">
                <img className="thumb" src={a.image} alt="" referrerPolicy="no-referrer" />
                <div><b>{a.advertiser}</b> <span className={`tag ${cls}`}>{label}</span><br /><small>{a.id} · {a.category} · {a.durationSec}s · weight {a.weight}<br />{a.start} → {a.end} · {(a.placements || []).map((p) => PLACE_LABEL[p]).join(', ')}</small></div>
              </div>
              <div className="stat" aria-label="Last 7 days"><span>Last 7 days:</span><span><b>{s.impressions}</b> shown</span><span><b>{s.clicks}</b> taps ({ctr}%)</span><span><b>{s.rewarded}</b> watched for spins</span></div>
              <div className="acts">
                <button type="button" className="btn" onClick={() => { setForm({ ...blank(), ...a }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                <button type="button" className="btn" disabled={busy} onClick={() => run({ action: 'toggle', id: a.id, active: a.active === false }, a.active === false ? 'Switched on.' : 'Switched off.')}>{a.active === false ? 'Switch on' : 'Switch off'}</button>
                <button type="button" className="btn ghost danger" disabled={busy} onClick={() => { if (confirm(`Delete “${a.id}”? This cannot be undone.`)) run({ action: 'delete', id: a.id }, 'Deleted.'); }}>Delete</button>
              </div>
            </article>
          ); })}
      </>}
      {preview && <AdOverlay ad={preview} lang="en" placement="splash" seconds={preview.durationSec} onClose={() => setPreview(null)} />}
    </main>
  );
}
