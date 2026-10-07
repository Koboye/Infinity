"use client";
import { useState, useEffect } from "react";
import { COLORS, TYPE } from "@/lib/theme";
import { apiFetch } from "@/lib/firebase-client";
import { Button, card, field, note } from "./ui";

function Table({ title, a, b, rows, set }) {
  const upd = (i, k, v) => set(rows.map((r, j) => (j === i ? (k === 0 ? [v, r[1]] : [r[0], v]) : r)));
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, color: COLORS.textPrimary, marginBottom: 8 }}>{title}</div>
      {rows.length === 0 && <p style={note}>Nothing yet. Corrections you make while dubbing appear here.</p>}
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, marginBottom: 6 }}>
          <input style={field} placeholder={a} value={r[0]} onChange={(e) => upd(i, 0, e.target.value)} />
          <input style={field} placeholder={b} value={r[1]} onChange={(e) => upd(i, 1, e.target.value)} />
          <button aria-label="Remove" onClick={() => set(rows.filter((_, j) => j !== i))} style={{ border: 0, background: "none", color: COLORS.danger, fontSize: TYPE.xl, cursor: "pointer" }}>×</button>
        </div>))}
      <button onClick={() => set([...rows, ["", ""]])} style={{ border: 0, background: "none", color: COLORS.brand, fontWeight: 700, cursor: "pointer" }}>+ Add</button>
    </div>
  );
}

export default function Fixes({ toast }) {
  const [lines, setLines] = useState([]); const [words, setWords] = useState([]); const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false);
  useEffect(() => { apiFetch("/api/dimts/fixes").then((r) => { setLines(r.lines); setWords(r.words); setLoaded(true); }).catch((e) => toast(e.message, "error")); }, [toast]);
  const save = async () => {
    setBusy(true);
    try { const r = await apiFetch("/api/dimts/fixes", { method: "PUT", body: JSON.stringify({ lines, words }) });
      toast(`Saved. I remember ${r.lines} sentence${r.lines === 1 ? "" : "s"} and ${r.words} word${r.words === 1 ? "" : "s"}.`, "success"); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ ...note, margin: 0 }}>My Fixes: I never repeat a mistake you corrected. A fixed sentence comes out exactly as you wrote it; a fixed word is swapped every time.</p>
      <Table title="Sentences" a="When they say…" b="Always say (Amharic)" rows={lines} set={setLines} />
      <Table title="Words and names" a="Wrong word" b="Right word" rows={words} set={setWords} />
      <Button onClick={save} busy={busy} disabled={!loaded}>Save</Button>
    </div>
  );
}
