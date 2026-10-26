'use client';
import React, { useCallback, useEffect, useState } from 'react';
import AdOverlay from './AdOverlay';
import { PLACEMENTS, CATEGORIES } from '@/lib/adsCore.js';
import { adviseAd } from '@/lib/adsSmart.js';

// Owner page: add / edit / switch off / delete ads and see the last 7 days of views and taps.
// Protected by ADS_ADMIN_KEY (typed here, kept only for this browser tab). All checks happen on the server.
const today = () => new Date().toISOString().slice(0, 10);
const plus = (d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const blank = () => ({ id: '', advertiser: '', category: 'event', placements: ['splash', 'pre_game'], image: '', clickUrl: '', title: '', titleAm: '', body: '', bodyAm: '', cta: 'Learn more', ctaAm: '', durationSec: 5, weight: 1, start: today(), end: plus(30), active: true, langs: [], games: '', hourFrom: '', hourTo: '', maxPerUser: 3, dailyCap: 0 });
const GAME_IDS = ['gebeta', 'checkers', 'bingo', 'ludo', 'dominoes'];
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
  const togglePick = (k, v) => set(k, form[k].includes(v) ? form[k].filter((x) => x !== v) : [...form[k], v]);
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
          <h3 style={{ margin: '8px 0 0' }}>Smart targeting <small>(optional — empty means everyone, always)</small></h3>
          <div className="chips" role="group" aria-label="Languages">{['en', 'am'].map((l) => <label key={l}><input type="checkbox" checked={form.langs.includes(l)} onChange={() => togglePick('langs', l)} />{l === 'en' ? 'English players' : 'አማርኛ players'}</label>)}</div>
          <div className="row">
            <label>Only from hour (0–23, phone time)<input type="number" min={0} max={23} value={form.hourFrom} onChange={(e) => set('hourFrom', e.target.value)} /></label>
            <label>until hour (0–23; 22 → 6 crosses midnight)<input type="number" min={0} max={23} value={form.hourTo} onChange={(e) => set('hourTo', e.target.value)} /></label>
            <label>Only before these games (comma separated: {GAME_IDS.join(', ')})<input value={Array.isArray(form.games) ? form.games.join(', ') : form.games} onChange={(e) => set('games', e.target.value)} placeholder="all games" /></label>
          </div>
          <div className="row">
            <label>Most views per player per day<input type="number" min={1} max={20} value={form.maxPerUser} onChange={(e) => set('maxPerUser', e.target.value)} /></label>
            <label>Daily limit, all players (0 = none; spread over the day)<input type="number" min={0} value={form.dailyCap} onChange={(e) => set('dailyCap', e.target.value)} /></label>
          </div>
          <div className="acts">
            <button type="button" className="btn" disabled={!form.image} onClick={() => setPreview({ ...form, durationSec: Number(form.durationSec) || 5 })}>Preview</button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => run({ action: 'save', ad: { ...form, games: Array.isArray(form.games) ? form.games : String(form.games || '').split(',') } }, `Saved “${form.id}”.`)}>Save</button>
            <button type="button" className="btn ghost" onClick={() => setForm(blank())}>Clear</button>
          </div>
        </section>

        {data.ads.length === 0 && <p>No ads yet. Add the first one above.</p>}
        {data.ads.map((a) => { const [cls, label] = status(a); const s = data.stats[a.id] || { impressions: 0, clicks: 0, rewarded: 0, today: 0 };
          const all = Object.values(data.stats); const totI = all.reduce((x, y) => x + y.impressions, 0), totC = all.reduce((x, y) => x + y.clicks, 0);
          const tips = adviseAd(a, { i: s.impressions, c: s.clicks, today: s.today }, { today: data.today, avg: totI >= 500 ? totC / totI : 0 }); const ctr = s.impressions ? ((s.clicks / s.impressions) * 100).toFixed(1) : '0.0';
          return (
            <article key={a.id}>
              <div className="head">
                <img className="thumb" src={a.image} alt="" referrerPolicy="no-referrer" />
                <div><b>{a.advertiser}</b> <span className={`tag ${cls}`}>{label}</span><br /><small>{a.id} · {a.category} · {a.durationSec}s · weight {a.weight}<br />{a.start} → {a.end} · {(a.placements || []).map((p) => PLACE_LABEL[p]).join(', ')}</small></div>
              </div>
              <div className="stat" aria-label="Last 7 days"><span>Last 7 days:</span><span><b>{s.impressions}</b> shown</span><span><b>{s.clicks}</b> taps ({ctr}%)</span><span><b>{s.rewarded}</b> watched for spins</span></div>
              {a.dailyCap > 0 && <div className="stat"><span>Today: <b>{s.today}</b> of {a.dailyCap}</span></div>}
              {tips.length > 0 && <ul className="tips">{tips.map((x, i) => <li key={i} className={x.level}>{x.level === 'warn' ? '⚠️' : x.level === 'good' ? '✅' : 'ℹ️'} {x.text}</li>)}</ul>}
              <div className="acts">
                <button type="button" className="btn" onClick={() => { setForm({ ...blank(), ...a, hourFrom: a.hours?.from ?? '', hourTo: a.hours?.to ?? '', games: (a.games || []).join(', '), langs: a.langs || [] }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
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
