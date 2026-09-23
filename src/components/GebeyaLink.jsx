'use client';
/**
 * Altimate — main application component.
 * One app for shops, traders, and drivers in Ethiopian towns: sell, track
 * stock, keep the credit book, and (soon) see market prices and book
 * deliveries. Works fully offline, in Amharic first / English second.
 *
 * Build order (v1, this file): setup, sell, buy, stock, stock count,
 * credit book, payments, alerts, reports, expenses, settings. Delivery,
 * market prices, staff roles and Afaan Oromo are version 2 — shown here
 * as "Soon" so the navigation map already matches the final app.
 *
 * Design rule carried through every screen: if a task takes more than 3
 * taps, or a screen needs more than 6 buttons, it gets split or moved
 * into More. Colour never carries meaning alone — every warning also has
 * a word or a number next to it.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Minus, ChevronRight, X, Check,
  ShoppingBag, Package, BookOpen, MoreHorizontal, Phone as PhoneIcon,
  MessageCircle, Send, Download, Upload, Trash2, Flame, CheckSquare, Square,
  AlertTriangle, TrendingUp, Wallet, Users, Truck, Tag as TagIcon,
  Settings as SettingsIcon, HelpCircle, ArrowLeft, Share2, Lock,
  Home as HomeIcon, PieChart, Bell, ArrowUpRight, ArrowDownRight,
  UserCircle2, RefreshCw, MessageSquareHeart, Info, ShieldCheck, ReceiptText,
} from 'lucide-react';
import {
  backdropVariants, sheetVariants, pageVariants, fadeVariants,
  toastVariants, springs, durations,
} from '@/lib/motion';
import {
  COLORS, TYPE, RADIUS, SHADOW, Z, applyTheme, getStoredTheme, subscribeTheme,
} from '@/lib/theme';
import { useStore } from '@/lib/store';
import { makeT } from '@/lib/i18n';
import {
  formatNumber, formatDate, accountInfo, itemStatus, isExpiringSoon,
  periodTotals, bestSellers, saleProfit, calcStreak, DAY as DAY_MS,
} from '@/lib/utils/format';
import { haptic, useNetworkStatus, hashPin, shareText, shareTelegram, downloadFile, normalizePhone } from '@/lib/utils/browser';
import { useBackgroundSync, connectAndPush, pushNow, restoreFromCode } from '@/lib/sync';

/* ═══════════════════════════ SMALL SHARED PIECES ═══════════════════════════ */

let _toastFn = null;
const toast = (msg, kind = 'ok') => _toastFn && _toastFn(msg, kind);

let _confirmFn = null;
function askConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    if (_confirmFn) _confirmFn({ message, resolve, ...opts });
    else resolve(window.confirm(message));
  });
}

