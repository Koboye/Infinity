'use client';
import { useState } from 'react';

// Local-only arithmetic helper. Never uses eval or external services.
function calculate(expression) {
  const tokens = expression.replace(/\s/g, '').match(/(?:\d+(?:\.\d*)?|\.\d+)|[+\-*/()]/g);
  if (!tokens || tokens.join('') !== expression.replace(/\s/g, '')) return 'Error';
  let i = 0;
  function atom() {
    const t = tokens[i++];
    if (t === '-') return -atom();
    if (t === '+') return atom();
    if (t === '(') {
      const v = sum();
      if (tokens[i++] !== ')') throw Error('parenthesis');
      return v;
    }
    if (t == null || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t)) throw Error('number');
    return Number(t);
  }
  function product() {
    let v = atom();
    while (tokens[i] === '*' || tokens[i] === '/') {
      const op = tokens[i++];
      const n = atom();
      v = op === '*' ? v * n : v / n;
    }
    return v;
  }
  function sum() {
    let v = product();
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++];
      const n = product();
      v = op === '+' ? v + n : v - n;
    }
    return v;
  }
  try {
    const v = sum();
    if (i !== tokens.length || !Number.isFinite(v)) return 'Error';
    return String(Number(v.toPrecision(12)));
  } catch { return 'Error'; }
}

export default function ExamCalculator() {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState('');
  const press = (key) => {
    if (key === 'C') return setExpression('');
    if (key === '⌫') return setExpression((s) => s.slice(0, -1));
    if (key === '=') return setExpression((s) => calculate(s));
    setExpression((s) => (s === 'Error' ? '' : s).concat(key).slice(0, 70));
  };
  const keys = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '.', '+', '(', ')', '⌫', '='];
  return (
    <div className="exam-calc">
      {open && <section className="exam-calc-panel" role="dialog" aria-modal="false" aria-label="Exam calculator">
        <div className="exam-calc-head"><strong>Calculator</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close calculator">×</button></div>
        <output className="exam-calc-display" aria-live="polite">{expression || '0'}</output>
        <div className="exam-calc-keys">{keys.map((key) => <button type="button" key={key} onClick={() => press(key)} aria-label={key === '⌫' ? 'Backspace' : key === 'C' ? 'Clear' : key}>{key}</button>)}</div>
      </section>}
      <button type="button" className="exam-calc-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Hide calculator' : 'Open calculator'}>⌗ <span>Calculator</span></button>
    </div>
  );
}
