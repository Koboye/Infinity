'use client';
import React from 'react';

/** Catches render crashes: shows a friendly reload screen and keeps a small anonymous error log (no user data). */
export function logError(err, where = 'ui') {
  try {
    const entry = { at: Date.now(), where, msg: String(err?.message || err).slice(0, 200), v: process.env.NEXT_PUBLIC_APP_VERSION };
    const list = JSON.parse(localStorage.getItem('gebeta.errors') || '[]'); list.unshift(entry);
    localStorage.setItem('gebeta.errors', JSON.stringify(list.slice(0, 10)));
    const url = process.env.NEXT_PUBLIC_ERROR_ENDPOINT;
    if (url && navigator.sendBeacon) navigator.sendBeacon(url, JSON.stringify(entry));
  } catch { /* logging must never throw */ }
}
export default class ErrorGuard extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { logError(e, 'render'); }
  componentDidMount() {
    this.h = (ev) => logError(ev.error || ev.reason || ev.message, 'global');
    window.addEventListener('error', this.h); window.addEventListener('unhandledrejection', this.h);
  }
  componentWillUnmount() { window.removeEventListener('error', this.h); window.removeEventListener('unhandledrejection', this.h); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#F4E9CF' }}>
        <h2>ገበጣ</h2>
        <p>Something went wrong · የሆነ ችግር ተፈጠረ</p>
        <button className="btn primary" onClick={() => location.reload()}>↻</button>
      </div>
    );
  }
}
