"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Phone, Keyboard, X, User, Calendar, MapPin, Pencil, Eye, EyeOff } from "lucide-react";

/**
 * TalkMe — a hands-free English conversation partner.
 * No push-to-talk: once a session starts, it listens continuously,
 * automatically detects when you've finished a thought (silence),
 * replies like a friend on a call, flags real mistakes, and
 * re-opens the mic on its own. You just talk.
 */

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;
const supportsSTT = !!SpeechRecognitionAPI;
const supportsTTS = typeof window !== "undefined" && "speechSynthesis" in window;

const PRACTICE_SEED = "I would like a cup of coffee, please.";
const PROFILE_KEY = "talkme_profile_v1";
const BLANK_PROFILE = { name: "", birthDate: "", sex: "", country: "", city: "" };

function loadProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) { return null; }
}

function calcAge(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "burning the midnight oil";
  if (h < 12) return "good morning";
  if (h < 17) return "good afternoon";
  return "good evening";
}

function profileContextLine(p) {
  if (!p) return "";
  const age = calcAge(p.birthDate);
  const bits = [];
  if (age != null) bits.push(`age ${age}`);
  if (p.sex && p.sex !== "unspecified") bits.push(p.sex);
  const place = [p.city, p.country].filter(Boolean).join(", ");
  if (place) bits.push(`from ${place}`);
  const tail = bits.length ? ` (${bits.join(", ")})` : "";
  return `\n\nYou are talking with ${p.name || "this person"}${tail}. Use their name naturally now and then — don't recite these details back to them or make a big deal of knowing them.`;
}


// Two selectable difficulty levels — voice only, no avatar/photo. Juniour speaks
// simply and warmly for beginners; Major is more advanced and idiomatic for
// learners leveling up.
const PERSONAS = {
  juniour: {
    key: "juniour",
    name: "Juniour",
    level: "Beginner",
    accent: "#7fe7c4",
    tagline: "Simple words, short sentences, patient pace.",
    voiceHint: { pitch: 1.28, rate: 1.0 },
    style:
      "You are Juniour, a warm, patient, upbeat conversation partner for a beginner English learner. " +
      "Speak in short, simple sentences using everyday words. Keep grammar simple, avoid idioms and slang " +
      "unless you immediately explain them, and be extra encouraging about small wins.",
  },
  major: {
    key: "major",
    name: "Major",
    level: "Intermediate",
    accent: "#ffb86b",
    tagline: "Richer vocabulary, natural pace, gentle challenge.",
    voiceHint: { pitch: 0.92, rate: 0.98 },
    style:
      "You are Major, a confident, articulate conversation partner for a learner who wants to level up. " +
      "Use natural, slightly richer vocabulary and idiomatic phrasing while staying clear. Gently challenge " +
      "the learner with follow-up questions and don't shy away from more advanced words when they fit.",
  },
};
const DEFAULT_PERSONA_KEY = "major";
const PERSONA_STORAGE_KEY = "talkme_persona_v1";

function loadPersonaKey() {
  if (typeof window === "undefined") return DEFAULT_PERSONA_KEY;
  try {
    const raw = window.localStorage.getItem(PERSONA_STORAGE_KEY);
    return raw && PERSONAS[raw] ? raw : DEFAULT_PERSONA_KEY;
  } catch (err) { return DEFAULT_PERSONA_KEY; }
}

