// Exam calculator: a plain four-function state machine. No eval, no Function().
// state = { cur: shown number as text, acc: stored left operand, op: pending operator, fresh: next digit starts a new number, line: small history line }

export const OPS = ['+', '−', '×', '÷'];
export const initialCalc = () => ({cur: '0', acc: null, op: null, fresh: true, line: ''});

const fmt = (n) => {
  if (!Number.isFinite(n)) return 'Error';
  const s = String(parseFloat(n.toPrecision(12)));
  return s.includes('e') ? n.toExponential(6) : s;
};
const run = (a, op, b) => (op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : op === '÷' ? (b === 0 ? NaN : a / b) : b);

export function pressCalc(state, key) {
  let s = state;
  if (s.cur === 'Error') { if (key === 'C') return initialCalc(); s = initialCalc(); }

  if (/^[0-9]$/.test(key)) {
    if (!s.fresh && s.cur.replace(/[-.]/g, '').length >= 15) return s;
    const line = s.op === null && s.fresh ? '' : s.line;
    return {...s, cur: s.fresh || s.cur === '0' ? key : s.cur + key, fresh: false, line};
  }
  if (key === '.') {
    if (s.fresh) return {...s, cur: '0.', fresh: false, line: s.op === null ? '' : s.line};
    return s.cur.includes('.') ? s : {...s, cur: s.cur + '.'};
  }
  if (OPS.includes(key)) {
    if (s.op !== null && s.fresh) return {...s, op: key, line: fmt(s.acc) + ' ' + key};
    const acc = s.op !== null ? run(s.acc, s.op, parseFloat(s.cur)) : parseFloat(s.cur);
    return {cur: fmt(acc), acc: Number.isFinite(acc) ? acc : null, op: Number.isFinite(acc) ? key : null, fresh: true, line: Number.isFinite(acc) ? fmt(acc) + ' ' + key : ''};
  }
  if (key === '=') {
    if (s.op === null) return s;
    const b = parseFloat(s.cur), r = run(s.acc, s.op, b);
    return {cur: fmt(r), acc: null, op: null, fresh: true, line: fmt(s.acc) + ' ' + s.op + ' ' + fmt(b) + ' ='};
  }
  if (key === 'C') return initialCalc();
  if (key === '⌫') {
    if (s.fresh) return s;
    const c = s.cur.slice(0, -1);
    return {...s, cur: c === '' || c === '-' ? '0' : c};
  }
  if (key === '±') return s.cur === '0' ? s : {...s, cur: s.cur[0] === '-' ? s.cur.slice(1) : '-' + s.cur};
  if (key === '%') return {...s, cur: fmt(parseFloat(s.cur) / 100), fresh: true};
  return s;
}

// Map a keyboard event key to a calculator key (or '' when it is not one of ours).
export function calcKeyFrom(k) {
  if (/^[0-9]$/.test(k)) return k;
  return ({'+': '+', '-': '−', '*': '×', x: '×', X: '×', '/': '÷', '.': '.', ',': '.', '=': '=', Enter: '=', Backspace: '⌫', Delete: 'C', c: 'C', C: 'C', '%': '%'})[k] || '';
}
