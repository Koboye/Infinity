"use client";
import { useState } from "react";
import { Mic, Square, Upload, Volume2 } from "lucide-react";
import { COLORS } from "@/lib/theme";
import { apiFetch } from "@/lib/firebase-client";
import { useRecorder } from "@/lib/useRecorder";
import { Button, Check, card, field, note } from "./ui";

export default function Voice({ toast }) {
  const [sample, setSample] = useState(null); const [text, setText] = useState(""); const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false); const [busy, setBusy] = useState(false); const [out, setOut] = useState("");
  const { start, stop } = useRecorder();

  const toggle = async () => {
    if (recording) { setSample(await stop()); setRecording(false); }
    else { try { await start(); setRecording(true); } catch { toast("Allow the microphone to record.", "error"); } }
  };
  const run = async () => {
    setBusy(true);
    try {
      const form = new FormData(); form.append("sample", sample); form.append("text", text); form.append("consent", String(consent));
      const res = await apiFetch("/api/dimts/voice", { method: "POST", body: form, raw: true });
      setOut(URL.createObjectURL(await res.blob()));
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  return (
    <div style={{ ...card, display: "grid", gap: 10 }}>
      <p style={{ ...note, margin: 0 }}>Record or upload about 10 seconds of a voice, type Amharic, and hear it in that voice.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Button onClick={toggle}>{recording ? <><Square size={16} /> Stop</> : <><Mic size={18} /> Record</>}</Button>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, background: COLORS.surfaceAlt, color: COLORS.brand, fontWeight: 700, cursor: "pointer" }}>
          <Upload size={18} /> Upload<input type="file" accept="audio/*" hidden onChange={(e) => setSample(e.target.files?.[0] || null)} /></label>
      </div>
      {sample && <div style={{ ...note, color: COLORS.successText }}>✓ Voice sample ready</div>}
      <textarea style={{ ...field, minHeight: 90 }} placeholder="ሰላም ነው፣ እንዴት ነህ?" value={text} onChange={(e) => setText(e.target.value)} maxLength={600} />
      <Check checked={consent} onChange={setConsent}>This is my own voice, or I have the owner's permission to clone it.</Check>
      <Button onClick={run} busy={busy} disabled={!sample || !text.trim() || !consent}><Volume2 size={18} /> Speak it</Button>
      {out && <audio src={out} controls style={{ width: "100%" }} />}
    </div>
  );
}
