"use client";
import { useState, useEffect, useRef } from "react";
import { Square, Download, Upload, ClipboardPaste, ChevronDown } from "lucide-react";
import { COLORS, TYPE, RADIUS } from "@/lib/theme";
import { apiFetch } from "@/lib/firebase-client";
import { getPref, setPref } from "@/lib/prefs";
import { Button, Check, card, field, note } from "./ui";

/* Plays the live dub as it is being made (HLS). Safari plays HLS natively; others load hls.js on demand. */
function LivePlayer({ src }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current; if (!v || !src) return; let hls;
    if (v.canPlayType("application/vnd.apple.mpegurl")) v.src = src;
    else import("hls.js").then(({ default: Hls }) => { if (Hls.isSupported()) { hls = new Hls(); hls.loadSource(src); hls.attachMedia(v); } });
    return () => hls && hls.destroy();
  }, [src]);
  return <video ref={ref} controls autoPlay playsInline style={{ width: "100%", aspectRatio: "16/9", borderRadius: RADIUS.md, background: "#000" }} />;
}

// Upload a video straight to Cloudinary with a server-signed request (no file ever passes through Next.js).
async function uploadVideo(file, onProgress) {
  const s = await apiFetch("/api/cloudinary-sign", { method: "POST", body: JSON.stringify({}) });
  const form = new FormData();
  form.append("file", file); form.append("api_key", s.apiKey); form.append("timestamp", s.timestamp); form.append("signature", s.signature);
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); x.open("POST", `https://api.cloudinary.com/v1_1/${s.cloudName}/video/upload`);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => { try { const j = JSON.parse(x.responseText); x.status < 300 ? resolve(j.secure_url) : reject(new Error(j.error?.message || "Upload failed")); } catch { reject(new Error("Upload failed")); } };
    x.onerror = () => reject(new Error("Upload failed. Check your connection."));
    x.send(form);
  });
}

