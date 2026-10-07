"use client";
import { useState, useEffect } from "react";
import { ArrowLeftRight, Mic, Ear, Square } from "lucide-react";
import { COLORS, TYPE } from "@/lib/theme";
import { apiFetch } from "@/lib/firebase-client";
import { DIMTS_LANGS } from "@/lib/dimts/langs";
import { getPref, setPref } from "@/lib/prefs";
import { useRecorder } from "@/lib/useRecorder";
import { Button, card, field, note } from "./ui";

// Smart default: "my language" starts as the phone's language if Dimts supports it.
const phoneLang = () => { const c = (navigator.language || "en").slice(0, 2); return DIMTS_LANGS.some((l) => l.code === c) ? c : "en"; };

export default function Talk({ toast }) {
  const [my, setMy] = useState("en"); const [their, setTheir] = useState("am");
  const [rec, setRec] = useState(null);                 // 'say' | 'hear' | null — which button is recording
  const [busy, setBusy] = useState(false); const [log, setLog] = useState([]);
  const { start, stop } = useRecorder();

  useEffect(() => {
    const m = getPref("my", phoneLang()); let t = getPref("their", "am"); if (t === m) t = m === "am" ? "en" : "am";
    setMy(m); setTheir(t);
  }, []);
  const choose = (which, v) => {
    if (which === "my") { setMy(v); setPref("my", v); if (v === their) { const t = v === "am" ? "en" : "am"; setTheir(t); setPref("their", t); } }
    else { setTheir(v); setPref("their", v); if (v === my) { const m = v === "en" ? "am" : "en"; setMy(m); setPref("my", m); } }
  };
  const swap = () => { setMy(their); setTheir(my); setPref("my", their); setPref("their", my); };

  const press = async (direction) => {
    if (rec === direction) {
      setRec(null); setBusy(true);
      try {
        const blob = await stop(); const form = new FormData();
        form.append("audio", blob, "turn.webm"); form.append("direction", direction); form.append("my_lang", my); form.append("their_lang", their);
        const r = await apiFetch("/api/dimts/turn", { method: "POST", body: form });
        if (r.empty) toast("I did not hear anything. Try again, a bit closer.", "info");
        else { setLog((l) => [{ dir: r.direction, heard: r.heard, out: r.translated, cloned: r.voice_cloned }, ...l]); if (r.audio) new Audio(`data:audio/wav;base64,${r.audio}`).play().catch(() => {}); }
      } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
    } else if (!rec) {
      try { await start(); setRec(direction); } catch { toast("Allow the microphone to talk.", "error"); }
    }
  };
  const lang = (code) => DIMTS_LANGS.find((l) => l.code === code);
  const sel = (v, which) => <select value={v} onChange={(e) => choose(which, e.target.value)} style={{ ...field, flex: 1 }}>
    {DIMTS_LANGS.map((l) => <option key={l.code} value={l.code}>{l.name} · {l.native}</option>)}</select>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {sel(my, "my")}
          <button aria-label="Swap languages" onClick={swap} style={{ border: 0, background: "none", color: COLORS.brand, cursor: "pointer" }}><ArrowLeftRight size={20} /></button>
          {sel(their, "their")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <Button busy={busy && !rec} disabled={busy || (rec && rec !== "say")} onClick={() => press("say")}>
            {rec === "say" ? <><Square size={16} /> Send</> : <><Mic size={18} /> I speak</>}</Button>
          <Button busy={false} disabled={busy || (rec && rec !== "hear")} onClick={() => press("hear")} style={{ background: COLORS.brandSecondary }}>
            {rec === "hear" ? <><Square size={16} /> Send</> : <><Ear size={18} /> They speak</>}</Button>
        </div>
        <p style={note}>Tap, talk, tap again. <b>I speak</b> comes out loud in {lang(their)?.name} in your own voice. <b>They speak</b> comes to you in {lang(my)?.name}.</p>
        <p style={note}>Tell people you are using a translator. Their voice is never stored.</p>
      </div>
      {log.map((l, i) => (
        <div key={i} style={card}>
          <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary }}>{l.dir === "say" ? "You said" : "They said"}{l.cloned && " · in your voice"}</div>
          <div style={{ color: COLORS.textPrimary }}>{l.heard}</div>
          <div style={{ color: COLORS.brand, fontWeight: 700, marginTop: 4 }}>{l.out}</div>
        </div>))}
    </div>
  );
}
