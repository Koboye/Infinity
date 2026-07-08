/**
 * Browser-API helpers and hooks extracted from Infinity.jsx.
 * No Firebase dependency — these only touch window/navigator/DOM APIs.
 */
import { useState, useEffect } from 'react';

export const haptic = (style = 'light') => {
  try {
    if (window.navigator?.vibrate) {
      style === 'heavy' ? navigator.vibrate([30, 10, 30]) : style === 'medium' ? navigator.vibrate(20) : navigator.vibrate(10);
    }
  } catch {}
};

export const isWebRTCSupported = () =>
  typeof window !== 'undefined' && typeof window.RTCPeerConnection === 'function';

let flwScriptPromise = null;
export const loadFlutterwaveScript = () => {
  if (window.FlutterwaveCheckout) return Promise.resolve();
  if (!flwScriptPromise) {
    flwScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.flutterwave.com/v3.js';
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }
  return flwScriptPromise;
};

export const useNetworkStatus = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
};

export const useIntersectionObserver = (ref, options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([entry]) => setIsIntersecting(entry.isIntersecting), options);
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return isIntersecting;
};