function ConfirmHost() {
  const [req, setReq] = useState(null);
  useEffect(() => { _confirmFn = (r) => setReq(r); return () => { _confirmFn = null; }; }, []);
  const finish = (v) => { req.resolve(v); setReq(null); };
  return (
    <AnimatePresence>
      {req && (
        <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="hidden"
          onClick={() => finish(false)}
          style={{ position: 'fixed', inset: 0, zIndex: Z.confirmDialog, background: COLORS.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            transition={durations.fast} onClick={(e) => e.stopPropagation()}
            style={{ background: COLORS.surface, borderRadius: RADIUS.lg, padding: '22px 20px', width: '100%', maxWidth: 340, boxShadow: SHADOW.modal }}>
            <div style={{ fontSize: TYPE.md, color: COLORS.textPrimary, lineHeight: 1.45, marginBottom: 20 }}>{req.message}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => finish(false)} style={btnStyle('ghost')}>{req.cancelLabel || 'Cancel'}</button>
              <button onClick={() => finish(true)} style={btnStyle(req.danger === false ? 'brand' : 'danger')}>{req.confirmLabel || 'OK'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToastHost() {
  const [t, setT] = useState(null);
  useEffect(() => {
    _toastFn = (message, kind) => {
      setT({ message, kind, id: Date.now() });
    };
    return () => { _toastFn = null; };
  }, []);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 2200);
    return () => clearTimeout(id);
  }, [t]);
  const bg = t?.kind === 'error' ? COLORS.danger : COLORS.brand;
  return (
    <AnimatePresence>
      {t && (
        <motion.div variants={toastVariants} initial="hidden" animate="visible" exit="exit"
          style={{ position: 'fixed', left: '50%', bottom: 96, zIndex: Z.toast, background: bg, color: '#fff', padding: '12px 20px', borderRadius: RADIUS.pill, fontSize: TYPE.base, fontWeight: 600, boxShadow: SHADOW.card, maxWidth: '88vw', textAlign: 'center' }}>
          {t.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const btnStyle = (variant = 'brand', big = false) => {
  const base = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', border: 'none', borderRadius: RADIUS.md, cursor: 'pointer',
    fontSize: big ? TYPE.lg : TYPE.base, fontWeight: 700, padding: big ? '16px 16px' : '13px 14px',
    minHeight: 48, transition: 'transform .12s ease, opacity .12s ease',
  };
  if (variant === 'brand') return { ...base, background: COLORS.brand, color: COLORS.textOnBrand };
  if (variant === 'gold') return { ...base, background: COLORS.warning, color: COLORS.textOnWarning };
  if (variant === 'danger') return { ...base, background: COLORS.danger, color: '#fff' };
  if (variant === 'ghost') return { ...base, background: COLORS.surfaceAlt, color: COLORS.textPrimary };
  if (variant === 'outline') return { ...base, background: 'transparent', color: COLORS.brand, border: `1px solid ${COLORS.brand}` };
  return base;
};

function Btn({ variant = 'brand', big, onClick, children, disabled, icon: Icon, style }) {
  return (
    <motion.button whileTap={{ scale: disabled ? 1 : 0.97 }} disabled={disabled}
      onClick={(e) => { if (disabled) return; haptic('light'); onClick?.(e); }}
      style={{ ...btnStyle(variant, big), opacity: disabled ? 0.5 : 1, ...style }}>
      {Icon && <Icon size={18} />}{children}
    </motion.button>
  );
}

function Field({ label, ...props }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      {label && <div style={{ fontSize: TYPE.sm, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      <input {...props}
        style={{
          width: '100%', background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.sm, padding: '13px 14px', fontSize: TYPE.lg, color: COLORS.textPrimary,
          outline: 'none', ...(props.style || {}),
        }} />
    </label>
  );
}

function Card({ children, style, onClick, tone }) {
  const bg = tone === 'brand' ? COLORS.brandSoft : tone === 'warning' ? COLORS.warningSoft : tone === 'danger' ? COLORS.dangerSoft : COLORS.surface;
  return (
    <div onClick={onClick} style={{
      background: bg, border: `1px solid ${tone ? 'transparent' : COLORS.border}`, borderRadius: RADIUS.lg,
      padding: 14, cursor: onClick ? 'pointer' : 'default', ...style,
    }}>{children}</div>
  );
}

function Tag({ tone = 'brand', children }) {
  const map = {
    brand: [COLORS.brandSoft, COLORS.brand],
    warning: [COLORS.warningSoft, COLORS.warningText],
    danger: [COLORS.dangerSoft, COLORS.dangerText],
    muted: [COLORS.surfaceAlt, COLORS.textSecondary],
  };
  const [bg, fg] = map[tone] || map.brand;
  return <span style={{ background: bg, color: fg, borderRadius: RADIUS.sm, padding: '3px 10px', fontSize: TYPE.xs, fontWeight: 700 }}>{children}</span>;
}

function Row({ left, right, sub, onClick, danger }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '13px 2px', borderBottom: `1px solid ${COLORS.border}`, cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: TYPE.base, fontWeight: 600, color: danger ? COLORS.dangerText : COLORS.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{left}</div>
        {sub && <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0, fontWeight: 700, color: COLORS.textPrimary, fontSize: TYPE.base }}>{right}</div>
    </div>
  );
}

function TopBar({ title, onBack, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
      position: 'sticky', top: 0, background: COLORS.bg, zIndex: Z.page, paddingTop: 'calc(14px + env(safe-area-inset-top,0px))',
    }}>
      {onBack && (
        <button onClick={() => { haptic(); onBack(); }} style={{ border: 'none', background: COLORS.surfaceAlt, borderRadius: RADIUS.sm, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={18} color={COLORS.textPrimary} />
        </button>
      )}
      <div style={{ fontSize: TYPE.xl, fontWeight: 800, color: COLORS.textPrimary, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      {right}
    </div>
  );
}

function Screen({ children, pad = true, bottomPad = 96 }) {
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit"
      style={{ minHeight: '100%', paddingBottom: bottomPad, paddingLeft: pad ? 16 : 0, paddingRight: pad ? 16 : 0 }}>
      {children}
    </motion.div>
  );
}

function Sheet({ title, onClose, children, footer }) {
  return (
    <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="hidden"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: Z.sheet, background: COLORS.overlay, display: 'flex', alignItems: 'flex-end' }}>
      <motion.div variants={sheetVariants} initial="hidden" animate="visible" exit="exit"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.bg, width: '100%', maxHeight: '88dvh', borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom,0px)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 10px' }}>
          <div style={{ fontSize: TYPE.lg, fontWeight: 800, color: COLORS.textPrimary }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: COLORS.surfaceAlt, borderRadius: RADIUS.pill, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} color={COLORS.textPrimary} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 16px 16px' }}>{children}</div>
        {footer && <div style={{ padding: '10px 16px 16px', borderTop: `1px solid ${COLORS.border}` }}>{footer}</div>}
      </motion.div>
    </motion.div>
  );
}

function Empty({ text, icon: Icon = Package }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: COLORS.textSecondary }}>
      <Icon size={34} style={{ opacity: 0.4, marginBottom: 10 }} />
      <div style={{ fontSize: TYPE.base, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

// Animates a number counting up to its target whenever the target changes —
// a small, honest bit of delight on the numbers people check every day.
function CountUp({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current; const to = value; prev.current = value;
    if (from === to) { setDisplay(to); return; }
    const start = performance.now(); const dur = 480;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="tnum">{formatNumber(decimals ? display : Math.round(display))}</span>;
}

const QtyStepper = ({ value, onChange, min = 0 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <button onClick={() => onChange(Math.max(min, value - 1))} style={stepBtn}><Minus size={14} /></button>
    <div className="tnum" style={{ minWidth: 26, textAlign: 'center', fontWeight: 700, fontSize: TYPE.base }}>{value}</div>
    <button onClick={() => onChange(value + 1)} style={{ ...stepBtn, background: COLORS.brand, color: '#fff' }}><Plus size={14} /></button>
  </div>
);
const stepBtn = { width: 30, height: 30, borderRadius: '50%', border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: COLORS.textPrimary };

/* ═══════════════════════════ TAB BAR ═══════════════════════════ */

function TabBar({ tab, setTab, t }) {
  const tabs = [
    { id: 'home', icon: HomeIcon, label: t('home') },
    { id: 'sales', icon: ShoppingBag, label: t('sales') },
    { id: 'stock', icon: Package, label: t('inventory') },
    { id: 'reports', icon: TrendingUp, label: t('reports') },
    { id: 'more', icon: MoreHorizontal, label: t('more') },
  ];
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: Z.tabBar, background: COLORS.surface,
      borderTop: `1px solid ${COLORS.border}`, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
      paddingBottom: 'env(safe-area-inset-bottom,0px)',
    }}>
      {tabs.map(({ id, icon: Icon, label }) => {
        const on = tab === id;
        return (
          <button key={id} onClick={() => { haptic(); setTab(id); }} style={{
            border: 'none', background: 'none', cursor: 'pointer', padding: '9px 2px 10px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: on ? COLORS.brand : COLORS.textSecondary,
          }}>
            <Icon size={20} strokeWidth={on ? 2.4 : 2} />
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════ ONBOARDING ═══════════════════════════ */

function Onboarding({ onDone }) {
  const [step, setStep] = useState('lang');
  const [lang, setLang] = useState('am');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [role, setRole] = useState('shop');
  const [shopName, setShopName] = useState('');
  const [town, setTown] = useState('');
  const [showRestore, setShowRestore] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [restoring, setRestoring] = useState(false);
  const { t, tb } = makeT(lang);
  const completeSetup = useStore((s) => s.completeSetup);

  const doRestore = async () => {
    const code = restoreCode.trim().toUpperCase();
    if (!code) return;
    setRestoring(true);
    const res = await restoreFromCode(code);
    setRestoring(false);
    if (res.ok) onDone(useStore.getState().lang || lang);
    else toast(t('syncError'), 'error');
  };

  const next = () => {
    if (step === 'lang') return setStep('phone');
    if (step === 'phone') {
      if (!normalizePhone(phone)) return toast(t('phoneBad'), 'error');
      return setStep('pin');
    }
    if (step === 'pin') {
      if (!/^\d{4}$/.test(pin)) return;
      return setStep('pin2');
    }
  };

  const finish = async () => {
    if (!shopName.trim()) return toast(t('nameNeeded'), 'error');
    const hash = await hashPin(pin);
    completeSetup({ name: shopName.trim(), town: town.trim(), phone: normalizePhone(phone), role }, hash);
    onDone(lang);
  };

  const steps = ['lang', 'phone', 'pin', 'pin2', 'role'];
  const idx = steps.indexOf(step);

  return (
    <div style={{ minHeight: '100dvh', background: COLORS.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, padding: '16px 16px 0', paddingTop: 'calc(16px + env(safe-area-inset-top,0px))' }}>
        {steps.map((s, i) => <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= idx ? COLORS.brand : COLORS.border }} />)}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} variants={fadeVariants} initial="hidden" animate="visible" exit="exit"
          style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column' }}>

          {step === 'lang' && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: COLORS.brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 14 }}>
                <TrendingUp size={26} color="#fff" />
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: COLORS.textPrimary }}>{t('appName')}</div>
              <div style={{ color: COLORS.textSecondary, marginTop: 4, marginBottom: 4, fontWeight: 600 }}>{t('taglineShort')}</div>
              <div style={{ color: COLORS.textSecondary, marginTop: 8, marginBottom: 28 }}>{t('chooseLang')}</div>
              {[['am', 'አማርኛ'], ['en', 'English']].map(([code, label]) => (
                <button key={code} onClick={() => setLang(code)} style={{
                  ...btnStyle(lang === code ? 'brand' : 'ghost', true), marginBottom: 10, justifyContent: 'flex-start',
                }}>{label}</button>
              ))}
              <button disabled style={{ ...btnStyle('ghost', true), opacity: 0.5, justifyContent: 'space-between', marginBottom: 10 }}>
                Afaan Oromoo <Tag tone="muted">{t('soon')}</Tag>
              </button>
              <div style={{ flex: 1 }} />
              {showRestore ? (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={restoreCode} onChange={(e) => setRestoreCode(e.target.value)} placeholder={t('shopCodePlaceholder')}
                      style={{ flex: 1, border: `1.5px solid ${COLORS.border}`, borderRadius: RADIUS.sm, padding: '10px 12px', fontSize: TYPE.sm, background: COLORS.surfaceAlt, color: COLORS.textPrimary }} />
                  </div>
                  <Btn big disabled={restoring || !restoreCode.trim()} onClick={doRestore}>{t('connect')}</Btn>
                </div>
              ) : (
                <button onClick={() => setShowRestore(true)} style={{ border: 'none', background: 'none', color: COLORS.textSecondary, fontSize: TYPE.sm, textAlign: 'center', marginBottom: 10, cursor: 'pointer', textDecoration: 'underline' }}>
                  {t('enterShopCode')}
                </button>
              )}
              <Btn big onClick={next}>{t('continue')}</Btn>
            </>
          )}

          {step === 'phone' && (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.textPrimary, marginTop: 20, marginBottom: 20 }}>{t('phoneNumber')}</div>
              <Field autoFocus type="tel" placeholder="+251 9__ ______" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <div style={{ flex: 1 }} />
              <Btn big onClick={next}>{t('continue')}</Btn>
            </>
          )}

          {(step === 'pin' || step === 'pin2') && (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.textPrimary, marginTop: 20, marginBottom: 20 }}>
                {step === 'pin' ? t('createPin') : t('confirmPin')}
              </div>
              <PinDots key={step} value={step === 'pin' ? pin : pin2} onChange={(v) => {
                if (step === 'pin') {
                  setPin(v);
                  if (v.length === 4) setTimeout(() => setStep('pin2'), 150);
                } else {
                  setPin2(v);
                  if (v.length === 4) {
                    setTimeout(() => {
                      if (v !== pin) { toast(t('pinMismatch'), 'error'); setPin2(''); return; }
                      setStep('role');
                    }, 150);
                  }
                }
              }} />
              <div style={{ flex: 1 }} />
            </>
          )}

          {step === 'role' && (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.textPrimary, marginTop: 12, marginBottom: 18 }}>{t('whoAreYou')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <button onClick={() => setRole('shop')} style={roleCard(role === 'shop')}>
                  <ShoppingBag size={22} /><div style={{ fontWeight: 700, marginTop: 6 }}>{t('shopOrTrader')}</div>
                </button>
                <button onClick={() => setRole('driver')} disabled style={{ ...roleCard(false), opacity: 0.5 }}>
                  <Truck size={22} /><div style={{ fontWeight: 700, marginTop: 6 }}>{t('driver')}</div>
                  <Tag tone="muted">{t('soon')}</Tag>
                </button>
              </div>
              <Field label={t('shopName')} value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder={lang === 'am' ? 'ለምሳሌ፡ አበበ ሱቅ' : 'e.g. Abebe Shop'} />
              <Field label={t('town')} value={town} onChange={(e) => setTown(e.target.value)} placeholder={lang === 'am' ? 'ለምሳሌ፡ አዲስ አበባ' : 'e.g. Addis Ababa'} />
              <div style={{ flex: 1 }} />
              <Btn big onClick={finish}>{t('start')}</Btn>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const roleCard = (on) => ({
  border: `2px solid ${on ? COLORS.brand : COLORS.border}`, background: on ? COLORS.brandSoft : COLORS.surface,
  borderRadius: RADIUS.lg, padding: '18px 10px', cursor: 'pointer', color: COLORS.textPrimary, textAlign: 'center',
});

function PinDots({ value, onChange }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div onClick={() => inputRef.current?.focus()} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            width: 46, height: 54, borderRadius: RADIUS.sm, border: `2px solid ${COLORS.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: COLORS.textPrimary,
            background: COLORS.surfaceAlt,
          }}>{value[i] ? '•' : ''}</div>
        ))}
      </div>
      <input ref={inputRef} value={value} inputMode="numeric" maxLength={4}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
    </div>
  );
}

function LockScreen({ pinHash, shopName, onUnlock }) {
  const [pin, setPin] = useState('');
  const { t } = makeT(useStore((s) => s.lang));
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (pin.length !== 4) return;
    hashPin(pin).then((h) => {
      if (h === pinHash) onUnlock();
      else { setErr(true); haptic('heavy'); setTimeout(() => { setPin(''); setErr(false); }, 500); }
    });
  }, [pin]);
  return (
    <div style={{ minHeight: '100dvh', background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: COLORS.brandGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><TrendingUp size={26} /></div>
      <div style={{ fontWeight: 700, color: COLORS.textPrimary, marginBottom: 4 }}>{shopName}</div>
      <div style={{ color: COLORS.textSecondary, marginBottom: 24 }}>{t('enterPin')}</div>
      <motion.div animate={err ? { x: [0, -8, 8, -8, 0] } : {}}>
        <PinDots value={pin} onChange={setPin} />
      </motion.div>
      {err && <div style={{ color: COLORS.dangerText, fontSize: TYPE.sm, marginTop: 10 }}>{t('pinWrong')}</div>}
    </div>
  );
}

/* ═══════════════════════════ HOME ═══════════════════════════ */

function StatTile({ icon: Icon, iconBg, iconColor, label, value, suffix }) {
  return (
    <Card style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: RADIUS.sm, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} color={iconColor} />
        </div>
        <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      </div>
      <div className="tnum" style={{ fontSize: TYPE.lg, fontWeight: 800, color: COLORS.textPrimary, marginTop: 8 }}>
        <CountUp value={value} />{suffix ? ` ${suffix}` : ''}
      </div>
    </Card>
  );
}

function QuickAction({ icon: Icon, bg, label, onClick }) {
  return (
    <button onClick={() => { haptic('light'); onClick(); }} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 46, height: 46, borderRadius: RADIUS.lg, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color="#fff" />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textPrimary, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </button>
  );
}

function Home({ t, tb, lang, calendar, openSell, openBuy, setTab, setStockFilter, setBookFilter, go }) {
  const shop = useStore((s) => s.shop);
  const items = useStore((s) => s.items);
  const people = useStore((s) => s.people);
  const ledger = useStore((s) => s.ledger);
  const sales = useStore((s) => s.sales);
  const expenses = useStore((s) => s.expenses);
  const dailyGoal = useStore((s) => s.dailyGoal);
  const goalCelebratedOn = useStore((s) => s.goalCelebratedOn);
  const setDailyGoal = useStore((s) => s.setDailyGoal);
  const markGoalCelebrated = useStore((s) => s.markGoalCelebrated);
  const online = useNetworkStatus();
  const [goalOpen, setGoalOpen] = useState(false);

  const dayStart = useMemo(() => new Date().setHours(0, 0, 0, 0), []);
  const yesterdayStart = dayStart - DAY_MS;
  const todayTotals = useMemo(() => periodTotals(sales, expenses, dayStart), [sales, expenses, dayStart]);
  const yesterdayTotals = useMemo(() => periodTotals(sales, expenses, yesterdayStart, dayStart - 1), [sales, expenses, dayStart]);
  const pctChange = yesterdayTotals.salesTotal > 0
    ? Math.round(((todayTotals.salesTotal - yesterdayTotals.salesTotal) / yesterdayTotals.salesTotal) * 100)
    : (todayTotals.salesTotal > 0 ? 100 : 0);

  const outstanding = useMemo(() => people.filter((p) => p.type === 'customer')
    .reduce((a, p) => a + accountInfo(ledger, p.id).balance, 0), [people, ledger]);

  const lowItems = items.filter((i) => itemStatus(i) !== 'ok');
  const overdue = people.filter((p) => p.type === 'customer' && accountInfo(ledger, p.id).daysLate > 0);
  const recent = sales.slice(-4).reverse();
  const streak = useMemo(() => calcStreak(sales), [sales]);
  const goalPct = dailyGoal > 0 ? Math.min(100, Math.round((todayTotals.salesTotal / dailyGoal) * 100)) : 0;
  const goalHit = dailyGoal > 0 && todayTotals.salesTotal >= dailyGoal;

  useEffect(() => {
    if (goalHit && goalCelebratedOn !== dayStart) {
      haptic('heavy'); toast(t('goalReached'));
      markGoalCelebrated(dayStart);
    }
  }, [goalHit]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('greetMorning') : hour < 17 ? t('greetAfternoon') : t('greetEvening');
  const initials = (shop?.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <Screen bottomPad={100}>
      <div style={{ paddingTop: 'env(safe-area-inset-top,0px)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: COLORS.brandGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: TYPE.base, flexShrink: 0 }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary, fontWeight: 600 }}>{greeting}</div>
            <div style={{ fontSize: TYPE.lg, fontWeight: 800, color: COLORS.textPrimary, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '48vw' }}>{shop?.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {streak >= 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: COLORS.warningSoft, color: COLORS.warningText, borderRadius: RADIUS.pill, padding: '5px 10px', fontWeight: 800, fontSize: TYPE.sm }}>
              <Flame size={14} fill={COLORS.warningText} strokeWidth={0} /> {streak}
            </div>
          )}
          {!online && <Tag tone="muted">{t('offline')}</Tag>}
          <button onClick={() => setTab('more')} style={{ ...iconBtn, position: 'relative' }}>
            <Bell size={17} color={COLORS.textPrimary} />
            {(lowItems.length + overdue.length) > 0 && (
              <span style={{ position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: '50%', background: COLORS.danger, border: `1.5px solid ${COLORS.surface}` }} />
            )}
          </button>
        </div>
      </div>

      <div style={{ color: COLORS.textSecondary, fontSize: TYPE.sm, fontWeight: 500, marginBottom: 12 }}>{tb('letsBuild')}</div>

      {/* Hero: today's sales */}
      <div onClick={() => setGoalOpen(true)} style={{
        background: COLORS.brandGradient, borderRadius: RADIUS.lg, padding: 18, cursor: 'pointer',
        boxShadow: SHADOW.card, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: TYPE.sm, fontWeight: 700 }}>{t('todaysSalesLabel')}</div>
          {pctChange !== 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.18)', borderRadius: RADIUS.pill, padding: '3px 8px', color: '#fff', fontSize: 11, fontWeight: 800 }}>
              {pctChange > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(pctChange)}%
            </div>
          )}
        </div>
        <div className="tnum" style={{ color: '#fff', fontSize: 30, fontWeight: 800, marginTop: 6 }}>
          {lang === 'en' ? 'ETB ' : ''}<CountUp value={todayTotals.salesTotal} />{lang !== 'en' ? ` ${t('birr')}` : ''}
        </div>
        {dailyGoal > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
              <motion.div initial={false} animate={{ width: `${goalPct}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ height: '100%', borderRadius: 3, background: '#fff' }} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 700, marginTop: 5 }}>{formatNumber(todayTotals.salesTotal)} / {formatNumber(dailyGoal)} {t('birr')} {t('dailyGoal')}</div>
          </div>
        )}
        {dailyGoal <= 0 && <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600, marginTop: 10 }}>{t('setGoal')} ›</div>}
      </div>

      {/* 2x2 stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <StatTile icon={ShoppingBag} iconBg={COLORS.infoSoft} iconColor={COLORS.info} label={t('sales')} value={todayTotals.salesTotal} />
        <StatTile icon={Wallet} iconBg={COLORS.dangerSoft} iconColor={COLORS.dangerText} label={t('expenses')} value={todayTotals.expTotal} />
        <StatTile icon={TrendingUp} iconBg={COLORS.brandSoft} iconColor={COLORS.brand} label={t('profit')} value={todayTotals.profit} />
        <StatTile icon={Users} iconBg={COLORS.accentSoft} iconColor={COLORS.accent} label={t('outstanding')} value={outstanding} />
      </div>

      {/* Quick actions */}
      <div style={{ marginTop: 18, fontWeight: 800, color: COLORS.textPrimary, fontSize: TYPE.md, marginBottom: 12 }}>{t('quickActions')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        <QuickAction icon={ShoppingBag} bg={COLORS.brand} label={t('newSale')} onClick={openSell} />
        <QuickAction icon={Wallet} bg={COLORS.danger} label={t('addExpenseAction')} onClick={() => go('expenses', { openAdd: true })} />
        <QuickAction icon={Package} bg={COLORS.info} label={t('addItemAction')} onClick={() => go('item')} />
        <QuickAction icon={Users} bg={COLORS.accent} label={t('addCustomerAction')} onClick={() => go('person', { defaultType: 'customer' })} />
      </div>

      {(lowItems.length > 0 || overdue.length > 0) ? (
        <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
          {lowItems.length > 0 && (
            <Card tone="warning" onClick={() => { setStockFilter('low'); setTab('stock'); }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} color={COLORS.warningText} />
              <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: TYPE.sm, flex: 1 }}>{lowItems.length} {t('itemsLow')}</div>
              <ChevronRight size={16} color={COLORS.textSecondary} />
            </Card>
          )}
          {overdue.length > 0 && (
            <Card tone="danger" onClick={() => { setBookFilter('customers'); go('customers'); }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} color={COLORS.dangerText} />
              <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: TYPE.sm, flex: 1 }}>{overdue.length} {t('customersOverdue')}</div>
              <ChevronRight size={16} color={COLORS.textSecondary} />
            </Card>
          )}
        </div>
      ) : (
        <Card tone="brand" style={{ marginTop: 16, textAlign: 'center', color: COLORS.brand, fontWeight: 700 }}>{t('allGood')} ✓</Card>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 4 }}>
        <div style={{ fontWeight: 800, color: COLORS.textPrimary, fontSize: TYPE.md }}>{t('recentSales')}</div>
        <button onClick={() => setTab('sales')} style={{ border: 'none', background: 'none', color: COLORS.brand, fontWeight: 700, fontSize: TYPE.sm, cursor: 'pointer' }}>{t('viewAll')}</button>
      </div>
      {recent.length === 0 ? <Empty text={t('noSalesYet')} icon={ShoppingBag} /> : (
        <div style={{ marginTop: 6 }}>
          {recent.map((s) => (
            <Row key={s.id} left={s.lines.map((l) => l.name).join(', ')} sub={formatDate(s.ts, calendar)} right={`${formatNumber(s.total)} ${t('birr')}`} />
          ))}
        </div>
      )}

      <FloatingSell onClick={openSell} label={t('sell')} />

      <AnimatePresence>
        {goalOpen && (
          <Sheet title={dailyGoal > 0 ? t('editGoal') : t('setGoal')} onClose={() => setGoalOpen(false)}>
            <GoalForm t={t} initial={dailyGoal} onSave={(v) => { setDailyGoal(v); setGoalOpen(false); }} />
          </Sheet>
        )}
      </AnimatePresence>
    </Screen>
  );
}

