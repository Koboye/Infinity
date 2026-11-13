// "Smart explanation": the key idea first, why your pick is wrong (using the explanation's own sentence about it), then the details.
const LETTERS = ['A', 'B', 'C', 'D'];
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export const sentences = (t) => String(t || '').replace(/\s+/g, ' ').match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((x) => x.trim()).filter(Boolean) || [];

export default function Explain({ q, chosen }) {
  const s = sentences(q.explanation), key = s[0] || q.explanation, rest = s.slice(1);
  const right = chosen === q.answer, wrongOpt = !right && chosen != null ? q.options[chosen] : null;
  const wn = wrongOpt ? norm(wrongOpt) : '', why = wrongOpt && wn.length >= 4 ? rest.find((x) => norm(x).includes(wn)) : null;
  const more = rest.filter((x) => x !== why);
  return (
    <div className="explain pop">
      <div className={`verdict ${right ? 'ok' : chosen == null ? '' : 'err'}`}>{right ? '✅ Correct!' : chosen == null ? '⏭ Skipped' : '❌ Not quite'} <span>Answer: <b>{LETTERS[q.answer]}. {q.options[q.answer]}</b></span></div>
      <div className="ex-block"><small>💡 KEY IDEA</small><p>{key}</p></div>
      {wrongOpt && <div className="ex-block warn"><small>🔍 WHY NOT {LETTERS[chosen]}?</small><p>{why || `You chose “${wrongOpt}”. It looks close, but it is not what the question asks: re-read the key idea and compare it with the correct option.`}</p></div>}
      {more.length > 0 && <details className="ex-more"><summary>Read the full explanation</summary><p>{more.join(' ')}</p></details>}
    </div>
  );
}