export default function Dub({ caps, toast }) {
  const [url, setUrl] = useState("");
  const [rights, setRights] = useState(false);
  const [clone, setClone] = useState(true);
  const [bg, setBg] = useState(0.15);
  const [more, setMore] = useState(false);
  const [up, setUp] = useState(null);                       // upload progress 0..1
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [rows, setRows] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);

  // Smart: remember choices, and pick up a dub that was running when the page was closed.
  useEffect(() => { setClone(getPref("clone", true)); setBg(getPref("bg", 0.15)); setJobId(getPref("job", null)); }, []);
  useEffect(() => { if (caps && caps.cloneByDefault === false) setClone(false); }, [caps]);

  useEffect(() => {
    if (!jobId) return; let dead = false, t;
    const tick = async () => {
      try {
        const s = await apiFetch(`/api/dimts/jobs/${jobId}`); if (dead) return;
        setJob(s); setRows(s.rows || []);
        if (s.finished) { setVideoUrl(s.videoUrl || ""); setPref("job", null); }
        if (!s.finished && !s.error) t = setTimeout(tick, s.mode === "watch" ? 2500 : 2000);
      } catch (e) { if (!dead) { setPref("job", null); setJobId(null); if (!/not found/i.test(e.message)) toast(e.message, "error"); } }
    };
    tick(); return () => { dead = true; clearTimeout(t); };
  }, [jobId, toast]);

  const paste = async () => { try { setUrl((await navigator.clipboard.readText()).trim()); } catch { toast("Long-press the box and choose Paste.", "info"); } };
  const pick = async (file) => {
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) return toast("That video is over 500 MB. Use a shorter clip or paste a link.", "error");
    setUp(0);
    try { setUrl(await uploadVideo(file, setUp)); toast("Video uploaded.", "success"); }
    catch (e) { toast(e.message, "error"); } finally { setUp(null); }
  };

  const start = async () => {
    setBusy(true); setJob(null); setRows([]); setVideoUrl(""); setShowAll(false);
    setPref("clone", clone); setPref("bg", bg);
    try {
      const r = await apiFetch("/api/dimts/jobs", { method: "POST", body: JSON.stringify({ url: url.trim(), clone, bgVolume: bg, rights }) });
      setPref("job", r.jobId); setJobId(r.jobId);
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const stop = async () => { try { await apiFetch(`/api/dimts/jobs/${jobId}`, { method: "DELETE" }); setPref("job", null); toast("Stopped.", "info"); } catch (e) { toast(e.message, "error"); } };
  const apply = async () => {
    setBusy(true);
    try {
      const r = await apiFetch(`/api/dimts/jobs/${jobId}/redub`, { method: "POST", body: JSON.stringify({ rows, remember: true }) });
      setRows(r.rows); setVideoUrl(r.videoUrl); toast(`Fixed ${r.fixed} line${r.fixed === 1 ? "" : "s"}. I will remember them.`, "success");
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const running = job && !job.finished && !job.error;
  const live = job?.mode === "watch";
  const editable = job?.mode === "best" && job?.finished && !job?.error && rows.length > 0;
  const flagged = rows.map((r, i) => [r, i]).filter(([r]) => String(r[4] || "").startsWith("⚠"));
  const shown = !editable ? rows.map((r, i) => [r, i]) : showAll || !flagged.length ? rows.map((r, i) => [r, i]) : flagged;
  const edit = (i, v) => setRows(rows.map((x, j) => (j === i ? [...x.slice(0, 3), v, ...x.slice(4)] : x)));
  const ready = url.trim() && rights && up === null && !running;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={field} placeholder="Paste a video or live-stream link" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoCapitalize="off" />
          <button aria-label="Paste" onClick={paste} style={sq}><ClipboardPaste size={20} /></button>
          {caps?.uploads && <label aria-label="Upload a video" style={{ ...sq, cursor: "pointer" }}><Upload size={20} />
            <input type="file" accept="video/*" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>}
        </div>
        {up !== null && <div style={{ height: 6, borderRadius: 6, background: COLORS.surface3, marginTop: 10 }}>
          <div style={{ height: 6, borderRadius: 6, width: `${Math.round(up * 100)}%`, background: COLORS.gradient }} /></div>}
        {caps?.headline && <p style={note}>{caps.headline}</p>}
        <Check checked={rights} onChange={setRights}>I have the right to dub this video. The result is labelled AI-generated.</Check>
        <Button onClick={start} busy={busy} disabled={!ready}>Dub into Amharic</Button>
        {running && <Button tone="danger" onClick={stop} style={{ marginTop: 8 }}><Square size={14} /> Stop</Button>}
        <button onClick={() => setMore(!more)} style={{ border: 0, background: "none", color: COLORS.textSecondary, fontSize: TYPE.sm, marginTop: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          Options <ChevronDown size={14} style={{ transform: more ? "rotate(180deg)" : "none" }} /></button>
        {more && <div>
          <Check checked={clone} onChange={setClone}>Copy each speaker's voice <span style={{ color: COLORS.textSecondary }}>(slower; off = one standard voice)</span></Check>
          <label style={note}>Original sound under the dub: {Math.round(bg * 100)}%
            <input type="range" min="0" max="0.6" step="0.05" value={bg} onChange={(e) => setBg(+e.target.value)} style={{ width: "100%", accentColor: COLORS.brand }} /></label>
        </div>}
      </div>

      {job && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: job.error ? COLORS.dangerText : COLORS.textPrimary }}>{job.error ? `⚠️ ${job.error}` : job.finished ? "✅ Done" : job.stage}</div>
          {!job.finished && !live && <div style={{ height: 6, borderRadius: 6, background: COLORS.surface3, marginTop: 10 }}>
            <div style={{ height: 6, borderRadius: 6, width: `${Math.round((job.progress || 0) * 100)}%`, background: COLORS.gradient, transition: "width .4s" }} /></div>}
          {live && job.speed && <p style={note}>{job.speed}</p>}
          {live && job.playlistUrl && !videoUrl && <div style={{ marginTop: 12 }}><LivePlayer src={job.playlistUrl} /></div>}
          {videoUrl && <>
            <video src={videoUrl} controls playsInline style={{ width: "100%", marginTop: 12, borderRadius: RADIUS.md, background: "#000" }} />
            <a href={videoUrl} download style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 8, color: COLORS.brand, fontWeight: 700 }}><Download size={16} /> Download</a></>}
        </div>
      )}

      {shown.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>
            {editable ? (flagged.length ? `${flagged.length} line${flagged.length === 1 ? "" : "s"} need a quick check` : "Everything looks fine") : "What is being said"}</div>
          {editable && <p style={note}>Fix any Amharic, then press Apply. Only the lines you change are re-spoken, and I remember them.</p>}
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {shown.map(([r, i]) => (
              <div key={i} style={{ padding: 10, borderRadius: RADIUS.md, background: COLORS.surfaceAlt }}>
                <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary }}>{r[0]} · {r[1]} {r[4] && <b style={{ color: String(r[4]).startsWith("⚠") ? COLORS.warningText : COLORS.successText }}>{r[4]}</b>}</div>
                <div style={{ fontSize: TYPE.md, color: COLORS.textPrimary, margin: "4px 0 6px" }}>{r[2]}</div>
                {editable ? <textarea style={{ ...field, minHeight: 44 }} value={r[3]} onChange={(e) => edit(i, e.target.value)} />
                  : <div style={{ fontSize: TYPE.md, color: COLORS.brand }}>{r[3]}</div>}
              </div>))}
          </div>
          {editable && flagged.length > 0 && <button onClick={() => setShowAll(!showAll)} style={{ border: 0, background: "none", color: COLORS.brand, fontWeight: 700, margin: "10px 0 0", cursor: "pointer" }}>
            {showAll ? "Show only the lines to check" : `Show all ${rows.length} lines`}</button>}
          {editable && <Button onClick={apply} busy={busy} style={{ marginTop: 12 }}>Apply my fixes</Button>}
        </div>
      )}
    </div>
  );
}
const sq = { width: 48, flex: "none", borderRadius: RADIUS.md, border: `1px solid ${COLORS.surface4}`, background: COLORS.surfaceAlt, color: COLORS.brand, display: "grid", placeItems: "center", cursor: "pointer" };