function GoalForm({ t, initial, onSave }) {
  const [v, setV] = useState(initial > 0 ? String(initial) : '');
  return (
    <div>
      <Field label={t('dailyGoal')} type="number" inputMode="decimal" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="0" />
      <Btn big onClick={() => onSave(v)}>{t('save')}</Btn>
    </div>
  );
}

function FloatingSell({ onClick, label }) {
  return (
    <div style={{ position: 'fixed', left: 16, right: 16, bottom: 74, zIndex: Z.tabBar - 1 }}>
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => { haptic('medium'); onClick(); }}
        style={{ ...btnStyle('brand', true), boxShadow: SHADOW.card, fontSize: TYPE.lg }}>
        <Plus size={20} /> {label}
      </motion.button>
    </div>
  );
}

/* ═══════════════════════════ SALES ═══════════════════════════ */

function SalesTab({ t, calendar, openSell }) {
  const sales = useStore((s) => s.sales);
  const people = useStore((s) => s.people);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const dayStart = useMemo(() => new Date().setHours(0, 0, 0, 0), []);

  const list = useMemo(() => sales.slice().reverse().filter((s) => {
    if (filter === 'cash' && s.method === 'credit') return false;
    if (filter === 'credit' && s.method !== 'credit') return false;
    if (filter === 'today' && s.ts < dayStart) return false;
    if (q) {
      const names = s.lines.map((l) => l.name).join(' ').toLowerCase();
      if (!names.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [sales, filter, q, dayStart]);

  const todayTotal = useMemo(() => sales.filter((s) => s.ts >= dayStart).reduce((a, s) => a + s.total, 0), [sales, dayStart]);
  const chips = [['all', t('all')], ['cash', t('cash')], ['credit', t('credit')], ['today', t('today')]];

  return (
    <Screen>
      <TopBar title={t('sales')} right={
        <button onClick={openSell} style={{ ...iconBtn, background: COLORS.brand }}><Plus size={18} color="#fff" /></button>
      } />
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: 15, color: COLORS.textSecondary }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchShort')}
          style={{ width: '100%', background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, padding: '12px 14px 12px 38px', fontSize: TYPE.base, outline: 'none', color: COLORS.textPrimary }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }} className="no-scrollbar">
        {chips.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            border: 'none', borderRadius: RADIUS.pill, padding: '6px 14px', fontSize: TYPE.sm, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
            background: filter === id ? COLORS.brand : COLORS.surfaceAlt, color: filter === id ? '#fff' : COLORS.textSecondary,
          }}>{label}</button>
        ))}
      </div>

      <Card tone="brand" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: TYPE.xs, color: COLORS.brand, fontWeight: 700 }}>{t('todaySales')}</div>
        <div className="tnum" style={{ fontSize: TYPE.lg, fontWeight: 800, color: COLORS.textPrimary }}>{formatNumber(todayTotal)} {t('birr')}</div>
      </Card>

      {list.length === 0 ? <Empty text={t('noSalesYet')} icon={ShoppingBag} /> : list.map((s) => {
        const person = s.personId ? people.find((p) => p.id === s.personId) : null;
        return (
          <Card key={s.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, color: COLORS.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {person ? person.name : s.lines.map((l) => l.name).join(', ')}
                </div>
                <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary, marginTop: 2 }}>
                  {s.method === 'credit' ? t('credit') : s.method === 'telebirr' ? t('telebirr') : t('cash')} · {formatDate(s.ts, calendar)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                <div className="tnum" style={{ fontWeight: 800, color: COLORS.textPrimary }}>{formatNumber(s.total)}</div>
                <Tag tone={s.method === 'credit' ? 'warning' : 'brand'}>{s.method === 'credit' ? t('credit') : t('paid')}</Tag>
              </div>
            </div>
          </Card>
        );
      })}
      <FloatingSell onClick={openSell} label={t('sell')} />
    </Screen>
  );
}

/* ═══════════════════════════ SELL FLOW ═══════════════════════════ */

