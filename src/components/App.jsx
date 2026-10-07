"use client";
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Film, Languages, Mic, CheckCheck, LogOut, Loader2 } from "lucide-react";
import { COLORS, TYPE, RADIUS } from "@/lib/theme";
import { fbAuth, apiFetch } from "@/lib/firebase-client";
import { getPref, setPref } from "@/lib/prefs";
import { useToast, card, note } from "./ui";
import Auth from "./Auth";
import Dub from "./Dub";
import Talk from "./Talk";
import Voice from "./Voice";
import Fixes from "./Fixes";

/**
 * Dimts (ድምጽ) — hear the world in Amharic, in every speaker's own voice.
 * One screen at a time. Dub is the home screen; Talk and Voice are one tap away; My Fixes is in the header.
 */
const NAV = [{ id: "dub", label: "Dub", Icon: Film }, { id: "talk", label: "Talk", Icon: Languages }, { id: "voice", label: "Voice", Icon: Mic }];

export default function App() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState("dub");
  const [caps, setCaps] = useState(null);
  const [toast, toastNode] = useToast();

  useEffect(() => { setTab(getPref("tab", "dub")); return onAuthStateChanged(fbAuth(), (u) => setUser(u || null)); }, []);
  useEffect(() => { if (user) apiFetch("/api/dimts/capabilities").then(setCaps).catch(() => setCaps({ online: false })); }, [user]);
  const go = (t) => { setTab(t); if (t !== "fixes") setPref("tab", t); };

  const status = !caps ? null : caps.online ? (caps.ready ? ["🟢", "Ready"] : ["🟡", "Warming up"]) : caps.text ? ["🟡", "Text only (no GPU)"] : ["🔴", "Server offline"];

  return (
    <div style={{ minHeight: "100dvh", background: COLORS.bg, paddingBottom: 96 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "18px 16px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: TYPE["3xl"], fontWeight: 800, color: COLORS.textPrimary, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              Dim<span style={{ color: COLORS.brand }}>ts</span> <span style={{ opacity: 0.4 }}>· ድምጽ</span></div>
            {status && <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary }}>{status[0]} {status[1]}</div>}
          </div>
          {user && <div style={{ display: "flex", gap: 6 }}>
            <button aria-label="My Fixes" onClick={() => go("fixes")} style={iconBtn(tab === "fixes")}><CheckCheck size={20} /></button>
            <button aria-label="Sign out" onClick={() => signOut(fbAuth())} style={iconBtn(false)}><LogOut size={20} /></button>
          </div>}
        </header>

        {user === undefined ? <div style={{ textAlign: "center", padding: 40 }}><Loader2 className="spin" color={COLORS.brand} /></div>
          : user === null ? <>
              <p style={{ ...note, textAlign: "center", fontSize: TYPE.md, margin: "0 0 14px" }}>Hear the world in Amharic. In every speaker's own voice.</p>
              <Auth />
            </>
          : <>
              {caps && !caps.online && !caps.text && <div style={{ ...card, marginBottom: 12, color: COLORS.warningText }}>The Dimts server is not connected yet. Ask the owner to start it.</div>}
              {tab === "dub" && <Dub caps={caps} toast={toast} />}
              {tab === "talk" && <Talk caps={caps} toast={toast} />}
              {tab === "voice" && <Voice caps={caps} toast={toast} />}
              {tab === "fixes" && <Fixes toast={toast} />}
            </>}
      </div>

      {user && <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: COLORS.surface, borderTop: `1px solid ${COLORS.surface3}`,
        paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => go(id)} style={{ padding: "10px 0 8px", border: 0, background: "none", cursor: "pointer",
              color: tab === id ? COLORS.brand : COLORS.textSecondary, fontSize: TYPE.xs, fontWeight: 700 }}>
              <Icon size={22} style={{ display: "block", margin: "0 auto 3px" }} />{label}</button>))}
        </div>
      </nav>}
      {toastNode}
    </div>
  );
}

const iconBtn = (on) => ({ width: 40, height: 40, borderRadius: RADIUS.pill, border: 0, cursor: "pointer",
  background: on ? COLORS.brand : COLORS.surface, color: on ? "#fff" : COLORS.textSecondary, display: "grid", placeItems: "center" });
