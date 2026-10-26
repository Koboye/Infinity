'use client';
import React, { useCallback, useEffect, useState } from 'react';
import AdOverlay from './AdOverlay';
import { PLACEMENTS, CATEGORIES } from '@/lib/adsCore.js';
import { adviseAd } from '@/lib/adsSmart.js';
import { today, plus, GAME_IDS, GAME_NAME, PLACE_LABEL, PLACE_PRESETS, placeKey, CTA_PRESETS, WEIGHTS, LENGTHS, STARTS, DURATIONS, TIMES, timeKey, PER_USER, DAILY, HOURS, imageProblem, slug, MONTH, autoId, daysBetween, addDays, plain } from '@/lib/adsAdminKit.js';

// Owner page: add / edit / switch off / delete ads and see the last 7 days of views and taps.
// Protected by ADS_ADMIN_KEY (typed here, kept only for this browser tab). All checks happen on the server.
const blank = () => ({ id: '', advertiser: '', category: 'event', placements: ['splash', 'pre_game'], image: '', clickUrl: '', title: '', titleAm: '', body: '', bodyAm: '', cta: 'Learn more', ctaAm: 'ተጨማሪ ይመልከቱ', durationSec: 5, weight: 1, start: today(), end: plus(30), active: true, langs: [], games: [], hourFrom: '', hourTo: '', maxPerUser: 3, dailyCap: 0 });

