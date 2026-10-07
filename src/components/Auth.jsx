"use client";
import { useState } from "react";
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { fbAuth } from "@/lib/firebase-client";
import { COLORS, TYPE, RADIUS } from "@/lib/theme";
import { Button, card, field, note } from "./ui";

const friendly = (e) => ({
  "auth/invalid-credential": "Wrong email or password.", "auth/user-not-found": "No account with that email.",
  "auth/wrong-password": "Wrong email or password.", "auth/email-already-in-use": "That email already has an account. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters.", "auth/invalid-email": "That email does not look right.",
  "auth/popup-closed-by-user": "", "auth/too-many-requests": "Too many tries. Wait a minute.",
}[e.code] ?? "Could not sign in. Try again.");

export default function Auth() {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");

  const run = async (fn) => { setBusy(true); setMsg(""); try { await fn(); } catch (e) { setMsg(friendly(e)); } finally { setBusy(false); } };
  const google = () => run(() => signInWithPopup(fbAuth(), new GoogleAuthProvider()));
  const submit = () => run(() => (creating ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(fbAuth(), email.trim(), pw));
  const reset = () => run(async () => { await sendPasswordResetEmail(fbAuth(), email.trim()); setMsg("Check your email for a reset link."); });

  return (
    <div style={{ ...card, display: "grid", gap: 10 }}>
      <Button onClick={google} busy={busy}>Continue with Google</Button>
      <div style={{ textAlign: "center", ...note }}>or use email</div>
      <input style={field} type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input style={field} type="password" autoComplete={creating ? "new-password" : "current-password"} placeholder="Password" value={pw}
        onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && email && pw && submit()} />
      <Button tone="quiet" onClick={submit} busy={busy} disabled={!email || !pw}>{creating ? "Create account" : "Sign in"}</Button>
      {msg && <div style={{ ...note, color: COLORS.dangerText, textAlign: "center" }}>{msg}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.sm }}>
        <button onClick={() => setCreating(!creating)} style={{ border: 0, background: "none", color: COLORS.brand, fontWeight: 700, cursor: "pointer" }}>
          {creating ? "I have an account" : "New here? Create account"}</button>
        {!creating && <button onClick={reset} disabled={!email} style={{ border: 0, background: "none", color: COLORS.textSecondary, cursor: "pointer", borderRadius: RADIUS.sm }}>Forgot password</button>}
      </div>
    </div>
  );
}
