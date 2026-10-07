"use client";
import { useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { COLORS, TYPE, RADIUS } from "@/lib/theme";

export const card = { background: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, border: `1px solid ${COLORS.surface3}` };
export const field = { width: "100%", padding: "13px 14px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.surface4}`,
  background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: TYPE.md, outline: "none" };
export const note = { fontSize: TYPE.sm, color: COLORS.textSecondary, margin: "6px 0 0", lineHeight: 1.45 };

export function Button({ children, busy, disabled, tone = "brand", style, ...rest }) {
  const off = disabled || busy;
  const bg = tone === "danger" ? COLORS.danger : tone === "quiet" ? COLORS.surfaceAlt : COLORS.gradient;
  return (
    <button disabled={off} {...rest} style={{ width: "100%", padding: 14, border: "none", borderRadius: RADIUS.pill, fontWeight: 700,
      fontSize: TYPE.lg, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: off ? "not-allowed" : "pointer",
      opacity: off ? 0.55 : 1, background: bg, color: tone === "quiet" ? COLORS.brand : "#fff", ...style }}>
      {busy ? <Loader2 size={18} className="spin" /> : children}
    </button>
  );
}

export function Check({ checked, onChange, children }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: TYPE.md, color: COLORS.textPrimary, margin: "10px 0" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, accentColor: COLORS.brand }} />
      <span>{children}</span>
    </label>
  );
}

// One toast at a time, auto-hides. Usage: const [toast, toastNode] = useToast();
export function useToast() {
  const [msg, setMsg] = useState(null); const timer = useRef();
  const toast = useCallback((text, kind = "info") => {
    setMsg({ text, kind }); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(null), 4500);
  }, []);
  const node = msg && (
    <div role="status" style={{ position: "fixed", left: 16, right: 16, bottom: 88, zIndex: 50, maxWidth: 520, margin: "0 auto", padding: "12px 16px",
      borderRadius: RADIUS.md, color: "#fff", fontSize: TYPE.md,
      background: msg.kind === "error" ? COLORS.danger : msg.kind === "success" ? COLORS.successText : COLORS.brand }}>{msg.text}</div>
  );
  return [toast, node];
}