function SellFlow({ t, tb, onClose }) {
  const items = useStore((s) => s.items);
  const people = useStore((s) => s.people);
  const recordSale = useStore((s) => s.recordSale);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState({}); // itemId -> qty
  const [stage, setStage] = useState('pick'); // pick | pay | personPick | receipt
  const [method, setMethod] = useState(null);
  const [personId, setPersonId] = useState(null);
  const [savedSale, setSavedSale] = useState(null);
  const [dueDays, setDueDays] = useState(14);
  const [tbConfirmed, setTbConfirmed] = useState(false);

  const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())) : items;
  const cartLines = Object.entries(cart).filter(([, qty]) => qty > 0);
  const total = cartLines.reduce((a, [id, qty]) => a + (items.find((i) => i.id === id)?.sell || 0) * qty, 0);
  const customers = people.filter((p) => p.type === 'customer');

  const setQty = (id, qty) => setCart((c) => ({ ...c, [id]: Math.max(0, qty) }));

  const goPay = () => {
    if (cartLines.length === 0) return toast(t('emptyCart'), 'error');
    setStage('pay');
  };

  const save = () => {
    if (method === 'credit' && !personId) return toast(t('needCustomer'), 'error');
    const lines = cartLines.map(([itemId, qty]) => ({ itemId, qty }));
    const sale = recordSale({ lines, method, personId, dueDays });
    haptic('medium'); toast(t('saleSaved'));
    setSavedSale(sale);
    setStage('receipt');
  };

  const person = people.find((p) => p.id === personId);
  const overLimit = person && person.limit > 0 && (accountInfo(useStore.getState().ledger, person.id).balance + total) > person.limit;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit"
      style={{ position: 'fixed', inset: 0, zIndex: Z.page, background: COLORS.bg, display: 'flex', flexDirection: 'column' }}>
      <TopBar title={stage === 'pick' ? t('newSale') : stage === 'pay' ? t('payment') : t('receipt')}
        onBack={stage === 'pick' ? onClose : stage === 'pay' ? () => setStage('pick') : undefined}
        right={stage !== 'receipt' && <button onClick={onClose} style={{ border: 'none', background: 'none', color: COLORS.textSecondary, fontWeight: 600, cursor: 'pointer' }}>{t('cancel')}</button>} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {stage === 'pick' && (
          <>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: 15, color: COLORS.textSecondary }} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchItem')}
                style={{ width: '100%', background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, padding: '13px 14px 13px 38px', fontSize: TYPE.base, color: COLORS.textPrimary, outline: 'none' }} />
            </div>
            {filtered.length === 0 ? <Empty text={t('noItemsFound')} /> : filtered.map((i) => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <div>
                  <div style={{ fontWeight: 600, color: COLORS.textPrimary }}>{i.name}</div>
                  <div className="tnum" style={{ fontSize: TYPE.xs, color: COLORS.textSecondary }}>{formatNumber(i.sell)} {t('birr')}{i.qty <= 0 && <span style={{ color: COLORS.dangerText }}> · {t('noStockNote')}</span>}</div>
                </div>
                <QtyStepper value={cart[i.id] || 0} onChange={(v) => setQty(i.id, v)} />
              </div>
            ))}
          </>
        )}

        {stage === 'pay' && (
          <>
            <Card style={{ marginBottom: 14 }}>
              {cartLines.map(([id, qty]) => {
                const it = items.find((i) => i.id === id);
                return <Row key={id} left={it.name} sub={`${qty} × ${formatNumber(it.sell)}`} right={formatNumber(it.sell * qty)} />;
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontWeight: 800 }}>
                <span>{t('total')}</span><span className="tnum" style={{ fontSize: TYPE.lg, color: COLORS.brand }}>{formatNumber(total)} {t('birr')}</span>
              </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Btn variant={method === 'cash' ? 'brand' : 'ghost'} onClick={() => { setMethod('cash'); setPersonId(null); }}>{t('cash')}</Btn>
              <Btn variant={method === 'telebirr' ? 'brand' : 'ghost'} onClick={() => { setMethod('telebirr'); setPersonId(null); setTbConfirmed(false); }}>{t('telebirr')}</Btn>
            </div>
            <Btn variant={method === 'credit' ? 'brand' : 'ghost'} onClick={() => setMethod('credit')} style={{ marginBottom: 14 }}>{t('credit')}</Btn>

            {method === 'telebirr' && (
              <Card tone="brand" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: TYPE.sm, color: COLORS.textPrimary }}>{t('telebirrHint')}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontWeight: 700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={tbConfirmed} onChange={(e) => setTbConfirmed(e.target.checked)} /> {t('telebirrPaid')}
                </label>
              </Card>
            )}

            {method === 'credit' && (
              <Card style={{ marginBottom: 14 }} onClick={() => setStage('personPick')}>
                {person ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div style={{ fontWeight: 700 }}>{person.name}</div><div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary }}>{t('dueIn')} {dueDays} {t('days')}</div></div>
                    <ChevronRight size={16} color={COLORS.textSecondary} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: COLORS.textSecondary, fontWeight: 600 }}>{t('chooseCustomer')} <ChevronRight size={16} /></div>
                )}
              </Card>
            )}
            {overLimit && <Card tone="warning" style={{ marginBottom: 14, fontSize: TYPE.sm, color: COLORS.textPrimary }}>{t('overLimit')}</Card>}
          </>
        )}

        {stage === 'personPick' && (
          <div style={{ paddingTop: 8 }}>
            {customers.length === 0 ? <Empty text={t('emptyBook')} icon={Users} /> : customers.map((p) => (
              <Row key={p.id} left={p.name} sub={p.phone} right={<ChevronRight size={16} />} onClick={() => { setPersonId(p.id); setStage('pay'); }} />
            ))}
          </div>
        )}

        {stage === 'receipt' && savedSale && (
          <div style={{ textAlign: 'center', paddingTop: 24 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: COLORS.brandSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Check size={30} color={COLORS.brand} />
            </div>
            <div style={{ fontWeight: 800, fontSize: TYPE.lg, color: COLORS.textPrimary }}>{t('thanks')}</div>
            <Card style={{ marginTop: 16, textAlign: 'left' }}>
              {savedSale.lines.map((l) => <Row key={l.itemId} left={`${l.name} × ${l.qty}`} right={formatNumber(l.price * l.qty)} />)}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontWeight: 800 }}>
                <span>{t('total')}</span><span>{formatNumber(savedSale.total)} {t('birr')}</span>
              </div>
            </Card>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 16px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom,0px))', borderTop: `1px solid ${COLORS.border}` }}>
        {stage === 'pick' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: COLORS.textSecondary, fontWeight: 600 }}>{t('total')}</span>
            <span className="tnum" style={{ fontWeight: 800, fontSize: TYPE.lg }}>{formatNumber(total)} {t('birr')}</span>
          </div>
        )}
        {stage === 'pick' && <Btn big onClick={goPay} disabled={cartLines.length === 0}>{t('continue')}</Btn>}
        {stage === 'pay' && <Btn big onClick={save} disabled={!method || (method === 'telebirr' && !tbConfirmed)}>{t('saveSale')}</Btn>}
        {stage === 'receipt' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Btn variant="ghost" onClick={() => shareText(receiptText(savedSale, t))}><Share2 size={16} /> {t('sendReceipt')}</Btn>
            <Btn onClick={onClose}>{t('done')}</Btn>
          </div>
        )}
      </div>
    </motion.div>
  );
}

const receiptText = (sale, t) =>
  `${t('receipt')}\n${sale.lines.map((l) => `${l.name} x${l.qty} = ${formatNumber(l.price * l.qty)}`).join('\n')}\n${t('total')}: ${formatNumber(sale.total)} ${t('birr')}`;

/* ═══════════════════════════ BUY STOCK ═══════════════════════════ */

