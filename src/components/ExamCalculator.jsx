'use client';
import {useEffect, useReducer, useRef, useState} from 'react';
import {Svg} from './HomeScreen';
import {initialCalc, pressCalc, calcKeyFrom} from '@/lib/calc';

// Five columns keep the pad short, so it can dock under the exam on a phone without hiding the question.
const KEYS = ['7', '8', '9', '÷', 'C', '4', '5', '6', '×', '⌫', '1', '2', '3', '−', '%', '0', '.', '±', '+', '='];
const KIND = (k) => (k === '=' ? 'eq' : '÷×−+'.includes(k) ? 'op' : ['C', '⌫', '%', '±'].includes(k) ? 'fn' : 'num');
const ICON = {
  calc: <><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" /></>,
  down: <path d="m6 9 6 6 6-6" />, up: <path d="m6 15 6-6 6 6" />, x: <path d="M6 6l12 12M18 6L6 18" />,
};
export {ICON as CALC_ICON};

export default function ExamCalculator({t, onClose}) {
  const [s, press] = useReducer(pressCalc, undefined, initialCalc);
  const [min, setMin] = useState(false);
  const root = useRef(null);

  useEffect(() => { root.current?.focus({preventScroll: true}); }, []);

  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { e.preventDefault(); return onClose(); }
    const k = calcKeyFrom(e.key);
    if (!k) return;
    // Buttons turn Enter into a click; let the key pad handle it so '=' is not pressed twice.
    if (e.key === 'Enter' && e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    press(k);
  };

  return (
    <aside className={'inf-x-calc' + (min ? ' is-min' : '')} ref={root} tabIndex={-1} role="group" aria-label={t('calculator')} onKeyDown={onKey}>
      <div className="inf-x-calc-top">
        <span className="inf-x-calc-ttl"><Svg size={20}>{ICON.calc}</Svg>{t('calculator')}</span>
        <button type="button" className="inf-x-calc-ib" onClick={() => setMin((v) => !v)} aria-expanded={!min} aria-label={min ? t('calcExpand') : t('calcMinimise')}><Svg size={18}>{min ? ICON.up : ICON.down}</Svg></button>
        <button type="button" className="inf-x-calc-ib" onClick={onClose} aria-label={t('close')}><Svg size={18}>{ICON.x}</Svg></button>
      </div>
      <div className="inf-x-calc-scr" role="status" aria-live="polite">
        <small>{s.line || '\u00A0'}</small>
        <output>{s.cur}</output>
      </div>
      {!min && (
        <div className="inf-x-calc-pad">
          {KEYS.map((k) => (
            <button type="button" key={k} data-k={KIND(k)} aria-label={k === '⌫' ? t('calcDelete') : k === 'C' ? t('calcClear') : k === '−' ? '−' : undefined} onClick={() => press(k)}>{k}</button>
          ))}
        </div>
      )}
    </aside>
  );
}