// A small idle "sound mark" — five bars at fixed, gently staggered heights.
// Used anywhere the old photo avatar used to sit (branding, level picker).
// It never claims to be a face; it's honestly just what it is: sound.
function SoundMark({ accent = "#ffb86b", size = 76 }) {
  const heights = [0.42, 0.72, 1, 0.58, 0.86];
  const barWidth = Math.max(3, Math.round(size * 0.07));
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", display: "flex",
        alignItems: "center", justifyContent: "center", gap: Math.max(3, size * 0.055),
        border: "1px solid rgba(238,240,245,0.14)", background: "#14172a",
      }}
      aria-hidden="true"
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="tm-eq-bar"
          style={{
            width: barWidth, height: `${h * size * 0.46}px`, borderRadius: barWidth,
            background: accent, animationDelay: `${i * 0.13}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function TalkMe() {
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState("free");
  const [personaKey, setPersonaKey] = useState(loadPersonaKey);
  const [phase, setPhase] = useState("idle"); // idle | listening | thinking | speaking
  const [caption, setCaption] = useState("");
  const [partial, setPartial] = useState("");
  const [turns, setTurns] = useState([]);
  const [muted, setMuted] = useState(false);
  const [micPaused, setMicPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [practicePhrase, setPracticePhrase] = useState(PRACTICE_SEED);
  const [typedFallback, setTypedFallback] = useState("");
  const [showTyped, setShowTyped] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(loadProfile);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(() => loadProfile() || BLANK_PROFILE);
  const [formError, setFormError] = useState("");

  const recognitionRef = useRef(null);
  const barRefs = useRef([]);
  const barLevelsRef = useRef([0, 0, 0, 0, 0]);
  const turnsCountRef = useRef(0);
  const correctionsCountRef = useRef(0);
  const sessionStartRef = useRef(0);
  const pendingControllerRef = useRef(null);
  const cachedVoicesRef = useRef({});
  const requestSeqRef = useRef(0);
  const historyRef = useRef([]); // [{role, content}]
  const startedRef = useRef(false);
  const micPausedRef = useRef(false);
  const mutedRef = useRef(false);
  const modeRef = useRef("free");
  const personaKeyRef = useRef(personaKey);
  const practicePhraseRef = useRef(PRACTICE_SEED);
  const feedEndRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { startedRef.current = started; }, [started]);
  useEffect(() => { micPausedRef.current = micPaused; }, [micPaused]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => {
    personaKeyRef.current = personaKey;
    try { window.localStorage.setItem(PERSONA_STORAGE_KEY, personaKey); } catch (err) {}
  }, [personaKey]);
  useEffect(() => { practicePhraseRef.current = practicePhrase; }, [practicePhrase]);
  useEffect(() => { feedEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  useEffect(() => {
    if (!supportsTTS) return;
    const cache = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const enVoices = voices.filter(v => /en-US|en-GB/.test(v.lang));
      const pool = enVoices.length ? enVoices : voices;
      // Prefer two distinct-sounding voices when available so Juniour and Major
      // don't sound identical; fall back gracefully to a single shared voice.
      const femaleLike = pool.find(v => /Google|Natural|Samantha|Female|Zira|Susan/i.test(v.name));
      const maleLike = pool.find(v => /Daniel|Male|David|Alex|Mark|Guy/i.test(v.name)) ||
        pool.find(v => v !== femaleLike);
      cachedVoicesRef.current = {
        juniour: femaleLike || pool[0],
        major: maleLike || pool[pool.length - 1] || pool[0],
      };
    };
    cache();
    window.speechSynthesis.onvoiceschanged = cache;
  }, []);

  // ---------------- voice equalizer (sound-only, no avatar) ----------------
  // Bars settle to a resting height when idle, and dance while TalkMe is
  // listening to you or speaking back — a clean, honest stand-in for "someone
  // is talking" that doesn't pretend to be a lip-synced video.
  useEffect(() => {
    let raf;
    const targets = [0, 0, 0, 0, 0];
    const tick = () => {
      const active = phase === "listening" || phase === "speaking";
      for (let i = 0; i < 5; i++) {
        if (active && Math.random() < 0.18) {
          targets[i] = 0.25 + Math.random() * 0.75;
        }
        targets[i] *= 0.94;
        barLevelsRef.current[i] += (targets[i] - barLevelsRef.current[i]) * 0.25;
        const el = barRefs.current[i];
        if (el) {
          const v = active ? Math.max(0.08, barLevelsRef.current[i]) : 0.08;
          el.style.transform = `scaleY(${v})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Pause the mic when the tab/app is backgrounded, resume when it's active again —
  // avoids the recognizer silently dying in a background tab and never coming back.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        stopListeningHard();
      } else if (startedRef.current && !micPausedRef.current && phase !== "speaking" && phase !== "thinking") {
        setTimeout(() => startListening(), 200);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [phase]);

  function buzz(pattern) {
    try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern); } catch (err) {}
  }

  // ---------------- speech recognition (fully automatic) ----------------
  const startListening = useCallback(() => {
    if (!supportsSTT || !startedRef.current || micPausedRef.current) return;
    if (recognitionRef.current) return; // already running

    const rec = new SpeechRecognitionAPI();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalChunk = "";

    rec.onstart = () => {
      setPhase("listening");
      setPartial("");
    };

    rec.onresult = (e) => {
      let interim = "";
      let finals = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finals += t;
        else interim += t;
      }
      if (interim) setPartial(interim);
      if (finals.trim()) {
        finalChunk = finals.trim();
        // A finished thought — stop listening immediately so we don't pick up
        // our own reply, and hand it off to Claude.
        try { rec.stop(); } catch (err) {}
      }
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setCaption("Mic access was blocked — allow microphone permission to keep talking.");
        setStarted(false);
      }
      // 'no-speech' / 'aborted' are routine on a continuous stream — ignore quietly.
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (finalChunk) {
        setPartial("");
        handleUserUtterance(finalChunk);
        finalChunk = "";
      } else if (startedRef.current && !micPausedRef.current) {
        // Silence timeout with nothing said — just keep the mic open.
        setTimeout(() => startListening(), 250);
      } else {
        setPhase("idle");
      }
    };

    try {
      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      recognitionRef.current = null;
      setTimeout(() => startListening(), 200);
    }
  }, []);

  const stopListeningHard = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
      try { rec.abort(); } catch (err) {}
      recognitionRef.current = null;
    }
  }, []);

  // ---------------- text to speech ----------------
  function speak(text) {
    if (mutedRef.current || !supportsTTS) {
      setTimeout(() => resumeAfterTurn(), 300);
      return;
    }
    window.speechSynthesis.cancel();
    const activePersona = PERSONAS[personaKeyRef.current] || PERSONAS[DEFAULT_PERSONA_KEY];
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = activePersona.voiceHint?.rate ?? 0.98;
    utter.pitch = activePersona.voiceHint?.pitch ?? 1.0;
    const voice = cachedVoicesRef.current[activePersona.key];
    if (voice) utter.voice = voice;
    utter.onstart = () => { setPhase("speaking"); buzz(12); };
    utter.onend = () => resumeAfterTurn();
    utter.onerror = () => resumeAfterTurn();
    window.speechSynthesis.speak(utter);
  }

  function resumeAfterTurn() {
    if (!startedRef.current || micPausedRef.current) {
      setPhase("idle");
      return;
    }
    setTimeout(() => startListening(), 350);
  }

  // ---------------- conversation turn ----------------
  async function handleUserUtterance(text) {
    if (!text || !text.trim()) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setCaption("Looks like you're offline — reconnect and I'll keep listening.");
      resumeAfterTurn();
      return;
    }

    if (pendingControllerRef.current) pendingControllerRef.current.abort();
    const myRequestId = ++requestSeqRef.current;

    setCaption(text);
    setPhase("thinking");

    const isPractice = modeRef.current === "practice";
    const targetPhrase = practicePhraseRef.current;

    try {
      const result = await callClaude(text, isPractice, targetPhrase);
      if (myRequestId !== requestSeqRef.current) return; // superseded, stay quiet

      turnsCountRef.current += 1;
      correctionsCountRef.current += (result.corrections || []).length;
      setTurns(prev => [
        ...prev,
        { who: "user", text, corrections: result.corrections || [] },
        { who: "assistant", text: result.reply || "" },
      ]);

      if (isPractice && result.nextPhrase) {
        setPracticePhrase(result.nextPhrase);
      }

      speak(result.reply || "Could you say that again?");
    } catch (err) {
      if (myRequestId !== requestSeqRef.current) return;
      const timedOut = err && err.name === "AbortError";
      setTurns(prev => [...prev, { who: "user", text, corrections: [] }]);
      const fallback = timedOut
        ? "That took too long to come back — let's try again."
        : "Sorry, I had trouble thinking just now — mind saying that again?";
      setTurns(prev => [...prev, { who: "assistant", text: fallback }]);
      speak(fallback);
    }
  }

  async function callClaude(userText, isPractice, targetPhrase) {
    const activePersona = PERSONAS[personaKeyRef.current] || PERSONAS[DEFAULT_PERSONA_KEY];
    const sys = isPractice
      ? `You are ${activePersona.name}, TalkMe's English pronunciation and grammar coach. ${activePersona.style}
The user is reading a suggested phrase out loud, transcribed by the browser's speech recognizer. The target phrase was: "${targetPhrase}".
Compare what they said to the target. Where words differ, that likely reflects a pronunciation issue (recognizer misheard them) or a genuine mistake. Point these out kindly and specifically.
Then suggest ONE new short phrase (6-12 words, natural spoken English, varied sounds) to practice next.
Respond with ONLY raw JSON, no markdown fences, no extra text:
{"reply": "one short encouraging spoken-style response, 1-3 sentences", "corrections": [{"original":"word/phrase they said","corrected":"correct version","explanation":"short friendly reason, under 15 words"}], "nextPhrase": "the next practice phrase"}
If they matched well, corrections can be empty and reply should be genuine praise.`
      : `You are ${activePersona.name}, TalkMe's conversation partner helping someone practice spoken English, hands-free like a phone call. ${activePersona.style}
You receive their speech transcribed by the browser's recognizer (occasional recognition errors are possible — don't over-flag words that are likely just mis-transcriptions).
Reply like a supportive friend on a call: natural, curious, ask a follow-up sometimes, 1-4 sentences so it's easy to speak aloud.
Separately identify genuine grammar or word-choice mistakes (not transcription noise) and give brief, kind corrections.
Respond with ONLY raw JSON, no markdown fences, no extra text:
{"reply": "your spoken-style conversational response", "corrections": [{"original":"what they said","corrected":"corrected version","explanation":"short friendly reason, under 15 words"}]}
If there were no real mistakes, corrections should be an empty array.`;

    const sysWithProfile = sys + profileContextLine(profile);
    const trimmedHistory = historyRef.current.slice(-12);
    const msgs = trimmedHistory.concat([{ role: "user", content: userText }]);

    const payload = JSON.stringify({
      system: sysWithProfile,
      messages: msgs,
    });

    const parsed = await requestWithTimeout(payload);

    historyRef.current = trimmedHistory.concat([
      { role: "user", content: userText },
      { role: "assistant", content: parsed.reply || "" },
    ]).slice(-12);

    return parsed;
  }

  async function requestWithTimeout(payload, isRetry) {
    const controller = new AbortController();
    pendingControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch("/api/ai/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok && (response.status === 429 || response.status >= 500) && !isRetry) {
        return requestWithTimeout(payload, true);
      }

      const data = await response.json();
      if (data && typeof data.reply === "string") return data;
      return { reply: "Could you say that again?", corrections: [] };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    } finally {
      if (pendingControllerRef.current === controller) pendingControllerRef.current = null;
    }
  }

  // ---------------- session lifecycle ----------------
  function startSession() {
    setStarted(true);
    setSummary(null);
    setShowTyped(false);
    setTurns([]);
    historyRef.current = [];
    turnsCountRef.current = 0;
    correctionsCountRef.current = 0;
    sessionStartRef.current = Date.now();
    setSeconds(0);
    setMicPaused(false);
    if (mode === "practice") setPracticePhrase(PRACTICE_SEED);

    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);

    const first = profile?.name ? profile.name.split(" ")[0] : "";
    const line = mode === "practice"
      ? `Hey${first ? " " + first : ""}! I'm ${persona.name}. Just start reading the phrase below out loud whenever you're ready — I'm already listening.`
      : `Hey${first ? " " + first : ""}, good to hear from you. What's on your mind today?`;
    setTurns([{ who: "assistant", text: line }]);
    speak(line);
  }

  function endSession() {
    setStarted(false);
    stopListeningHard();
    if (pendingControllerRef.current) pendingControllerRef.current.abort();
    if (supportsTTS) window.speechSynthesis.cancel();
    clearInterval(timerRef.current);
    setPhase("idle");
    setCaption("");
    setPartial("");
    setShowTyped(false);
    if (turnsCountRef.current > 0) {
      setSummary({
        turns: turnsCountRef.current,
        corrections: correctionsCountRef.current,
        durationSec: Math.round((Date.now() - sessionStartRef.current) / 1000),
      });
    }
  }

  function toggleMicPause() {
    setMicPaused(prev => {
      const next = !prev;
      if (next) {
        stopListeningHard();
        setPhase("idle");
      } else if (phase !== "speaking" && phase !== "thinking") {
        setTimeout(() => startListening(), 150);
      }
      return next;
    });
  }

  function openEditProfile() {
    setDraft(profile || BLANK_PROFILE);
    setFormError("");
    setFormOpen(true);
  }

  function submitProfile(e) {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setFormError("Your name helps TalkMe greet you properly.");
      return;
    }
    const next = { ...draft, name };
    setProfile(next);
    try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); } catch (err) {}
    setFormError("");
    setFormOpen(false);
  }

  function submitTyped(e) {
    e.preventDefault();
    const text = typedFallback.trim();
    if (!text) return;
    setTypedFallback("");
    handleUserUtterance(text);
  }

  useEffect(() => () => {
    stopListeningHard();
    clearInterval(timerRef.current);
    if (supportsTTS) window.speechSynthesis.cancel();
  }, [stopListeningHard]);

  const persona = PERSONAS[personaKey] || PERSONAS[DEFAULT_PERSONA_KEY];

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const phaseLabel = {
    idle: micPaused ? "mic paused" : "getting ready...",
    listening: "listening...",
    thinking: "thinking...",
    speaking: "talking...",
  }[phase];

  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .tm-scroll::-webkit-scrollbar{ width:6px; }
        .tm-scroll::-webkit-scrollbar-thumb{ background:#232849; border-radius:3px; }
        @keyframes tm-ring{ 0%{ opacity:.55; transform:scale(0.82);} 100%{ opacity:0; transform:scale(1.35);} }
        @keyframes tm-rise{ from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:translateY(0);} }
        @keyframes tm-breathe{ 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.025); } }
        @keyframes tm-eq-bounce{ 0%,100%{ transform:scaleY(0.55); } 50%{ transform:scaleY(1); } }
        .tm-ring-anim{ animation: tm-ring 1.8s ease-out infinite; }
        .tm-turn-anim{ animation: tm-rise .25s ease; }
        .tm-breathe{ animation: tm-breathe 3.6s ease-in-out infinite; }
        .tm-eq-bar{ transform-origin: center; animation: tm-eq-bounce 1.15s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce){
          .tm-ring-anim, .tm-turn-anim, .tm-breathe, .tm-eq-bar{ animation: none !important; }
        }
      `}</style>

      <div style={S.app}>
        {/* header */}
        <div style={S.callbar}>
          <div style={S.brandRow}>
            <span style={S.brandMark}>TalkMe</span>
            <span style={{ ...S.statusDot, ...(started ? S.statusDotLive : {}) }} />
          </div>
          <div style={S.timer}>{mm}:{ss}</div>
          {started ? (
            <button onClick={endSession} style={S.iconBtn} title="End session" aria-label="End session">
              <PhoneOff size={15} />
            </button>
          ) : <div style={{ width: 36 }} />}
        </div>

        {formOpen ? (
          // ---------------- onboarding / edit profile ----------------
          <form onSubmit={submitProfile} style={S.landing}>
            <div style={S.landingAvatarWrap}>
              <div className="tm-breathe">
                <SoundMark accent={persona.accent} size={76} />
              </div>
            </div>

            <h1 style={S.h1}>
              {profile ? "Update your" : "Let's get"}<br />
              <span style={{ color: "#ffb86b" }}>{profile ? "details" : "acquainted"}</span>.
            </h1>
            <p style={S.sub}>
              {profile
                ? "Update anything below — it's just used to greet you and keep the conversation natural."
                : "Just a few details so your practice partner knows who it's talking with. Only your name is required."}
            </p>

            <div style={S.formCard}>
              <label style={S.fieldLabel}>
                <User size={13} style={S.fieldIcon} /> Name
                <input
                  style={S.fieldInput}
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="Your name"
                  autoFocus
                />
              </label>

              <label style={S.fieldLabel}>
                <Calendar size={13} style={S.fieldIcon} /> Date of birth
                <input
                  type="date"
                  style={S.fieldInput}
                  value={draft.birthDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={e => setDraft(d => ({ ...d, birthDate: e.target.value }))}
                />
              </label>

              <label style={S.fieldLabel}>
                Sex
                <select
                  style={S.fieldInput}
                  value={draft.sex}
                  onChange={e => setDraft(d => ({ ...d, sex: e.target.value }))}
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>

              <div style={S.formRow}>
                <label style={{ ...S.fieldLabel, flex: 1 }}>
                  <MapPin size={13} style={S.fieldIcon} /> Country
                  <input
                    style={S.fieldInput}
                    value={draft.country}
                    onChange={e => setDraft(d => ({ ...d, country: e.target.value }))}
                    placeholder="Ethiopia"
                  />
                </label>
                <label style={{ ...S.fieldLabel, flex: 1 }}>
                  City
                  <input
                    style={S.fieldInput}
                    value={draft.city}
                    onChange={e => setDraft(d => ({ ...d, city: e.target.value }))}
                    placeholder="Addis Ababa"
                  />
                </label>
              </div>

              {formError && <div style={S.formErrorText}>{formError}</div>}
            </div>

            <button type="submit" style={S.startBtn}>
              {profile ? "Save changes" : "Continue"}
            </button>
            {profile && (
              <button type="button" onClick={() => { setFormOpen(false); setFormError(""); }} style={S.cancelLink}>
                Cancel
              </button>
            )}
          </form>
        ) : !started ? (
          // ---------------- landing ----------------
          <div style={S.landing}>
            <div style={S.landingAvatarWrap}>
              <div className="tm-breathe">
                <SoundMark accent={persona.accent} size={76} />
              </div>
            </div>

            {profile?.name && (
              <div style={S.greetBanner}>
                <div>
                  <div style={S.greetHello}>Hello, {profile.name.split(" ")[0]}! Welcome back.</div>
                  <div style={S.greetSub}>{timeGreeting()[0].toUpperCase() + timeGreeting().slice(1)} — ready when you are.</div>
                </div>
                <button type="button" onClick={openEditProfile} style={S.editBtn} title="Edit your details" aria-label="Edit your details">
                  <Pencil size={13} />
                </button>
              </div>
            )}

            <h1 style={S.h1}>
              Practice English<br />out loud, with <span style={{ color: "#ffb86b" }}>{persona.name}</span>.
            </h1>
            <p style={S.sub}>
              No buttons to hold. Start the session and just talk — TalkMe knows when you've finished a thought,
              answers like a friend on a call, and quietly points out the grammar to fix.
            </p>

            {summary && (
              <div style={S.summaryCard}>
                <div style={S.summaryTitle}>Nice session 👋</div>
                <div style={S.summaryRow}>
                  <div style={S.summaryStat}><b style={S.summaryNum}>{summary.turns}</b><span>exchanges</span></div>
                  <div style={S.summaryStat}><b style={S.summaryNum}>{summary.corrections}</b><span>corrections</span></div>
                  <div style={S.summaryStat}><b style={S.summaryNum}>{String(Math.floor(summary.durationSec / 60)).padStart(2, "0")}:{String(summary.durationSec % 60).padStart(2, "0")}</b><span>duration</span></div>
                </div>
              </div>
            )}

            <div style={S.personaLabel}>Choose your level</div>
            <div style={S.personaRow}>
              {Object.values(PERSONAS).map(p => (
                <button
                  key={p.key}
                  onClick={() => setPersonaKey(p.key)}
                  style={{ ...S.personaCard, ...(personaKey === p.key ? S.personaCardSelected : {}) }}
                  aria-pressed={personaKey === p.key}
                  title={`Talk with ${p.name} — ${p.level}`}
                >
                  <SoundMark accent={p.accent} size={48} />
                  <div style={S.personaName}>
                    {p.name}
                    <span style={{ ...S.levelBadge, color: p.accent, borderColor: p.accent }}>{p.level}</span>
                  </div>
                  <div style={S.personaTagline}>{p.tagline}</div>
                </button>
              ))}
            </div>

            <div style={S.modeRow}>
              <button
                onClick={() => setMode("free")}
                style={{ ...S.modeCard, ...(mode === "free" ? S.modeCardSelected : {}) }}
              >
                <span style={{ ...S.eyebrow, ...(mode === "free" ? { color: "#ffb86b" } : {}) }}>Mode 01</span>
                <div style={S.modeTitle}>Free chat</div>
                <div style={S.modeDesc}>Talk about anything. Corrections show up after each turn.</div>
              </button>
              <button
                onClick={() => setMode("practice")}
                style={{ ...S.modeCard, ...(mode === "practice" ? S.modeCardSelected : {}) }}
              >
                <span style={{ ...S.eyebrow, ...(mode === "practice" ? { color: "#ffb86b" } : {}) }}>Mode 02</span>
                <div style={S.modeTitle}>Phrase drill</div>
                <div style={S.modeDesc}>Read a suggested line aloud, checked word by word.</div>
              </button>
            </div>

            <button onClick={startSession} style={S.startBtn}>
              <Mic size={18} /> Start talking
            </button>
            <div style={{ ...S.compatNote, ...(supportsSTT ? {} : { color: "#ff7a7a" }) }}>
              {supportsSTT
                ? "Works best in Chrome or Edge, desktop or Android. Your browser's own mic and voice — no account, no limit."
                : "This browser doesn't support voice recognition — you can still type instead. Try Chrome or Edge for hands-free voice."}
            </div>
          </div>
        ) : (
          // ---------------- call screen ----------------
          <div style={S.callScreenActive}>
            <div style={S.orbZone}>
              <div style={S.orbWrapOuter}>
                {(phase === "listening" || phase === "speaking") && (
                  <>
                    <div className="tm-ring-anim" style={{ ...S.orbRing, borderColor: phase === "listening" ? "#ffb86b" : "#7fe7c4" }} />
                    <div className="tm-ring-anim" style={{ ...S.orbRing, borderColor: phase === "listening" ? "#ffb86b" : "#7fe7c4", animationDelay: ".6s" }} />
                  </>
                )}
                <div
                  className="tm-breathe"
                  style={{
                    ...S.avatarRing,
                    borderColor: phase === "listening" ? "#ffb86b" : phase === "speaking" ? "#7fe7c4" : "rgba(238,240,245,0.14)",
                    boxShadow:
                      phase === "listening" ? "0 0 0 1px rgba(255,184,107,0.22), 0 0 38px -4px rgba(255,184,107,0.28)" :
                      phase === "speaking" ? "0 0 0 1px rgba(127,231,196,0.22), 0 0 38px -4px rgba(127,231,196,0.28)" : "none",
                  }}
                >
                  <div style={S.barsRow} aria-hidden="true">
                    {[0, 1, 2, 3, 4].map(i => (
                      <span
                        key={i}
                        ref={el => (barRefs.current[i] = el)}
                        style={{
                          ...S.bar,
                          background: phase === "listening" ? "#ffb86b" : phase === "speaking" ? "#7fe7c4" : "rgba(238,240,245,0.3)",
                        }}
                      />
                    ))}
                  </div>
                  {phase === "thinking" && (
                    <div style={S.thinkingOverlay}>
                      <span style={S.dot} /><span style={{ ...S.dot, animationDelay: ".15s" }} /><span style={{ ...S.dot, animationDelay: ".3s" }} />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ ...S.stateLabel, color: phase === "listening" ? "#ffb86b" : "rgba(238,240,245,0.38)" }} aria-live="polite">
                {phaseLabel}
              </div>

              {showTranscript ? (
                <div style={{ ...S.caption, ...(caption || partial ? {} : S.captionEmpty) }} aria-live="polite">
                  {partial ? <span style={S.livePartial}>{partial}</span> : (caption || "TalkMe is listening for your voice...")}
                </div>
              ) : (
                <button type="button" onClick={() => setShowTranscript(true)} style={S.textHiddenNote}>
                  <EyeOff size={13} /> Text hidden — tap to show
                </button>
              )}

              {mode === "practice" && (
                <div style={S.practiceTarget}>
                  Say this out loud: <b style={{ color: "#eef0f5" }}>{practicePhrase}</b>
                </div>
              )}
            </div>

            {showTranscript && (
              <div className="tm-scroll" style={S.feed}>
                {turns.map((t, i) => (
                  <div key={i} className="tm-turn-anim" style={S.turn}>
                    {t.who === "user" ? (
                      <>
                        <div style={S.youSaid}>
                          <span style={S.lbl}>You said</span>
                          {t.text}
                        </div>
                        {t.corrections && t.corrections.length ? (
                          <div style={S.correctionsWrap}>
                            {t.corrections.map((c, j) => (
                              <div key={j} style={S.correctionChip}>
                                <div style={S.row1}>
                                  <span style={S.wrong}>{c.original || ""}</span>
                                  <span style={S.arrow}>→</span>
                                  <span style={S.right}>{c.corrected || ""}</span>
                                </div>
                                <div style={S.why}>{c.explanation || ""}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={S.correctionsWrap}>
                            <div style={S.cleanChip}>✓ Nice — no corrections here</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={S.friendSaid}>{t.text}</div>
                    )}
                  </div>
                ))}
                <div ref={feedEndRef} />
              </div>
            )}

            <div style={S.controls}>
              <button
                onClick={toggleMicPause}
                style={{ ...S.sideBtn, ...(micPaused ? {} : S.sideBtnOn) }}
                title={micPaused ? "Resume listening" : "Pause mic"}
                aria-label={micPaused ? "Resume listening" : "Pause mic"}
              >
                {micPaused ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <div style={S.centerStatus}>
                {phase === "thinking" ? (
                  <div style={S.thinkingDots}>
                    <span style={S.dot} /><span style={{ ...S.dot, animationDelay: ".15s" }} /><span style={{ ...S.dot, animationDelay: ".3s" }} />
                  </div>
                ) : (
                  <Phone size={22} color={phase === "listening" ? "#ffb86b" : phase === "speaking" ? "#7fe7c4" : "rgba(238,240,245,0.38)"} />
                )}
              </div>

              <button
                onClick={() => setMuted(m => !m)}
                style={{ ...S.sideBtn, ...(muted ? {} : S.sideBtnOn) }}
                title={muted ? "Unmute voice replies" : "Mute voice replies"}
                aria-label={muted ? "Unmute voice replies" : "Mute voice replies"}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              <button
                onClick={() => setShowTranscript(v => !v)}
                style={{ ...S.sideBtn, ...(showTranscript ? S.sideBtnOn : {}) }}
                title={showTranscript ? "Hide text" : "Show text"}
                aria-label={showTranscript ? "Hide text" : "Show text"}
              >
                {showTranscript ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>

              {supportsSTT && (
                <button
                  onClick={() => setShowTyped(v => !v)}
                  style={{ ...S.sideBtn, ...(showTyped ? S.sideBtnOn : {}) }}
                  title={showTyped ? "Hide typing" : "Type instead of talking"}
                  aria-label={showTyped ? "Hide typing" : "Type instead of talking"}
                >
                  {showTyped ? <X size={18} /> : <Keyboard size={18} />}
                </button>
              )}
            </div>

            {(!supportsSTT || showTyped) && (
              <form onSubmit={submitTyped} style={S.typedForm}>
                <input
                  autoFocus={showTyped}
                  value={typedFallback}
                  onChange={e => setTypedFallback(e.target.value)}
                  placeholder="Type what you'd like to say..."
                  style={S.typedInput}
                />
                <button type="submit" style={S.typedSend}>Send</button>
              </form>
            )}

            <div style={S.hint} aria-live="polite">
              {micPaused ? "Mic is paused — tap the mic icon to keep talking." : "Just talk — TalkMe will jump in when you pause."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    height: "100%",
    minHeight: 0,
    display: "flex",
    justifyContent: "center",
    background: "radial-gradient(120% 140% at 50% -10%, #1f2440 0%, #0e1120 55%)",
    color: "#eef0f5",
    fontFamily: "'Inter', system-ui, sans-serif",
    overflowY: "auto",
    paddingBottom: "max(74px, calc(58px + env(safe-area-inset-bottom)))",
  },
  app: {
    width: "100%",
    maxWidth: 460,
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "18px 18px 18px",
  },
  callbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 4px 18px" },
  brandRow: { display: "flex", alignItems: "baseline", gap: 8 },
  brandMark: { fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" },
  statusDot: { width: 7, height: 7, borderRadius: "50%", background: "rgba(238,240,245,0.38)", display: "inline-block" },
  statusDotLive: { background: "#7fe7c4", boxShadow: "0 0 0 4px rgba(127,231,196,0.15)" },
  timer: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "rgba(238,240,245,0.62)", letterSpacing: "0.03em" },
  iconBtn: {
    width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(238,240,245,0.10)",
    background: "#161a2e", color: "rgba(238,240,245,0.62)", display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer",
  },
  landing: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 26, padding: "10px 6px 30px" },
  h1: { fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 34, lineHeight: 1.08, letterSpacing: "-0.02em", margin: 0 },
  sub: { color: "rgba(238,240,245,0.62)", fontSize: 15, lineHeight: 1.55, margin: 0, maxWidth: "34ch" },
  personaLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(238,240,245,0.38)" },
  personaRow: { display: "flex", gap: 10 },
  personaCard: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    borderWidth: 1, borderStyle: "solid", borderColor: "rgba(238,240,245,0.10)", background: "#161a2e", borderRadius: 16,
    padding: "14px 10px", cursor: "pointer", color: "#eef0f5", fontFamily: "inherit",
  },
  personaCardSelected: { borderColor: "#ffb86b", background: "linear-gradient(180deg, rgba(255,184,107,0.18), transparent 70%), #161a2e" },
  personaName: { fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 },
  levelBadge: {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: ".04em", textTransform: "uppercase",
    border: "1px solid", borderRadius: 999, padding: "2px 6px",
  },
  personaTagline: { fontSize: 11.5, color: "rgba(238,240,245,0.62)", textAlign: "center", lineHeight: 1.35 },
  modeRow: { display: "flex", gap: 10 },
  modeCard: {
    flex: 1, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(238,240,245,0.10)", background: "#161a2e", borderRadius: 16,
    padding: "14px 14px", cursor: "pointer", textAlign: "left", color: "#eef0f5", fontFamily: "inherit",
  },
  modeCardSelected: { borderColor: "#ffb86b", background: "linear-gradient(180deg, rgba(255,184,107,0.18), transparent 70%), #161a2e" },
  eyebrow: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(238,240,245,0.38)", display: "block", marginBottom: 6 },
  modeTitle: { fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 4 },
  modeDesc: { fontSize: 12.5, color: "rgba(238,240,245,0.62)", lineHeight: 1.4 },
  startBtn: {
    marginTop: 6, width: "100%", padding: 17, borderRadius: 999, border: "none", background: "#ffb86b",
    color: "#221604", fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  },
  compatNote: { fontSize: 12, color: "rgba(238,240,245,0.38)", textAlign: "center", lineHeight: 1.5 },
  formCard: { display: "flex", flexDirection: "column", gap: 14, borderRadius: 16, background: "#161a2e", border: "1px solid rgba(238,240,245,0.10)", padding: "16px" },
  fieldLabel: { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "rgba(238,240,245,0.62)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: ".03em" },
  fieldIcon: { verticalAlign: "-2px", marginRight: 2 },
  fieldInput: {
    padding: "11px 12px", borderRadius: 10, border: "1px solid rgba(238,240,245,0.10)", background: "#0e1120",
    color: "#eef0f5", fontSize: 14, fontFamily: "'Inter', sans-serif", outline: "none",
  },
  formRow: { display: "flex", gap: 12 },
  formErrorText: { fontSize: 12.5, color: "#ff7a7a" },
  cancelLink: { background: "none", border: "none", color: "rgba(238,240,245,0.38)", fontSize: 13, cursor: "pointer", padding: "4px 0", textAlign: "center" },
  greetBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    borderRadius: 14, background: "#161a2e", border: "1px solid rgba(255,184,107,0.18)", padding: "12px 14px",
  },
  greetHello: { fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14.5 },
  greetSub: { fontSize: 12, color: "rgba(238,240,245,0.62)", marginTop: 2 },
  editBtn: {
    width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(238,240,245,0.10)", background: "#0e1120",
    color: "rgba(238,240,245,0.62)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
  },
  callScreenActive: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
  orbZone: { paddingTop: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 },
  orbWrapOuter: { position: "relative", width: 172, height: 172, display: "flex", alignItems: "center", justifyContent: "center" },
  orbRing: { position: "absolute", inset: 0, borderRadius: "50%", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(238,240,245,0.10)" },
  avatarRing: {
    position: "relative", width: 128, height: 128, borderRadius: "50%", overflow: "hidden",
    borderWidth: 1, borderStyle: "solid", borderColor: "rgba(238,240,245,0.10)", background: "#14172a",
    transition: "box-shadow .3s ease, border-color .3s ease",
  },
  barsRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", height: "100%" },
  bar: { width: 7, height: 44, borderRadius: 7, transformOrigin: "center", transition: "background .25s ease" },
  thinkingOverlay: {
    position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(14,17,32,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
  },
  landingAvatarWrap: { display: "flex", justifyContent: "center", marginBottom: -6 },
  summaryCard: {
    borderRadius: 16, background: "#161a2e", border: "1px solid rgba(238,240,245,0.10)", padding: "14px 16px",
  },
  summaryTitle: { fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 10 },
  summaryRow: { display: "flex", justifyContent: "space-between" },
  summaryStat: { display: "flex", flexDirection: "column", gap: 2, fontSize: 11, color: "rgba(238,240,245,0.62)" },
  summaryNum: { fontFamily: "'Sora', sans-serif", fontSize: 18, color: "#eef0f5" },
  stateLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", minHeight: 16 },
  caption: { marginTop: 4, minHeight: 54, width: "100%", textAlign: "center", fontSize: 16.5, lineHeight: 1.5, color: "#eef0f5", padding: "0 8px" },
  captionEmpty: { color: "rgba(238,240,245,0.38)" },
  livePartial: { color: "rgba(238,240,245,0.62)", fontStyle: "italic" },
  textHiddenNote: {
    marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    minHeight: 54, width: "100%", background: "none", border: "none", cursor: "pointer",
    fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, letterSpacing: ".03em",
    color: "rgba(238,240,245,0.38)", padding: "0 8px",
  },
  practiceTarget: { padding: "10px 16px", borderRadius: 14, background: "#161a2e", border: "1px solid rgba(238,240,245,0.10)", fontSize: 13.5, color: "rgba(238,240,245,0.62)", textAlign: "center" },
  feed: { flex: 1, width: "100%", marginTop: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 10, maxHeight: "38vh" },
  turn: { border: "1px solid rgba(238,240,245,0.10)", background: "#161a2e", borderRadius: 16, padding: "13px 14px" },
  youSaid: { fontSize: 14, color: "rgba(238,240,245,0.62)", marginBottom: 8, lineHeight: 1.45 },
  lbl: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: ".06em", color: "rgba(238,240,245,0.38)", textTransform: "uppercase", display: "block", marginBottom: 4 },
  friendSaid: { fontSize: 14.5, color: "#eef0f5", lineHeight: 1.5 },
  correctionsWrap: { marginTop: 10, display: "flex", flexDirection: "column", gap: 7 },
  correctionChip: { borderRadius: 12, background: "rgba(255,122,122,0.15)", border: "1px solid rgba(255,122,122,0.28)", padding: "9px 11px", fontSize: 13, lineHeight: 1.45 },
  row1: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline" },
  wrong: { color: "#ff7a7a", textDecoration: "line-through" },
  arrow: { color: "rgba(238,240,245,0.38)" },
  right: { color: "#7fe7c4", fontWeight: 600 },
  why: { color: "rgba(238,240,245,0.62)", marginTop: 3, fontSize: 12.5 },
  cleanChip: { borderRadius: 12, background: "rgba(127,231,196,0.15)", border: "1px solid rgba(127,231,196,0.28)", padding: "8px 11px", fontSize: 12.5, color: "#7fe7c4" },
  controls: { paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 26 },
  centerStatus: { width: 60, height: 60, borderRadius: "50%", border: "1px solid rgba(238,240,245,0.10)", background: "#161a2e", display: "flex", alignItems: "center", justifyContent: "center" },
  thinkingDots: { display: "flex", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: "50%", background: "#ffb86b", animation: "tm-rise .6s ease-in-out infinite alternate" },
  sideBtn: { width: 50, height: 50, borderRadius: "50%", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(238,240,245,0.10)", background: "#161a2e", color: "rgba(238,240,245,0.62)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  sideBtnOn: { borderColor: "#7fe7c4", color: "#7fe7c4" },
  typedForm: { display: "flex", gap: 8, width: "100%", marginTop: 14 },
  typedInput: { flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(238,240,245,0.10)", background: "#161a2e", color: "#eef0f5", fontSize: 14, outline: "none" },
  typedSend: { padding: "12px 18px", borderRadius: 12, border: "none", background: "#ffb86b", color: "#221604", fontWeight: 700, cursor: "pointer" },
  hint: { textAlign: "center", fontSize: 11.5, color: "rgba(238,240,245,0.38)", paddingTop: 10 },
};