export default function AdminAds({ preload = null }) {   // `preload` lets tests render the page with data
  const [key, setKey] = useState(''); const [data, setData] = useState(preload); const [msg, setMsg] = useState({ t: '', ok: false });
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
  const [newAdv, setNewAdv] = useState(false), [idAuto, setIdAuto] = useState(true), [startKey, setStartKey] = useState('today'), [durKey, setDurKey] = useState(30), [pickGames, setPickGames] = useState(false);
  const [fStatus, setFStatus] = useState('all'), [fAdv, setFAdv] = useState('all'), [fSort, setFSort] = useState('new');
  const advertisers = data ? [...new Set(data.ads.map((a) => a.advertiser).filter(Boolean))].sort() : [];
  // one clear way to say "this advertiser": reuse the last ad of that advertiser for the category and the tap link
  const pickAdvertiser = (name) => setForm((f) => { const last = data?.ads.filter((a) => a.advertiser === name).sort((x, y) => (y.start > x.start ? 1 : -1))[0]; return { ...f, advertiser: name, category: last?.category || f.category, clickUrl: f.clickUrl || last?.clickUrl || '' }; });
  const [diag, setDiag] = useState(null);
  // "Why isn't my ad showing?": asks the same public feed phones use, then tries to load each picture the way the app does.
  const checkFeed = async () => {
    setDiag({ busy: true, rows: [], feedCount: null });
    let feed = null, feedErr = '';
    try { const r = await fetch(`/api/ads?fresh=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) throw new Error(`feed answered ${r.status}`); feed = (await r.json()).ads || []; } catch (e) { feedErr = e.message || 'feed failed'; }
    const loads = (src) => new Promise((res) => { const i = new Image(); const to = setTimeout(() => res(false), 7000); i.onload = () => { clearTimeout(to); res(true); }; i.onerror = () => { clearTimeout(to); res(false); }; i.referrerPolicy = 'no-referrer'; i.src = src; });
    const rows = [];
    for (const a of data.ads) {
      const why = [];
      if (a.active === false) why.push('it is switched off');
      else if (a.end < data.today) why.push(`it ended on ${a.end}`);
      else if (a.start > data.today) why.push(`it starts on ${a.start} (server date today is ${data.today}, UTC)`);
      const onlyRewarded = (a.placements || []).length > 0 && (a.placements || []).every((p) => p === 'rewarded');
      if (onlyRewarded) why.push('it is set to "Watch for free spins" only, so it never shows on open or before a game');
      const inFeed = feed ? feed.some((x) => x.id === a.id) : null;
      if (feed && !inFeed && !why.length) why.push(a.dailyCap > 0 ? 'the server is not sending it — its daily limit may be used up for today' : 'the server is not sending it (check Vercel → Logs for "ad stats read failed" or Firebase errors)');
      const pic = await loads(a.image);
      if (!pic) why.push('the picture does not load here: use a Firebase Storage link, or add its website to NEXT_PUBLIC_ADS_IMG_HOSTS in Vercel and redeploy');
      rows.push({ id: a.id, advertiser: a.advertiser, inFeed, pic, why });
    }
    setDiag({ busy: false, rows, feedCount: feed ? feed.length : null, feedErr });
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => { if (idAuto) setForm((f) => { const id = autoId(f.advertiser, f.start); return id === f.id ? f : { ...f, id }; }); }, [form.advertiser, form.start, idAuto]);
  const togglePlace = (p) => set('placements', form.placements.includes(p) ? form.placements.filter((x) => x !== p) : [...form.placements, p]);
  const togglePick = (k, v) => set(k, form[k].includes(v) ? form[k].filter((x) => x !== v) : [...form[k], v]);
  const statOf = (a) => data.stats[a.id] || { impressions: 0, clicks: 0 };
  const shownAds = data ? data.ads
    .filter((a) => (fAdv === 'all' || a.advertiser === fAdv) && (fStatus === 'all' || (fStatus === 'live' ? status(a)[1] === 'Live' : fStatus === 'soon' ? status(a)[0] === 'soon' : status(a)[0] === fStatus)))
    .sort((x, y) => (fSort === 'shown' ? statOf(y).impressions - statOf(x).impressions : fSort === 'taps' ? statOf(y).clicks - statOf(x).clicks
      : fSort === 'rate' ? (statOf(y).clicks / Math.max(1, statOf(y).impressions)) - (statOf(x).clicks / Math.max(1, statOf(x).impressions)) : (y.start > x.start ? 1 : y.start < x.start ? -1 : 0))) : [];
  function status(a) { return (a.active === false ? ['off', 'Off'] : a.end < data.today ? ['ended', 'Ended'] : a.start > data.today ? ['soon', 'Scheduled'] : ['', 'Live']); }

  return (
    <main className="adm">
      <h1>Ads</h1>
      <p className="okmsg">Test it now: <a href="/?adtest=1" target="_blank" rel="noopener">open the game in ad-test mode</a> — your ad shows on every open and every game start, with no waiting and nothing counted. Leave test mode with <code>/?adtest=0</code>.</p>
      <section>
        <label>Admin key<input type="password" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /></label>
        <button type="button" className="btn primary" disabled={busy || !key} onClick={load}>{data ? 'Refresh' : 'Open'}</button>
        {msg.t && <p className={msg.ok ? 'okmsg' : 'err'} role="status">{msg.t}</p>}
      </section>

      {data && <>
        <section className="adm-form">
          <h2 style={{ margin: 0 }}>{form.id && data.ads.some((a) => a.id === form.id) ? `Edit: ${form.id}` : 'New ad'}</h2>

          <h3 className="adm-step"><i>1</i> Client</h3>
          <div className="row">
            <label>Advertiser
              <select value={newAdv ? '__new' : (advertisers.includes(form.advertiser) ? form.advertiser : '__new')} onChange={(e) => { if (e.target.value === '__new') { setNewAdv(true); set('advertiser', ''); } else { setNewAdv(false); pickAdvertiser(e.target.value); } }}>
                {advertisers.map((x) => <option key={x} value={x}>{x}</option>)}
                <option value="__new">➕ New advertiser…</option>
              </select>
            </label>
            {(newAdv || !advertisers.includes(form.advertiser)) && <label>New advertiser name<input value={form.advertiser} onChange={(e) => set('advertiser', e.target.value)} placeholder="Abay Bank" /></label>}
            <label>Type<select value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          <label>Ad ID {idAuto && <small>(made for you — you can change it)</small>}
            <input value={form.id} onChange={(e) => { setIdAuto(false); set('id', e.target.value.toLowerCase()); }} placeholder="abay-bank-oct26" />
          </label>

          <h3 className="adm-step"><i>2</i> Where and how long</h3>
          <div className="row">
            <label>Where it shows
              <select value={placeKey(form.placements)} onChange={(e) => { const pr = PLACE_PRESETS.find((x) => x[0] === e.target.value); if (pr) set('placements', pr[2]); }}>
                {PLACE_PRESETS.map((x) => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
                {placeKey(form.placements) === 'custom' && <option value="custom">Custom ({form.placements.map((p) => PLACE_LABEL[p]).join(', ')})</option>}
              </select>
            </label>
            <label>Ad length
              <select value={Number(form.durationSec) || 5} onChange={(e) => set('durationSec', Number(e.target.value))}>
                {LENGTHS.map((n) => <option key={n} value={n}>{n} seconds{n === 5 ? ' (recommended)' : ''}</option>)}
              </select>
            </label>
            <label>How often vs other ads
              <select value={Number(form.weight) || 1} onChange={(e) => set('weight', Number(e.target.value))}>
                {WEIGHTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                {!WEIGHTS.some(([v]) => v === Number(form.weight)) && <option value={form.weight}>Custom ({form.weight}×)</option>}
              </select>
            </label>
          </div>

          <h3 className="adm-step"><i>3</i> The ad</h3>
          <div className="adm-pic">
            <div className="adm-thumb" aria-hidden="true">{form.image ? <img src={form.image} alt="" referrerPolicy="no-referrer" /> : <span>🖼</span>}</div>
            <div className="adm-pic-fields">
              <label>Picture link (https). Best: 1080×1350, under 300 KB<input value={form.image} onChange={(e) => set('image', e.target.value)} placeholder="https://firebasestorage.googleapis.com/…" /></label>
              {imageProblem(form.image, process.env.NEXT_PUBLIC_ADS_IMG_HOSTS || '') && <p className="err" role="alert">⚠️ {imageProblem(form.image, process.env.NEXT_PUBLIC_ADS_IMG_HOSTS || '')}</p>}
              <label>Where a tap goes (https, optional)<input value={form.clickUrl} onChange={(e) => set('clickUrl', e.target.value)} placeholder="https://abaybank.example/offer" /></label>
            </div>
          </div>
          <div className="row">
            <label>Title (English)<input value={form.title} maxLength={60} onChange={(e) => set('title', e.target.value)} /></label>
            <label>Title (አማርኛ)<input value={form.titleAm} maxLength={60} onChange={(e) => set('titleAm', e.target.value)} /></label>
          </div>
          <div className="row">
            <label>Line of text (English)<input value={form.body} maxLength={140} onChange={(e) => set('body', e.target.value)} /></label>
            <label>Line of text (አማርኛ)<input value={form.bodyAm} maxLength={140} onChange={(e) => set('bodyAm', e.target.value)} /></label>
          </div>
          <div className="row">
            <label>Button
              <select value={CTA_PRESETS.some((c) => c[0] === form.cta) ? form.cta : '__custom'} onChange={(e) => { const c = CTA_PRESETS.find((x) => x[0] === e.target.value); if (c) setForm((f) => ({ ...f, cta: c[0], ctaAm: c[1] })); else set('cta', ''); }}>
                {CTA_PRESETS.map((c) => <option key={c[0]} value={c[0]}>{c[0]} · {c[1]}</option>)}
                <option value="__custom">Write my own…</option>
              </select>
            </label>
            {!CTA_PRESETS.some((c) => c[0] === form.cta) && <>
              <label>Button (English)<input value={form.cta} maxLength={24} onChange={(e) => set('cta', e.target.value)} /></label>
              <label>Button (አማርኛ)<input value={form.ctaAm} maxLength={24} onChange={(e) => set('ctaAm', e.target.value)} /></label>
            </>}
          </div>

          <h3 className="adm-step"><i>4</i> Schedule</h3>
          <div className="row">
            <label>Starts
              <select value={startKey} onChange={(e) => { const x = STARTS.find((y) => y[0] === e.target.value); setStartKey(e.target.value); if (x && x[2] !== null) { const st = plus(x[2]); setForm((f) => ({ ...f, start: st, end: durKey > 0 ? addDays(st, durKey - 1) : f.end })); } }}>
                {STARTS.map((x) => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
              </select>
            </label>
            <label>Runs for
              <select value={durKey} onChange={(e) => { const n = Number(e.target.value); setDurKey(n); if (n > 0) set('end', addDays(form.start, n - 1)); }}>
                {DURATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          {(startKey === 'custom' || durKey === 0) && (
            <div className="row">
              <label>First day<input type="date" value={form.start} onChange={(e) => set('start', e.target.value)} /></label>
              <label>Last day (included)<input type="date" value={form.end} onChange={(e) => set('end', e.target.value)} /></label>
            </div>
          )}
          <p className="adm-note">📅 {form.start} → {form.end} · {Math.max(1, daysBetween(form.start, form.end))} days</p>

          <h3 className="adm-step"><i>5</i> Who sees it <small>(everyone by default)</small></h3>
          <div className="row">
            <label>Language
              <select value={form.langs.length === 1 ? form.langs[0] : 'all'} onChange={(e) => set('langs', e.target.value === 'all' ? [] : [e.target.value])}>
                <option value="all">Everyone</option><option value="en">English players</option><option value="am">አማርኛ players</option>
              </select>
            </label>
            <label>Time of day (phone time)
              <select value={timeKey(form.hourFrom, form.hourTo)} onChange={(e) => { const x = TIMES.find((y) => y[0] === e.target.value); if (!x) return; if (x[2] === null) setForm((f) => ({ ...f, hourFrom: '', hourTo: '' })); else if (x[2] === 'custom') setForm((f) => ({ ...f, hourFrom: f.hourFrom === '' ? 8 : f.hourFrom, hourTo: f.hourTo === '' || f.hourTo === f.hourFrom ? 20 : f.hourTo })); else setForm((f) => ({ ...f, hourFrom: x[2][0], hourTo: x[2][1] })); }}>
                {TIMES.map((x) => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
              </select>
            </label>
            <label>Before which games
              <select value={pickGames || form.games.length > 1 ? 'pick' : form.games.length === 1 ? form.games[0] : 'all'} onChange={(e) => { setPickGames(e.target.value === 'pick'); set('games', e.target.value === 'all' ? [] : e.target.value === 'pick' ? form.games : [e.target.value]); }}>
                <option value="all">All games</option>
                {GAME_IDS.map((g) => <option key={g} value={g}>{GAME_NAME[g]} only</option>)}
                <option value="pick">Pick several…</option>
              </select>
            </label>
          </div>
          {timeKey(form.hourFrom, form.hourTo) === 'custom' && (
            <div className="row">
              <label>From hour<select value={form.hourFrom} onChange={(e) => set('hourFrom', Number(e.target.value))}>{HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
              <label>Until hour (a later-than-start window can cross midnight)<select value={form.hourTo} onChange={(e) => set('hourTo', Number(e.target.value))}>{HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
            </div>
          )}
          {(form.games.length > 1 || pickGames) && (
            <div className="chips" role="group" aria-label="Games">{GAME_IDS.map((g) => <label key={g}><input type="checkbox" checked={form.games.includes(g)} onChange={() => togglePick('games', g)} />{GAME_NAME[g]}</label>)}</div>
          )}
          <div className="row">
            <label>Most views per player each day
              <select value={Number(form.maxPerUser) || 3} onChange={(e) => set('maxPerUser', Number(e.target.value))}>
                {PER_USER.map((n) => <option key={n} value={n}>{n} {n === 1 ? 'time' : 'times'}{n === 3 ? ' (recommended)' : ''}</option>)}
              </select>
            </label>
            <label>Daily limit, all players
              <select value={Number(form.dailyCap) || 0} onChange={(e) => set('dailyCap', Number(e.target.value))}>
                {DAILY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                {!DAILY.some(([v]) => v === Number(form.dailyCap)) && <option value={form.dailyCap}>{Number(form.dailyCap).toLocaleString()} views a day</option>}
              </select>
            </label>
          </div>

          <p className="adm-sum" role="status">{plain(form)}</p>
          <div className="acts">
            <button type="button" className="btn" disabled={!form.image} onClick={() => setPreview({ ...form, durationSec: Number(form.durationSec) || 5 })}>Preview</button>
            <button type="button" className="btn primary" disabled={busy || !form.id || !form.advertiser || !!imageProblem(form.image, process.env.NEXT_PUBLIC_ADS_IMG_HOSTS || '')} onClick={() => run({ action: 'save', ad: { ...form, hourFrom: form.hourFrom, hourTo: form.hourTo } }, `Saved “${form.id}”.`)}>Save</button>
            <button type="button" className="btn ghost" onClick={() => { setForm(blank()); setNewAdv(false); setIdAuto(true); setStartKey('today'); setDurKey(30); setPickGames(false); }}>Clear</button>
          </div>
        </section>

        <section className="adm-diag">
          <h3 style={{ margin: 0 }}>Why isn’t my ad showing?</h3>
          <p className="adm-note">Asks the server what players really receive and tests every picture.</p>
          <button type="button" className="btn" disabled={diag?.busy || !data.ads.length} onClick={checkFeed}>{diag?.busy ? 'Checking…' : 'Check now'}</button>
          {diag && !diag.busy && <>
            <p className={diag.feedErr ? 'err' : 'okmsg'}>{diag.feedErr ? `The ad feed failed: ${diag.feedErr}. Players get no ads until this works.` : `The server is sending ${diag.feedCount} ad${diag.feedCount === 1 ? '' : 's'} to phones.`}</p>
            <ul className="tips">{diag.rows.map((r) => (
              <li key={r.id} className={r.why.length ? 'warn' : 'good'}>{r.why.length ? '⚠️' : '✅'} <b>{r.advertiser}</b> ({r.id}) — {r.why.length ? r.why.join('; ') : 'live, sent to phones, picture loads. If you still see no ad: close the game fully and reopen it with /?adtest=1 on the end of the address.'}</li>
            ))}</ul>
          </>}
        </section>

        <section className="adm-filter" aria-label="Filter ads">
          <label>Show<select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="all">All ads</option><option value="live">Live now</option><option value="soon">Scheduled</option><option value="ended">Ended</option><option value="off">Switched off</option></select></label>
          <label>Advertiser<select value={fAdv} onChange={(e) => setFAdv(e.target.value)}><option value="all">Everyone</option>{advertisers.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <label>Sort by<select value={fSort} onChange={(e) => setFSort(e.target.value)}><option value="new">Newest first</option><option value="shown">Most shown</option><option value="taps">Most taps</option><option value="rate">Best tap rate</option></select></label>
        </section>

        {data.ads.length === 0 && <p>No ads yet. Add the first one above.</p>}
        {data.ads.length > 0 && shownAds.length === 0 && <p>No ads match this filter.</p>}
        {shownAds.map((a) => { const [cls, label] = status(a); const s = data.stats[a.id] || { impressions: 0, clicks: 0, rewarded: 0, today: 0 };
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
                <button type="button" className="btn" onClick={() => { setForm({ ...blank(), ...a, hourFrom: a.hours?.from ?? '', hourTo: a.hours?.to ?? '', games: a.games || [], langs: a.langs || [] }); setIdAuto(false); setNewAdv(false); setStartKey('custom'); setDurKey(0); setPickGames((a.games || []).length > 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                <button type="button" className="btn" onClick={() => { setForm({ ...blank(), ...a, id: '', start: today(), end: plus(30), hourFrom: a.hours?.from ?? '', hourTo: a.hours?.to ?? '', games: a.games || [], langs: a.langs || [] }); setIdAuto(true); setNewAdv(false); setStartKey('today'); setDurKey(30); setPickGames((a.games || []).length > 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Duplicate</button>
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