function BuyFlow({ t, onClose }) {
  const items = useStore((s) => s.items);
  const people = useStore((s) => s.people);
  const recordBuy = useStore((s) => s.recordBuy);
  const [supplierId, setSupplierId] = useState(null);
  const [cart, setCart] = useState({});
  const [method, setMethod] = useState('cash');
  const suppliers = people.filter((p) => p.type === 'supplier');

  const setQty = (id, qty) => setCart((c) => ({ ...c, [id]: Math.max(0, qty) }));
  const lines = Object.entries(cart).filter(([, q]) => q > 0);
  const total = lines.reduce((a, [id, q]) => a + (items.find((i) => i.id === id)?.buy || 0) * q, 0);

  const save = () => {
    if (lines.length === 0) return toast(t('addItemsToBuy'), 'error');
    if (method === 'credit' && !supplierId) return toast(t('needSupplier'), 'error');
    recordBuy({ lines: lines.map(([itemId, qty]) => ({ itemId, qty, cost: items.find((i) => i.id === itemId).buy })), method, supplierId });
    haptic('medium'); toast(t('buySaved'));
    onClose();
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit"
      style={{ position: 'fixed', inset: 0, zIndex: Z.page, background: COLORS.bg, display: 'flex', flexDirection: 'column' }}>
      <TopBar title={t('buyStock')} onBack={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        <SelectRow label={t('supplier')} value={people.find((p) => p.id === supplierId)?.name} placeholder={t('chooseSupplier')}
          options={suppliers} onPick={setSupplierId} noneLabel={t('chooseSupplier')} />
        <div style={{ marginTop: 8 }}>
          {items.map((i) => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${COLORS.border}` }}>
              <div><div style={{ fontWeight: 600 }}>{i.name}</div><div className="tnum" style={{ fontSize: TYPE.xs, color: COLORS.textSecondary }}>{formatNumber(i.buy)} {t('birr')}</div></div>
              <QtyStepper value={cart[i.id] || 0} onChange={(v) => setQty(i.id, v)} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
          <Btn variant={method === 'cash' ? 'brand' : 'ghost'} onClick={() => setMethod('cash')}>{t('cash')}</Btn>
          <Btn variant={method === 'credit' ? 'brand' : 'ghost'} onClick={() => setMethod('credit')}>{t('credit')}</Btn>
        </div>
      </div>
      <div style={{ padding: '10px 16px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom,0px))', borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontWeight: 700 }}><span>{t('total')}</span><span className="tnum">{formatNumber(total)} {t('birr')}</span></div>
        <Btn big onClick={save}>{t('save')}</Btn>
      </div>
    </motion.div>
  );
}

function SelectRow({ label, value, placeholder, options, onPick, noneLabel }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card onClick={() => setOpen(true)} style={{ marginTop: 10 }}>
        <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary, fontWeight: 700 }}>{label}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontWeight: 700, color: value ? COLORS.textPrimary : COLORS.textSecondary }}>{value || placeholder}</span>
          <ChevronRight size={16} color={COLORS.textSecondary} />
        </div>
      </Card>
      <AnimatePresence>
        {open && (
          <Sheet title={label} onClose={() => setOpen(false)}>
            {options.length === 0 ? <Empty text={noneLabel} /> : options.map((o) => (
              <Row key={o.id} left={o.name} sub={o.phone} right={<ChevronRight size={16} />} onClick={() => { onPick(o.id); setOpen(false); }} />
            ))}
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}

/* ═══════════════════════════ STOCK ═══════════════════════════ */

function StockTab({ t, filter, setFilter, openAddItem, openEditItem, openCount, openBuy }) {
  const items = useStore((s) => s.items);
  const [q, setQ] = useState('');
  const withStatus = items.map((i) => ({ ...i, status: itemStatus(i), expSoon: isExpiringSoon(i) }));
  const filtered = withStatus.filter((i) => {
    if (q && !i.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'low') return i.status === 'low';
    if (filter === 'out') return i.status === 'out';
    if (filter === 'exp') return i.expSoon;
    return true;
  });
  const chips = [['all', t('all')], ['low', t('low')], ['out', t('out')], ['exp', t('expiring')]];

  return (
    <Screen>
      <TopBar title={t('inventory')} right={<button onClick={openAddItem} style={{ ...iconBtn, background: COLORS.brand }}><Plus size={18} color="#fff" /></button>} />
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: 15, color: COLORS.textSecondary }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchShort')}
          style={{ width: '100%', background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, padding: '12px 14px 12px 38px', fontSize: TYPE.base, outline: 'none', color: COLORS.textPrimary }} />
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }} className="no-scrollbar">
        {chips.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            border: 'none', borderRadius: RADIUS.pill, padding: '6px 14px', fontSize: TYPE.sm, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
            background: filter === id ? COLORS.brand : COLORS.surfaceAlt, color: filter === id ? '#fff' : COLORS.textSecondary,
          }}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <Btn variant="outline" onClick={openCount}>{t('stockCount')}</Btn>
        <Btn variant="outline" onClick={openBuy}>{t('buy')}</Btn>
      </div>

      <div style={{ marginTop: 10 }}>
        {filtered.length === 0 ? <Empty text={items.length === 0 ? t('emptyStock') : t('noItemsFound')} /> : filtered.map((i) => (
          <Card key={i.id} onClick={() => openEditItem(i)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, cursor: 'pointer' }}>
            <div style={{
              width: 40, height: 40, borderRadius: RADIUS.sm, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i.status === 'out' ? COLORS.dangerSoft : i.status === 'low' ? COLORS.warningSoft : COLORS.brandSoft,
            }}>
              <Package size={18} color={i.status === 'out' ? COLORS.dangerText : i.status === 'low' ? COLORS.warningText : COLORS.brand} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: COLORS.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
              <div className="tnum" style={{ fontSize: TYPE.xs, color: COLORS.textSecondary, marginTop: 2 }}>{t('stock')}: {i.qty} · {formatNumber(i.sell)} {t('birr')}</div>
            </div>
            <Tag tone={i.status === 'out' ? 'danger' : i.status === 'low' ? 'warning' : 'brand'}>
              {i.status === 'out' ? t('outOfStock') : i.status === 'low' ? t('lowStock') : t('inStock')}
            </Tag>
          </Card>
        ))}
      </div>
    </Screen>
  );
}

const iconBtn = { border: 'none', background: COLORS.surfaceAlt, borderRadius: RADIUS.sm, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

function ItemEditor({ t, item, onClose }) {
  const addItem = useStore((s) => s.addItem);
  const updateItem = useStore((s) => s.updateItem);
  const deleteItem = useStore((s) => s.deleteItem);
  const [f, setF] = useState(item || { name: '', buy: '', sell: '', qty: '', unit: 'piece', alert: '', expiry: '' });
  const units = [['piece', t('piece')], ['kg', t('kg')], ['litre', t('litre')], ['quintal', t('quintal')], ['box', t('box')]];

  const save = () => {
    if (!f.name.trim()) return toast(t('nameNeeded'), 'error');
    if (!f.sell) return toast(t('priceNeeded'), 'error');
    const data = { ...f, expiry: f.expiry ? new Date(f.expiry).getTime() : null };
    if (item) updateItem(item.id, data); else addItem(data);
    haptic('medium'); toast(t('itemSaved'));
    onClose();
  };
  const remove = async () => {
    if (await askConfirm(t('deleteItemQ'))) { deleteItem(item.id); onClose(); }
  };
  const belowCost = f.sell && f.buy && Number(f.sell) < Number(f.buy);

  return (
    <Sheet title={item ? t('editItem') : t('addItem')} onClose={onClose}
      footer={<div style={{ display: 'flex', gap: 10 }}>{item && <Btn variant="danger" onClick={remove} style={{ width: 48, flex: 'none' }} icon={Trash2} />}<Btn onClick={save}>{t('save')}</Btn></div>}>
      <Field label={t('name')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label={t('buyPrice')} type="number" inputMode="decimal" value={f.buy} onChange={(e) => setF({ ...f, buy: e.target.value })} />
        <Field label={t('sellPrice')} type="number" inputMode="decimal" value={f.sell} onChange={(e) => setF({ ...f, sell: e.target.value })} />
      </div>
      {belowCost && <div style={{ color: COLORS.dangerText, fontSize: TYPE.xs, marginTop: -6, marginBottom: 10 }}>{t('belowCost')}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label={t('qty')} type="number" inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ fontSize: TYPE.sm, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600 }}>{t('unit')}</div>
          <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}
            style={{ width: '100%', background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, padding: '13px 14px', fontSize: TYPE.lg, color: COLORS.textPrimary }}>
            {units.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <Field label={t('alertAt')} type="number" inputMode="numeric" value={f.alert} onChange={(e) => setF({ ...f, alert: e.target.value })} />
      <Field label={t('expiryDate')} type="date" value={f.expiry ? new Date(f.expiry).toISOString().slice(0, 10) : ''} onChange={(e) => setF({ ...f, expiry: e.target.value })} />
    </Sheet>
  );
}

function StockCount({ t, onClose }) {
  const items = useStore((s) => s.items);
  const finishCount = useStore((s) => s.finishCount);
  const [counts, setCounts] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.qty])));
  const missing = items.reduce((a, i) => {
    const c = counts[i.id];
    return c < i.qty ? a + (i.qty - c) * i.buy : a;
  }, 0);
  const finish = () => {
    const val = finishCount(items.map((i) => ({ itemId: i.id, counted: counts[i.id] })));
    haptic('medium'); toast(t('countSaved'));
    onClose();
  };
  return (
    <Sheet title={t('stockCount')} onClose={onClose} footer={<Btn big onClick={finish}>{t('finishCount')}</Btn>}>
      <div style={{ color: COLORS.textSecondary, fontSize: TYPE.sm, marginBottom: 10 }}>{t('countHint')}</div>
      {items.map((i) => (
        <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
          <div><div style={{ fontWeight: 600 }}>{i.name}</div><div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary }}>{t('inBook')}: {i.qty}</div></div>
          <input type="number" inputMode="numeric" value={counts[i.id]} onChange={(e) => setCounts({ ...counts, [i.id]: Number(e.target.value) || 0 })}
            style={{ width: 64, textAlign: 'center', background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, padding: '8px 4px', fontSize: TYPE.base, fontWeight: 700, color: COLORS.textPrimary }} />
        </div>
      ))}
      {items.length > 0 && (
        <Card tone={missing > 0 ? 'danger' : 'brand'} style={{ marginTop: 14 }}>
          {missing > 0 ? `${t('missing')}: ${formatNumber(missing)} ${t('birr')}` : t('countMatches')}
        </Card>
      )}
    </Sheet>
  );
}

/* ═══════════════════════════ BOOK (CREDIT LEDGER) ═══════════════════════════ */

function BookTab({ t, calendar, filter, setFilter, openStatement, openAddPerson, onBack }) {
  const people = useStore((s) => s.people);
  const ledger = useStore((s) => s.ledger);
  const shop = useStore((s) => s.shop);
  const list = people.filter((p) => p.type === filter).map((p) => ({ ...p, info: accountInfo(ledger, p.id) }))
    .sort((a, b) => b.info.daysLate - a.info.daysLate || b.info.balance - a.info.balance);
  const owingList = list.filter((p) => p.info.balance > 0);

  const owedToMe = people.filter((p) => p.type === 'customer').reduce((a, p) => a + accountInfo(ledger, p.id).balance, 0);
  const iOwe = people.filter((p) => p.type === 'supplier').reduce((a, p) => a + accountInfo(ledger, p.id).balance, 0);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [queueOpen, setQueueOpen] = useState(false);

  const toggle = (id) => setSelected((s) => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  const remindAllOverdue = () => {
    setSelected(new Set(list.filter((p) => p.info.daysLate > 0).map((p) => p.id)));
    setSelectMode(true);
  };
  const selectedPeople = list.filter((p) => selected.has(p.id));
  const overdueCount = filter === 'customer' ? list.filter((p) => p.info.daysLate > 0).length : 0;

  return (
    <Screen>
      <TopBar title={t('customersScreen')} onBack={onBack} right={
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={selectMode ? exitSelect : () => setSelectMode(true)} style={{ border: 'none', background: 'none', color: selectMode ? COLORS.dangerText : COLORS.brand, fontWeight: 700, cursor: 'pointer', fontSize: TYPE.sm }}>
            {selectMode ? t('cancelSelect') : t('select')}
          </button>
          {!selectMode && <button onClick={openAddPerson} style={iconBtn}><Plus size={18} color={COLORS.brand} /></button>}
        </div>
      } />
      {!selectMode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Card tone="brand"><div style={{ fontSize: TYPE.xs, color: COLORS.brand, fontWeight: 700 }}>{t('owedToMe')}</div><div className="tnum" style={{ fontSize: TYPE.xl, fontWeight: 800 }}>{formatNumber(owedToMe)}</div></Card>
          <Card tone="danger"><div style={{ fontSize: TYPE.xs, color: COLORS.dangerText, fontWeight: 700 }}>{t('iOwe')}</div><div className="tnum" style={{ fontSize: TYPE.xl, fontWeight: 800 }}>{formatNumber(iOwe)}</div></Card>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <Btn variant={filter === 'customer' ? 'brand' : 'ghost'} onClick={() => { setFilter('customer'); exitSelect(); }}>{t('customers')}</Btn>
        <Btn variant={filter === 'supplier' ? 'brand' : 'ghost'} onClick={() => { setFilter('supplier'); exitSelect(); }}>{t('suppliers')}</Btn>
      </div>

      {!selectMode && overdueCount > 0 && (
        <Card tone="danger" onClick={remindAllOverdue} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageCircle size={18} color={COLORS.dangerText} />
          <div style={{ flex: 1, fontWeight: 700, fontSize: TYPE.sm, color: COLORS.textPrimary }}>{t('remindAllOverdue')} ({overdueCount})</div>
          <ChevronRight size={16} color={COLORS.textSecondary} />
        </Card>
      )}

      {selectMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 2 }}>
          <span style={{ fontSize: TYPE.sm, color: COLORS.textSecondary, fontWeight: 600 }}>{selected.size} {t('nSelected')}</span>
          <button onClick={() => setSelected(new Set(owingList.map((p) => p.id)))} style={{ border: 'none', background: 'none', color: COLORS.brand, fontWeight: 700, fontSize: TYPE.sm, cursor: 'pointer' }}>{t('selectAll')}</button>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {list.length === 0 ? <Empty text={t('emptyBook')} icon={Users} /> : list.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectMode && (
              <button onClick={() => toggle(p.id)} style={{ border: 'none', background: 'none', padding: 6, cursor: 'pointer', flexShrink: 0 }}>
                {selected.has(p.id) ? <CheckSquare size={20} color={COLORS.brand} /> : <Square size={20} color={COLORS.textSecondary} />}
              </button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Row onClick={() => (selectMode ? toggle(p.id) : openStatement(p))} left={p.name}
                sub={p.info.daysLate > 0 ? `${p.info.daysLate} ${t('overdueBy')}` : p.info.nextDue ? `${t('dueOn')} ${formatDate(p.info.nextDue, calendar)}` : t('noDebt')}
                right={p.info.balance > 0 ? <span className="tnum" style={{ color: p.info.daysLate > 0 ? COLORS.dangerText : COLORS.textPrimary }}>{formatNumber(p.info.balance)}</span> : '—'} />
            </div>
          </div>
        ))}
      </div>

      {selectMode && selected.size > 0 && (
        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 74, zIndex: Z.tabBar - 1 }}>
          <Btn big onClick={() => setQueueOpen(true)}>{t('remindSelected')} ({selected.size})</Btn>
        </div>
      )}

      <AnimatePresence>
        {queueOpen && (
          <BulkReminderSheet t={t} shop={shop} people={selectedPeople} ledger={ledger}
            onClose={() => { setQueueOpen(false); exitSelect(); }} />
        )}
      </AnimatePresence>
    </Screen>
  );
}

// Sequential send queue: browsers can't fire off several SMS/Telegram intents
// without a tap each, so this walks the shopkeeper through one person at a
// time — fast, honest, and it never pretends a message sent when it didn't.
function BulkReminderSheet({ t, shop, people, ledger, onClose }) {
  const [channel, setChannel] = useState(null);
  const [i, setI] = useState(0);
  const [sentIds, setSentIds] = useState(() => new Set());

  const current = people[i];
  const info = current ? accountInfo(ledger, current.id) : null;
  const done = i >= people.length;

  const sendCurrent = () => {
    const msg = buildReminder(current, info.balance, shop, t);
    if (channel === 'telegram') { shareTelegram(msg); }
    else if (current.phone) { shareText(msg, current.phone); }
    else { toast(t('noPhoneSkip')); }
    setSentIds((s) => new Set(s).add(current.id));
    haptic('light');
    setTimeout(() => setI((n) => n + 1), 180);
  };

  if (!channel) {
    return (
      <Sheet title={t('sendVia')} onClose={onClose}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Btn variant="ghost" icon={MessageCircle} onClick={() => setChannel('sms')}>{t('viaSms')}</Btn>
          <Btn variant="ghost" icon={Send} onClick={() => setChannel('telegram')}>{t('viaTelegram')}</Btn>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={t('queueTitle')} onClose={onClose}>
      <div style={{ height: 6, borderRadius: 3, background: COLORS.surfaceAlt, overflow: 'hidden', marginBottom: 14 }}>
        <motion.div initial={false} animate={{ width: `${(sentIds.size / people.length) * 100}%` }} transition={{ duration: 0.3 }}
          style={{ height: '100%', background: COLORS.brand }} />
      </div>

      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Check size={30} color={COLORS.brand} style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 800, color: COLORS.textPrimary }}>{t('allDone')}</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary, fontWeight: 700, marginBottom: 8 }}>{sentIds.size + 1} {t('progressOf')} {people.length}</div>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: TYPE.lg, color: COLORS.textPrimary }}>{current.name}</div>
            <div style={{ fontSize: TYPE.sm, color: COLORS.textSecondary, marginBottom: 8 }}>{current.phone || t('phoneMissing')}</div>
            <div className="tnum" style={{ fontWeight: 800, color: COLORS.dangerText, fontSize: TYPE.lg }}>{formatNumber(info.balance)} {t('birr')}</div>
          </Card>
          <Btn big onClick={sendCurrent}>{t('sendNext')}</Btn>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        {people.map((p) => (
          <Row key={p.id} left={p.name} right={sentIds.has(p.id) ? <Check size={16} color={COLORS.brand} /> : <span style={{ color: COLORS.textTertiary }}>—</span>} />
        ))}
      </div>
    </Sheet>
  );
}

function PersonEditor({ t, person, defaultType, onClose }) {
  const addPerson = useStore((s) => s.addPerson);
  const updatePerson = useStore((s) => s.updatePerson);
  const [f, setF] = useState(person || { name: '', phone: '', type: defaultType || 'customer', limit: '', opening: '' });
  const save = () => {
    if (!f.name.trim()) return toast(t('nameNeeded'), 'error');
    if (person) updatePerson(person.id, f); else addPerson(f);
    haptic('medium'); toast(t('personSaved'));
    onClose();
  };
  return (
    <Sheet title={person ? t('editPerson') : t('addPerson')} onClose={onClose} footer={<Btn big onClick={save}>{t('save')}</Btn>}>
      {!person && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <Btn variant={f.type === 'customer' ? 'brand' : 'ghost'} onClick={() => setF({ ...f, type: 'customer' })}>{t('customers')}</Btn>
          <Btn variant={f.type === 'supplier' ? 'brand' : 'ghost'} onClick={() => setF({ ...f, type: 'supplier' })}>{t('suppliers')}</Btn>
        </div>
      )}
      <Field label={t('personName')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Field label={t('phone')} type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+251 9________" />
      <Field label={t('creditLimit')} type="number" inputMode="decimal" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} />
      {!person && <Field label={t('openingBalance')} type="number" inputMode="decimal" value={f.opening} onChange={(e) => setF({ ...f, opening: e.target.value })} />}
    </Sheet>
  );
}

function Statement({ t, calendar, lang, person, onClose, onEdit }) {
  const ledger = useStore((s) => s.ledger);
  const shop = useStore((s) => s.shop);
  const recordPayment = useStore((s) => s.recordPayment);
  const [payOpen, setPayOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const rows = ledger.filter((l) => l.personId === person.id).sort((a, b) => a.ts - b.ts);
  const info = accountInfo(ledger, person.id);

  const sendReminder = (channel) => {
    setChannelOpen(false);
    const msg = buildReminder(person, info.balance, shop, t);
    if (channel === 'telegram') { shareTelegram(msg); return; }
    if (!person.phone) return toast(t('phoneMissing'), 'error');
    shareText(msg, person.phone);
  };
  const call = () => { if (!person.phone) return toast(t('phoneMissing'), 'error'); window.location.href = `tel:${person.phone}`; };
  const kindLabel = (k, note) => (k === 'payment' ? t('paymentWord') : note === 'opening' ? t('openingWord') : note === 'purchase' ? t('purchaseWord') : t('saleWord'));

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit"
      style={{ position: 'fixed', inset: 0, zIndex: Z.page, background: COLORS.bg, display: 'flex', flexDirection: 'column' }}>
      <TopBar title={person.name} onBack={onClose} right={<button onClick={() => onEdit(person)} style={{ border: 'none', background: 'none', color: COLORS.brand, fontWeight: 700, cursor: 'pointer' }}>{t('edit')}</button>} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        <Card tone={info.balance > 0 ? (info.daysLate > 0 ? 'danger' : 'warning') : 'brand'}>
          <div style={{ fontSize: TYPE.xs, fontWeight: 700, opacity: 0.8 }}>{t('balance')}</div>
          <div className="tnum" style={{ fontSize: TYPE['3xl'], fontWeight: 800 }}>{formatNumber(info.balance)} {t('birr')}</div>
          {person.limit > 0 && <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary }}>{t('limit')} {formatNumber(person.limit)}</div>}
        </Card>
        <div style={{ marginTop: 14 }}>
          {rows.length === 0 ? <Empty text={t('noDebt')} /> : rows.map((r) => (
            <Row key={r.id} left={`${kindLabel(r.kind, r.note)} · ${formatDate(r.ts, calendar)}`}
              right={<span style={{ color: r.kind === 'payment' ? COLORS.brand : COLORS.dangerText }}>{r.kind === 'payment' ? '−' : '+'}{formatNumber(r.amount)}</span>} />
          ))}
        </div>
      </div>
      <div style={{ padding: '10px 16px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom,0px))', borderTop: `1px solid ${COLORS.border}` }}>
        <Btn big onClick={() => setPayOpen(true)} disabled={info.balance <= 0} style={{ marginBottom: 10 }}>{t('recordPayment')}</Btn>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Btn variant="ghost" onClick={() => setChannelOpen(true)} icon={MessageCircle}>{t('remind')}</Btn>
          <Btn variant="ghost" onClick={call} icon={PhoneIcon}>{t('call')}</Btn>
          <Btn variant="ghost" onClick={() => shareText(statementText(person, rows, info, t, calendar))} icon={Share2}>{t('statement')}</Btn>
        </div>
      </div>
      <AnimatePresence>
        {payOpen && <RecordPaymentSheet t={t} person={person} balance={info.balance} onClose={() => setPayOpen(false)} recordPayment={recordPayment} />}
        {channelOpen && <ChannelPickSheet t={t} onPick={sendReminder} onClose={() => setChannelOpen(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

const statementText = (person, rows, info, t, calendar) =>
  `${person.name} — ${t('statement')}\n` + rows.map((r) => `${formatDate(r.ts, calendar)}: ${r.kind === 'payment' ? '-' : '+'}${formatNumber(r.amount)}`).join('\n') +
  `\n${t('balance')}: ${formatNumber(info.balance)} ${t('birr')}`;

const buildReminder = (person, balance, shop, t) =>
  t('reminderMsg').replace('{name}', person.name).replace('{shop}', shop?.name || '').replace('{amount}', formatNumber(balance));

// Small "SMS or Telegram" chooser used by both the single and bulk reminder flows.
function ChannelPickSheet({ t, onPick, onClose }) {
  return (
    <Sheet title={t('sendVia')} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Btn variant="ghost" icon={MessageCircle} onClick={() => onPick('sms')}>{t('viaSms')}</Btn>
        <Btn variant="ghost" icon={Send} onClick={() => onPick('telegram')}>{t('viaTelegram')}</Btn>
      </div>
    </Sheet>
  );
}

function RecordPaymentSheet({ t, person, balance, onClose, recordPayment }) {
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState('cash');
  const save = () => {
    if (!Number(amount)) return toast(t('amountNeeded'), 'error');
    recordPayment({ personId: person.id, amount: Number(amount), method });
    haptic('medium'); toast(t('paySaved'));
    onClose();
  };
  return (
    <Sheet title={t('recordPayment')} onClose={onClose} footer={<Btn big onClick={save}>{t('save')}</Btn>}>
      <Card style={{ marginBottom: 12 }}><div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary }}>{person.name}</div><div className="tnum" style={{ fontWeight: 800, fontSize: TYPE.lg }}>{formatNumber(balance)} {t('birr')}</div></Card>
      <Field label={t('amountPaid')} type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Btn variant={method === 'cash' ? 'brand' : 'ghost'} onClick={() => setMethod('cash')}>{t('cash')}</Btn>
        <Btn variant={method === 'telebirr' ? 'brand' : 'ghost'} onClick={() => setMethod('telebirr')}>{t('telebirr')}</Btn>
      </div>
      <Card tone="brand"><div style={{ fontSize: TYPE.xs, color: COLORS.brand, fontWeight: 700 }}>{t('newBalance')}</div><div className="tnum" style={{ fontWeight: 800, fontSize: TYPE.lg }}>{formatNumber(Math.max(0, balance - (Number(amount) || 0)))}</div></Card>
    </Sheet>
  );
}

/* ═══════════════════════════ MORE ═══════════════════════════ */

function MoreTab({ t, go, shop }) {
  const rows = [
    ['profile', t('businessProfile'), UserCircle2, false],
    ['customers', t('customersScreen'), Users, false],
    ['expenses', t('expenses'), Wallet, false],
    ['delivery', t('delivery'), Truck, true],
    ['prices', t('prices'), TagIcon, true],
    ['staff', t('staff'), Users, true],
    ['settings', t('settings'), SettingsIcon, false],
    ['settings2', t('backupSync'), RefreshCw, false, 'settings'],
    ['help', t('help'), HelpCircle, false],
    ['feedback', t('sendFeedback'), MessageSquareHeart, false],
    ['about', t('aboutApp'), Info, false],
  ];
  const handle = (id, soon, target) => {
    if (soon) return;
    if (id === 'feedback') { shareText(`Altimate feedback — ${shop?.name || ''}: `); return; }
    go(target || id);
  };
  return (
    <Screen>
      <TopBar title={t('more')} />
      <Card style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: COLORS.brandGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: TYPE.lg, flexShrink: 0 }}>
          {(shop?.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: COLORS.textPrimary, fontSize: TYPE.md, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop?.name}</div>
          <div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary, marginTop: 2 }}>{shop?.role === 'driver' ? t('driver') : t('shopOrTrader')}{shop?.town ? ` · ${shop.town}` : ''}</div>
        </div>
      </Card>
      {rows.map(([id, label, Icon, soon, target]) => (
        <div key={id} onClick={() => handle(id, soon, target)} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '13px 2px', borderBottom: `1px solid ${COLORS.border}`,
          cursor: soon ? 'default' : 'pointer', opacity: soon ? 0.55 : 1,
        }}>
          <div style={{ width: 34, height: 34, borderRadius: RADIUS.sm, background: COLORS.brandSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={17} color={COLORS.brand} />
          </div>
          <div style={{ flex: 1, fontWeight: 600, color: COLORS.textPrimary }}>{label}</div>
          {soon ? <Tag tone="muted">{t('soon')}</Tag> : <ChevronRight size={16} color={COLORS.textSecondary} />}
        </div>
      ))}
      <div style={{ textAlign: 'center', color: COLORS.textSecondary, fontSize: TYPE.sm, fontWeight: 600, marginTop: 24 }}>{tbFallback(t)}</div>
    </Screen>
  );
}
const tbFallback = (t) => t('taglineFooter');

function BusinessProfileScreen({ t, onBack }) {
  const shop = useStore((s) => s.shop);
  const updateShop = useStore((s) => s.updateShop);
  const [f, setF] = useState({ name: shop?.name || '', town: shop?.town || '', phone: shop?.phone || '' });
  const save = () => {
    if (!f.name.trim()) return toast(t('nameNeeded'), 'error');
    updateShop({ name: f.name.trim(), town: f.town.trim(), phone: f.phone.trim() });
    haptic('medium'); toast(t('itemSaved')); onBack();
  };
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" style={{ position: 'fixed', inset: 0, zIndex: Z.page, background: COLORS.bg, overflowY: 'auto' }}>
      <TopBar title={t('businessProfile')} onBack={onBack} />
      <div style={{ padding: '0 16px 24px' }}>
        <Field label={t('shopName')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label={t('town')} value={f.town} onChange={(e) => setF({ ...f, town: e.target.value })} />
        <Field label={t('phoneNumber')} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Btn big onClick={save} style={{ marginTop: 8 }}>{t('save')}</Btn>
      </div>
    </motion.div>
  );
}

function AboutScreen({ t, onBack }) {
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" style={{ position: 'fixed', inset: 0, zIndex: Z.page, background: COLORS.bg, overflowY: 'auto' }}>
      <TopBar title={t('aboutApp')} onBack={onBack} />
      <div style={{ padding: '0 16px 24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: COLORS.brandGradient, margin: '20px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={30} color="#fff" />
        </div>
        <div style={{ fontWeight: 800, fontSize: TYPE.xl, color: COLORS.textPrimary }}>{t('appName')}</div>
        <div style={{ color: COLORS.textSecondary, marginTop: 6, marginBottom: 20 }}>{t('tagline')}</div>
        <Card style={{ textAlign: 'left' }}>
          <Row left={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={15} />{t('secureReliable')}</span>} right="v1.0" />
          <Row left={t('builtForEthiopia')} right="🇪🇹" />
        </Card>
        <div style={{ color: COLORS.textSecondary, fontSize: TYPE.sm, fontWeight: 600, marginTop: 24 }}>{t('taglineFooter')}</div>
      </div>
    </motion.div>
  );
}

// Simple, honest inline SVG bar chart — no chart library, real numbers only.
function BarChart({ labels, values, height = 140 }) {
  const max = Math.max(1, ...values);
  const w = 320, barW = w / (values.length * 2);
  return (
    <svg viewBox={`0 0 ${w} ${height + 20}`} width="100%" style={{ overflow: 'visible' }}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        const x = i * (barW * 2) + barW * 0.5;
        return (
          <g key={i}>
            <rect x={x} y={height - h} width={barW} height={h} rx={5} fill={COLORS.brand} opacity={i === values.length - 1 ? 1 : 0.55} />
            <text x={x + barW / 2} y={height + 15} fontSize="9" textAnchor="middle" fill={COLORS.textSecondary}>{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Real donut chart from category totals — stroke-dasharray segments.
function DonutChart({ segments, size = 140 }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2 - 14, c = 2 * Math.PI * r, cx = size / 2, cy = size / 2;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.surfaceAlt} strokeWidth={20} />
      {segments.map((s, i) => {
        const frac = s.value / total;
        const dash = frac * c;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={20}
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy + 5} fontSize="13" fontWeight="800" textAnchor="middle" fill={COLORS.textPrimary}>{formatNumber(total)}</text>
    </svg>
  );
}

const CAT_COLORS = { rent: '#2E6BE8', electricity: '#E8B531', salary: '#0E7A55', transport: '#E8821E', other: '#9B59B6' };

function ReportsTab({ t, calendar }) {
  const sales = useStore((s) => s.sales);
  const expenses = useStore((s) => s.expenses);
  const [range, setRange] = useState('month');
  const from = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (range === 'today') return d.getTime();
    if (range === 'week') return d.getTime() - 6 * DAY_MS;
    d.setDate(1); return d.getTime();
  }, [range]);
  const totals = periodTotals(sales, expenses, from);
  const best = bestSellers(totals.sales, 3);

  // Last 5 calendar months trend, computed straight from real sales.
  const trend = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime() - 1;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const tot = periodTotals(sales, expenses, start, end);
      buckets.push({ label, value: tot.salesTotal });
    }
    return buckets;
  }, [sales, expenses]);

  const catTotals = useMemo(() => {
    const map = {};
    expenses.forEach((e) => { map[e.cat] = (map[e.cat] || 0) + e.amount; });
    return Object.entries(map).map(([cat, value]) => ({ cat, value, color: CAT_COLORS[cat] || '#9B59B6' }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);
  const catTotalSum = catTotals.reduce((a, c) => a + c.value, 0) || 1;
  const catLabel = { rent: t('rent'), electricity: t('electricity'), salary: t('salary'), transport: t('transport'), other: t('other') };

  return (
    <Screen>
      <TopBar title={t('reports')} right={
        <button onClick={() => shareText(`${t('reports')} (${t(range)})\n${t('sales')}: ${formatNumber(totals.salesTotal)}\n${t('profit')}: ${formatNumber(totals.profit)}`)} style={iconBtn}>
          <Share2 size={17} color={COLORS.brand} />
        </button>
      } />
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['today', t('today')], ['week', t('week')], ['month', t('month')]].map(([id, l]) => (
          <button key={id} onClick={() => setRange(id)} style={{ border: 'none', borderRadius: RADIUS.pill, padding: '6px 14px', fontWeight: 700, fontSize: TYPE.sm, cursor: 'pointer', background: range === id ? COLORS.brand : COLORS.surfaceAlt, color: range === id ? '#fff' : COLORS.textSecondary }}>{l}</button>
        ))}
      </div>

      <Card tone="brand" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: TYPE.xs, color: COLORS.brand, fontWeight: 700 }}>{t('sales')}</div>
          <Tag tone="brand">▲ {totals.salesTotal > 0 ? Math.round((totals.profit / totals.salesTotal) * 100) : 0}%</Tag>
        </div>
        <div className="tnum" style={{ fontSize: TYPE['3xl'], fontWeight: 800, color: COLORS.textPrimary }}>{formatNumber(totals.salesTotal)} {t('birr')}</div>
      </Card>

      <Card style={{ marginBottom: 10 }}>
        <BarChart labels={trend.map((b) => b.label)} values={trend.map((b) => b.value)} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Card><div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary, fontWeight: 700 }}>{t('expenses')}</div><div className="tnum" style={{ fontSize: TYPE.xl, fontWeight: 800 }}>{formatNumber(totals.expTotal)}</div></Card>
        <Card><div style={{ fontSize: TYPE.xs, color: COLORS.textSecondary, fontWeight: 700 }}>{t('profit')}</div><div className="tnum" style={{ fontSize: TYPE.xl, fontWeight: 800, color: COLORS.brand }}>{formatNumber(totals.profit)}</div></Card>
      </div>

      <div style={{ fontWeight: 800, marginBottom: 8 }}>{t('expenseByCategory')}</div>
      {catTotals.length === 0 ? <Empty text={t('noExpenses')} icon={Wallet} /> : (
        <Card style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <DonutChart segments={catTotals} />
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            {catTotals.map((c) => (
              <div key={c.cat} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: TYPE.xs }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: COLORS.textPrimary, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{catLabel[c.cat] || c.cat}</span>
                <span style={{ fontWeight: 800, color: COLORS.textSecondary }}>{Math.round((c.value / catTotalSum) * 100)}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ fontWeight: 800, marginBottom: 4 }}>{t('bestSellers')}</div>
      {best.length === 0 ? <Empty text={t('noSalesYet')} /> : best.map((b) => <Row key={b.name} left={b.name} right={b.qty} />)}
    </Screen>
  );
}

function ExpensesScreen({ t, calendar, onBack, autoOpen }) {
  const expenses = useStore((s) => s.expenses).slice().reverse();
  const addExpense = useStore((s) => s.addExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const [open, setOpen] = useState(!!autoOpen);
  const [cat, setCat] = useState('rent');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const cats = [['rent', t('rent')], ['electricity', t('electricity')], ['salary', t('salary')], ['transport', t('transport')], ['other', t('other')]];
  const save = () => {
    if (!Number(amount)) return toast(t('amountNeeded'), 'error');
    addExpense({ cat, amount, note }); haptic('medium'); setOpen(false); setAmount(''); setNote('');
  };
  const remove = async (id) => { if (await askConfirm(t('deleteQ'))) deleteExpense(id); };
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" style={{ position: 'fixed', inset: 0, zIndex: Z.page, background: COLORS.bg, overflowY: 'auto' }}>
      <TopBar title={t('expenses')} onBack={onBack} right={<button onClick={() => setOpen(true)} style={iconBtn}><Plus size={18} color={COLORS.brand} /></button>} />
      <div style={{ padding: '0 16px 24px' }}>
        {expenses.length === 0 ? <Empty text={t('noExpenses')} icon={Wallet} /> : expenses.map((e) => (
          <Row key={e.id} left={cats.find((c) => c[0] === e.cat)?.[1] + (e.note ? ` · ${e.note}` : '')} sub={formatDate(e.ts, calendar)}
            right={<span onClick={() => remove(e.id)} style={{ color: COLORS.dangerText }}>{formatNumber(e.amount)}</span>} />
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <Sheet title={t('addExpense')} onClose={() => setOpen(false)} footer={<Btn big onClick={save}>{t('save')}</Btn>}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {cats.map(([id, l]) => (
                <button key={id} onClick={() => setCat(id)} style={{ border: 'none', borderRadius: RADIUS.pill, padding: '7px 14px', fontWeight: 700, fontSize: TYPE.sm, cursor: 'pointer', background: cat === id ? COLORS.brand : COLORS.surfaceAlt, color: cat === id ? '#fff' : COLORS.textSecondary }}>{l}</button>
              ))}
            </div>
            <Field label={t('amount')} type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Field label={t('note')} value={note} onChange={(e) => setNote(e.target.value)} />
          </Sheet>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CompanySyncPanel({ t }) {
  const companyToken = useStore((s) => s.companyToken);
  const syncStatus = useStore((s) => s.syncStatus);
  const lastSyncAt = useStore((s) => s.lastSyncAt);
  const lastSyncError = useStore((s) => s.lastSyncError);
  const disconnectCompany = useStore((s) => s.disconnectCompany);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const statusLabel = {
    disconnected: t('syncNotConnected'),
    syncing: t('syncing'),
    synced: t('syncedJustNow'),
    error: t('syncError'),
  }[syncStatus] || t('syncNotConnected');

  const statusColor = {
    disconnected: COLORS.textSecondary,
    syncing: COLORS.textSecondary,
    synced: COLORS.brand,
    error: COLORS.dangerText,
  }[syncStatus] || COLORS.textSecondary;

  const doConnect = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setBusy(true);
    const res = await connectAndPush(trimmed);
    setBusy(false);
    if (res.ok) { toast(t('syncedJustNow'), 'ok'); setCode(''); }
    else toast(t('syncError'), 'error');
  };

  const doDisconnect = async () => {
    if (await askConfirm(t('disconnectQ'))) disconnectCompany();
  };

  const doSyncNow = async () => {
    setBusy(true);
    const res = await pushNow();
    setBusy(false);
    toast(res.ok ? t('syncedJustNow') : t('syncError'), res.ok ? 'ok' : 'error');
  };

  if (companyToken) {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>{t('syncConnected')}</div>
            <div style={{ fontSize: TYPE.sm, color: statusColor, marginTop: 2 }}>
              {statusLabel}{syncStatus === 'error' && lastSyncError ? ` — ${lastSyncError}` : ''}
              {syncStatus === 'synced' && lastSyncAt ? ` · ${new Date(lastSyncAt).toLocaleTimeString()}` : ''}
            </div>
          </div>
          <button disabled={busy} onClick={doSyncNow} style={{ border: 'none', background: 'none', color: COLORS.brand, fontWeight: 700, cursor: 'pointer', fontSize: TYPE.sm }}>
            {t('syncNow')}
          </button>
        </div>
        <button onClick={doDisconnect} style={{ border: 'none', background: 'none', color: COLORS.dangerText, fontWeight: 700, cursor: 'pointer', fontSize: TYPE.sm, marginTop: 10, padding: 0 }}>
          {t('disconnect')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10 }}>
      <div style={{ fontSize: TYPE.sm, color: COLORS.textSecondary, marginBottom: 10 }}>{t('companySyncHelp')}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('shopCodePlaceholder')}
          style={{ flex: 1, border: `1.5px solid ${COLORS.border}`, borderRadius: RADIUS.sm, padding: '10px 12px', fontSize: TYPE.sm, background: COLORS.surfaceAlt, color: COLORS.textPrimary }} />
        <Btn disabled={busy || !code.trim()} onClick={doConnect} style={{ width: 'auto', padding: '0 18px' }}>{t('connect')}</Btn>
      </div>
    </div>
  );
}

function SettingsScreen({ t, lang, setLang, calendar, setCalendar, theme, setTheme, onBack }) {
  const shop = useStore((s) => s.shop);
  const updateShop = useStore((s) => s.updateShop);
  const pinHash = useStore((s) => s.pinHash);
  const setPinHash = useStore((s) => s.setPinHash);
  const exportData = useStore((s) => s.exportData);
  const importData = useStore((s) => s.importData);
  const resetAll = useStore((s) => s.resetAll);
  const fileRef = useRef(null);
  const [pinFlow, setPinFlow] = useState(null); // 'set' | 'remove'
  const [newPin, setNewPin] = useState('');

  const doExport = () => { downloadFile(`gebeya-link-backup-${Date.now()}.json`, exportData()); toast(t('backup')); };
  const doImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { toast(importData(reader.result) ? t('restoreOk') : t('restoreBad'), importData ? 'ok' : 'error'); };
    reader.readAsText(file);
    e.target.value = '';
  };
  const doReset = async () => { if (await askConfirm(t('resetQ'))) { resetAll(); window.location.reload(); } };
  const finishPin = async (v) => {
    if (v.length !== 4) return;
    setPinHash(await hashPin(v)); toast(t('done')); setPinFlow(null); setNewPin('');
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" style={{ position: 'fixed', inset: 0, zIndex: Z.page, background: COLORS.bg, overflowY: 'auto' }}>
      <TopBar title={t('settings')} onBack={onBack} />
      <div style={{ padding: '0 16px 32px' }}>
        <div style={{ fontWeight: 800, color: COLORS.textSecondary, fontSize: TYPE.xs, margin: '12px 0 6px' }}>{t('shop')}</div>
        <Field label={t('shopName')} value={shop?.name || ''} onChange={(e) => updateShop({ name: e.target.value })} />
        <Field label={t('town')} value={shop?.town || ''} onChange={(e) => updateShop({ town: e.target.value })} />

        <div style={{ fontWeight: 800, color: COLORS.textSecondary, fontSize: TYPE.xs, margin: '18px 0 6px' }}>{t('language')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Btn variant={lang === 'am' ? 'brand' : 'ghost'} onClick={() => setLang('am')}>አማርኛ</Btn>
          <Btn variant={lang === 'en' ? 'brand' : 'ghost'} onClick={() => setLang('en')}>English</Btn>
        </div>

        <div style={{ fontWeight: 800, color: COLORS.textSecondary, fontSize: TYPE.xs, margin: '18px 0 6px' }}>{t('calendar')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Btn variant={calendar === 'et' ? 'brand' : 'ghost'} onClick={() => setCalendar('et')}>{t('ethiopian')}</Btn>
          <Btn variant={calendar === 'gc' ? 'brand' : 'ghost'} onClick={() => setCalendar('gc')}>{t('gregorian')}</Btn>
        </div>

        <Row left={t('darkMode')} right={<button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={switchStyle(theme === 'dark')}><span style={switchDot(theme === 'dark')} /></button>} />
        <Row left={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={14} />{t('pinLock')}</span>} sub={pinHash ? t('pinOn') : t('pinOff')}
          right={pinHash
            ? <button onClick={() => setPinHash(null)} style={{ border: 'none', background: 'none', color: COLORS.dangerText, fontWeight: 700, cursor: 'pointer' }}>{t('removePin')}</button>
            : <button onClick={() => setPinFlow('set')} style={{ border: 'none', background: 'none', color: COLORS.brand, fontWeight: 700, cursor: 'pointer' }}>{t('setPin')}</button>} />

        <div style={{ fontWeight: 800, color: COLORS.textSecondary, fontSize: TYPE.xs, margin: '18px 0 6px' }}>{t('companySync')}</div>
        <CompanySyncPanel t={t} />

        <div style={{ fontWeight: 800, color: COLORS.textSecondary, fontSize: TYPE.xs, margin: '18px 0 6px' }}>{t('backup')}</div>
        <div style={{ color: COLORS.textSecondary, fontSize: TYPE.sm, marginBottom: 10 }}>{t('dataOnPhone')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <Btn variant="ghost" icon={Download} onClick={doExport}>{t('backupNow')}</Btn>
          <Btn variant="ghost" icon={Upload} onClick={() => fileRef.current?.click()}>{t('restore')}</Btn>
          <input ref={fileRef} type="file" accept="application/json" onChange={doImport} style={{ display: 'none' }} />
        </div>

        <Btn variant="danger" icon={Trash2} onClick={doReset}>{t('resetAll')}</Btn>
      </div>
      <AnimatePresence>
        {pinFlow && (
          <Sheet title={t('createPin')} onClose={() => setPinFlow(null)}>
            <div style={{ padding: '10px 0 20px', display: 'flex', justifyContent: 'center' }}>
              <PinDots value={newPin} onChange={(v) => { setNewPin(v); finishPin(v); }} />
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const switchStyle = (on) => ({ width: 42, height: 24, borderRadius: 12, border: 'none', background: on ? COLORS.brand : COLORS.border, position: 'relative', cursor: 'pointer', padding: 0 });
const switchDot = (on) => ({ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s ease', display: 'block' });

function HelpScreen({ t, onBack }) {
  const items = [[t('help1'), t('help1t')], [t('help2'), t('help2t')], [t('help3'), t('help3t')]];
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" style={{ position: 'fixed', inset: 0, zIndex: Z.page, background: COLORS.bg, overflowY: 'auto' }}>
      <TopBar title={t('help')} onBack={onBack} />
      <div style={{ padding: '0 16px 24px' }}>
        {items.map(([title, body], i) => (
          <Card key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: COLORS.textPrimary, marginBottom: 4 }}>{title}</div>
            <div style={{ color: COLORS.textSecondary, fontSize: TYPE.sm, lineHeight: 1.5 }}>{body}</div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════ ROOT APP ═══════════════════════════ */

export default function GebeyaLinkApp() {
  const shop = useStore((s) => s.shop);
  const pinHash = useStore((s) => s.pinHash);
  const lang = useStore((s) => s.lang);
  const calendar = useStore((s) => s.calendar);
  const setLang = useStore((s) => s.setLang);
  const setCalendar = useStore((s) => s.setCalendar);

  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [theme, setThemeState] = useState('light');
  const [tab, setTabRaw] = useState('home');
  const [sub, setSub] = useState(null); // { screen, ...params }
  const [stockFilter, setStockFilter] = useState('all');
  const [bookFilter, setBookFilter] = useState('customer');

  useEffect(() => {
    setReady(true);
    const stored = getStoredTheme();
    setThemeState(stored); applyTheme(stored);
    return subscribeTheme(setThemeState);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang || 'am';
  }, [lang]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useBackgroundSync();

  const setTheme = (v) => { applyTheme(v); };
  const { t, tb } = makeT(lang);

  const setTab_ = (id) => { setTabRaw(id); setSub(null); };

  if (!ready) return null;

  if (!shop) return <><Onboarding onDone={(l) => setLang(l)} /><ToastHost /></>;
  if (pinHash && !unlocked) return <LockScreen pinHash={pinHash} shopName={shop.name} onUnlock={() => setUnlocked(true)} />;

  const go = (screen, params = {}) => setSub({ screen, ...params });
  const closeSub = () => setSub(null);

  return (
    <div style={{ minHeight: '100dvh', background: COLORS.bg, position: 'relative', overflowX: 'hidden' }}>
      <div className="no-scrollbar" style={{ minHeight: '100dvh' }}>
        {tab === 'home' && (
          <Home t={t} tb={tb} lang={lang} calendar={calendar}
            openSell={() => go('sell')} openBuy={() => go('buy')} go={go}
            setTab={setTab_} setStockFilter={(f) => { setStockFilter(f); }} setBookFilter={(f) => setBookFilter(f === 'customers' ? 'customer' : f)} />
        )}
        {tab === 'sales' && (
          <SalesTab t={t} calendar={calendar} openSell={() => go('sell')} />
        )}
        {tab === 'stock' && (
          <StockTab t={t} filter={stockFilter} setFilter={setStockFilter}
            openAddItem={() => go('item')} openEditItem={(item) => go('item', { item })} openCount={() => go('count')} openBuy={() => go('buy')} />
        )}
        {tab === 'reports' && (
          <ReportsTab t={t} calendar={calendar} />
        )}
        {tab === 'more' && !sub && <MoreTab t={t} go={go} shop={shop} />}
      </div>

      <TabBar tab={tab} setTab={setTab_} t={t} />

      <AnimatePresence>
        {sub?.screen === 'sell' && <SellFlow key="sell" t={t} onClose={closeSub} />}
        {sub?.screen === 'buy' && <BuyFlow key="buy" t={t} onClose={closeSub} />}
        {sub?.screen === 'item' && <ItemEditor key="item" t={t} item={sub.item} onClose={closeSub} />}
        {sub?.screen === 'count' && <StockCount key="count" t={t} onClose={closeSub} />}
        {sub?.screen === 'person' && <PersonEditor key="person" t={t} person={sub.person} defaultType={sub.defaultType} onClose={closeSub} />}
        {sub?.screen === 'statement' && <Statement key="statement" t={t} calendar={calendar} lang={lang} person={sub.person} onClose={closeSub} onEdit={(p) => go('person', { person: p })} />}
        {sub?.screen === 'customers' && (
          <motion.div key="customers" variants={pageVariants} initial="hidden" animate="visible" exit="exit" style={{ position: 'fixed', inset: 0, zIndex: Z.page, background: COLORS.bg, overflowY: 'auto' }}>
            <BookTab t={t} calendar={calendar} filter={bookFilter} setFilter={setBookFilter} onBack={closeSub}
              openStatement={(person) => go('statement', { person })} openAddPerson={() => go('person', { defaultType: bookFilter })} />
          </motion.div>
        )}
        {sub?.screen === 'expenses' && <ExpensesScreen key="expenses" t={t} calendar={calendar} onBack={closeSub} autoOpen={sub.openAdd} />}
        {sub?.screen === 'settings' && <SettingsScreen key="settings" t={t} lang={lang} setLang={setLang} calendar={calendar} setCalendar={setCalendar} theme={theme} setTheme={setTheme} onBack={closeSub} />}
        {sub?.screen === 'profile' && <BusinessProfileScreen key="profile" t={t} onBack={closeSub} />}
        {sub?.screen === 'about' && <AboutScreen key="about" t={t} onBack={closeSub} />}
        {sub?.screen === 'help' && <HelpScreen key="help" t={t} onBack={closeSub} />}
      </AnimatePresence>

      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
