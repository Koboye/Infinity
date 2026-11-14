'use client';
import {Fragment, useId, useRef, useState} from 'react';

export const GRADES = [
  {id: 'kg1', name: 'KG 1'},
  {id: 'kg2', name: 'KG 2'},
  {id: 'kg3', name: 'KG 3'},
  ...Array.from({length: 12}, (_, i) => ({id: 'g' + (i + 1), name: 'Grade ' + (i + 1)})),
  {id: 'uni', name: 'University / College'},
  {id: 'ngat', name: 'NGAT'},
];
const isG = (g) => /^g\d+$/.test(g.id);
const groupOf = (g) => /^kg/.test(g.id) ? 'KG' : isG(g) ? (Number(g.id.slice(1)) <= 6 ? 'Primary' : Number(g.id.slice(1)) <= 9 ? 'Preparatory' : 'Secondary') : g.id === 'uni' ? 'University' : 'NGAT';
const tileLabel = (g) => isG(g) ? 'G' + g.id.slice(1) : g.id.toUpperCase();
const TILE_ICON = {kg1: '🧸', kg2: '🧱', kg3: '🚀', g1: '✏️', g2: '📖', g3: '🎒', g4: '🧪', g5: '🌍', g6: '🏆', g7: '⚛️', g8: '🧮', g9: '🧬', g10: '📊', g11: '💻', g12: '🏅'};
const TILE_SUB = {kg1: 'Pre-K', kg2: 'Kindergarten', kg3: 'Advanced KG'};

/* The Infinity mark: a lemniscate on a sun-yellow tile. */
export function Mark({size = 40, live = false}) {
  return (
    <svg className={'inf-mark' + (live ? ' is-live' : '')} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Infinity">
      <defs>
        <linearGradient id="inf-mark-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFDB6B" /><stop offset="1" stopColor="#FFB800" /></linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#inf-mark-g)" />
      <path
        pathLength="100"
        d="M24 24c-3.500-4.500-6.500-7-10-7a7 7 0 000 14c3.500 0 6.500-2.500 10-7s6.500-7 10-7a7 7 0 010 14c-3.500 0-6.500-2.500-10-7z"
        fill="none" stroke="var(--inf-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS = {
  home: 'M4 11.500 12 5l8 6.500V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z',
  subjects: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11',
  games: 'M7 8h10a4 4 0 014 4v1a3 3 0 01-5.500 1.600L14.500 14h-5l-1 .600A3 3 0 013 13v-1a4 4 0 014-4zM8 11v3M6.500 12.500h3M16 11.500h.01M18 13h.01',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.500 20a7.500 7.500 0 0115 0',
};
export function NavIcon({id}) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[id]} />
    </svg>
  );
}

/* Level picker: School / University / NGAT tabs. School is one swipeable rail of grouped panels.
   Tap a tile, it centres, pops and buzzes. Works on the auth screen and in the app. */
const STAGES = [
  {key: 'KG', title: 'Kindergarten', sub: 'Early learning & discovery', icon: '🌱', tone: 'kg'},
  {key: 'Primary', title: 'Primary', sub: 'Grades 1–6 · Build core skills', icon: '📖', tone: 'pri'},
  {key: 'Preparatory', title: 'Preparatory', sub: 'Grades 7–9 · Go deeper & prepare', icon: '📚', tone: 'prep'},
  {key: 'Secondary', title: 'Secondary', sub: 'Grades 10–12 · Specialize & excel', icon: '🎓', tone: 'sec'},
];
const TABS = [
  {id: 'school', label: 'School', icon: '🏫'},
  {id: 'uni', label: 'University', icon: '🏛️'},
  {id: 'ngat', label: 'NGAT', icon: '🎯'},
];
const SOLO = {
  uni: {icon: '🎓', title: 'University', sub: 'College · you pick your department next'},
  ngat: {icon: '🎯', title: 'NGAT', sub: 'National exam preparation'},
};
const SCHOOL = GRADES.filter((g) => /^(kg|g\d)/.test(g.id));

export function GradePicker({grade, onChange}) {
  const track = useRef(null);
  const [tabState, setTab] = useState(grade === 'uni' || grade === 'ngat' ? grade : 'school');
  const tab = grade === 'uni' || grade === 'ngat' ? grade : tabState;
  const find = (id) => track.current?.querySelector('[data-id="' + id + '"]');
  const reveal = (id) => find(id)?.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'});
  const buzz = () => { try { navigator.vibrate?.(12); } catch {} };
  const pick = (id) => { onChange(id); reveal(id); buzz(); };
  const scroll = (dir) => track.current?.scrollBy({left: dir * 260, behavior: 'smooth'});
  const goTab = (t) => {
    setTab(t);
    if (t === 'school') { if (grade === 'uni' || grade === 'ngat') onChange(''); }
    else { onChange(t); buzz(); }
  };
  const step = (e) => {
    const i = SCHOOL.findIndex((g) => g.id === grade);
    const next = e.key === 'ArrowRight' ? Math.min(SCHOOL.length - 1, i + 1) : e.key === 'ArrowLeft' ? Math.max(0, i - 1) : -1;
    if (next < 0) return;
    e.preventDefault();
    pick(SCHOOL[next].id);
    find(SCHOOL[next].id)?.focus();
  };
  const solo = SOLO[tab];
  return (
    <div className="inf-picker">
      <div className="inf-tabs" role="tablist" aria-label="Education stage">
        {TABS.map((t) => (
          <button type="button" role="tab" key={t.id} aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => goTab(t.id)}>
            <span aria-hidden="true">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === 'school' ? (
        <>
          <div className="inf-grade" role="radiogroup" aria-label="Grade">
            <button type="button" className="inf-grade-arrow" aria-label="Previous grades" onClick={() => scroll(-1)}>‹</button>
            <div className="inf-rail" ref={track} onKeyDown={step}>
              {STAGES.map((st) => (
                <div className="inf-pane" data-tone={st.tone} key={st.key}>
                  <div className="inf-pane-head">
                    <span className="inf-pane-ico" aria-hidden="true">{st.icon}</span>
                    <span><b>{st.title}</b><small>{st.sub}</small></span>
                  </div>
                  <div className="inf-tl-row">
                    {SCHOOL.filter((g) => groupOf(g) === st.key).map((g) => (
                      <button
                        type="button" role="radio" key={g.id} data-id={g.id} aria-checked={grade === g.id} aria-pressed={grade === g.id}
                        className="inf-tl" aria-label={g.name}
                        tabIndex={grade === g.id || (!grade && g.id === 'kg1') ? 0 : -1}
                        onClick={() => pick(g.id)}
                      >
                        <i aria-hidden="true">{TILE_ICON[g.id]}</i>
                        <b>{tileLabel(g)}</b>
                        {TILE_SUB[g.id] && <small>{TILE_SUB[g.id]}</small>}
                        {grade === g.id && <em className="inf-chk" aria-hidden="true">✓</em>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="inf-grade-arrow" aria-label="Next grades" onClick={() => scroll(1)}>›</button>
          </div>
          <p className="inf-swipe" aria-hidden="true">Swipe to see more <span>→</span></p>
        </>
      ) : (
        <div className="inf-solo" role="radiogroup" aria-label={solo.title}>
          <button type="button" role="radio" data-id={tab} aria-checked="true" aria-pressed="true" className="inf-tl inf-tl-wide">
            <i aria-hidden="true">{solo.icon}</i><b>{solo.title}</b><small>{solo.sub}</small>
            <em className="inf-chk" aria-hidden="true">✓</em>
          </button>
        </div>
      )}
    </div>
  );
}

/* Department picker: search, then slide sideways through two rows of cards. */
export function DepartmentPicker({departments, value, onChange}) {
  const [q, setQ] = useState('');
  const list = departments.filter((d) => d.id === value || d.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (d, e) => { onChange(d.id); e.currentTarget.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'}); try { navigator.vibrate?.(12); } catch {} };
  return (
    <div className="inf-dept">
      <input type="search" className="inf-dept-search" aria-label="Search departments" autoComplete="off" placeholder="Search your department" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="inf-dept-track" role="radiogroup" aria-label="Department">
        {list.map((d) => (
          <button type="button" role="radio" key={d.id} aria-checked={value === d.id} aria-pressed={value === d.id} onClick={(e) => pick(d, e)}>
            <span aria-hidden="true">{d.name.trim().charAt(0).toUpperCase()}</span>{d.name}
          </button>
        ))}
      </div>
      {!list.length && <p className="inf-hint">No department matches “{q}”.</p>}
      <p className="inf-hint inf-dept-count">{list.length ? 'Slide for more · ' + list.length + ' departments' : ''}</p>
    </div>
  );
}

/* ---------- icons ---------- */
const ICO = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7.500 8 6 8-6" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="3" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  eye: <><path d="M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M4 4l16 16" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  tick: <path d="m5 12.500 4.500 4.500L19 7.500" />,
};
function Ico({n, className = 'inf-ico'}) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICO[n]}</svg>;
}

/* ---------- illustrations (inline SVG, no image files) ---------- */
const LEMNISCATE = 'M24 24c-3.500-4.500-6.500-7-10-7a7 7 0 000 14c3.500 0 6.500-2.500 10-7s6.500-7 10-7a7 7 0 010 14c-3.500 0-6.500-2.500-10-7z';
const Sp = ({x, y, s = 1, c = '#FFD76A'}) => <path d="M0-7L1.800-1.800 7 0 1.800 1.800 0 7-1.800 1.800-7 0-1.800-1.800z" transform={'translate(' + x + ' ' + y + ') scale(' + s + ')'} fill={c} />;
const Gold = ({id}) => <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE58A" /><stop offset="1" stopColor="#FFAE00" /></linearGradient>;
const Orb = ({id}) => <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8A97FF" /><stop offset="1" stopColor="#3524C9" /></linearGradient>;

function HeroCap() {
  return (
    <svg className="inf-hero-art" viewBox="0 0 160 100" aria-hidden="true" focusable="false">
      <defs><Gold id="hc-g" /><Orb id="hc-o" />
        <linearGradient id="hc-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5B7BFF" /><stop offset="1" stopColor="#3042D6" /></linearGradient>
      </defs>
      <ellipse cx="80" cy="93" rx="58" ry="6" fill="#120A5E" opacity=".55" />
      <rect x="28" y="75" width="104" height="15" rx="4.500" fill="url(#hc-b)" />
      <rect x="33" y="81" width="96" height="3" rx="1.500" fill="#DCE3FF" opacity=".75" />
      <rect x="38" y="62" width="88" height="14" rx="4.500" fill="url(#hc-g)" />
      <rect x="43" y="68" width="80" height="3" rx="1.500" fill="#FFF6D2" opacity=".85" />
      <path d="M50 44v15c0 8 60 8 60 0V44l-30 13z" fill="#2A1F9A" />
      <polygon points="80,12 140,34 80,57 20,34" fill="url(#hc-o)" stroke="rgba(255,255,255,.4)" strokeWidth="1.500" strokeLinejoin="round" />
      <polyline points="20,34 80,57 140,34" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.500" />
      <path d="M130 37v26" stroke="url(#hc-g)" strokeWidth="2.500" strokeLinecap="round" /><circle cx="130" cy="66" r="3.500" fill="#FFC83D" />
      <Sp x={20} y={14} s={0.8} /><Sp x={146} y={14} s={0.6} />
    </svg>
  );
}

function HeroUser() {
  return (
    <svg className="inf-hero-art" viewBox="0 0 160 100" aria-hidden="true" focusable="false">
      <defs><Gold id="hu-g" /><Orb id="hu-o" /></defs>
      <ellipse cx="80" cy="58" rx="66" ry="17" transform="rotate(-12 80 58)" fill="none" stroke="#FFC83D" strokeOpacity=".75" strokeWidth="2" />
      <circle cx="80" cy="50" r="40" fill="url(#hu-o)" stroke="rgba(255,255,255,.5)" strokeWidth="2.500" />
      <circle cx="80" cy="38" r="11" fill="#fff" opacity=".96" />
      <path d="M57 74a23 21 0 0146 0z" fill="#fff" opacity=".96" />
      <circle cx="109" cy="77" r="13" fill="url(#hu-g)" stroke="rgba(255,255,255,.7)" strokeWidth="2" />
      <path d="M109 70v14M102 77h14" stroke="#3A2A00" strokeWidth="3.200" strokeLinecap="round" />
      <Sp x={22} y={34} s={0.9} /><Sp x={142} y={22} s={0.7} /><Sp x={134} y={84} s={0.5} c="#fff" />
    </svg>
  );
}

function HeroShield() {
  return (
    <svg className="inf-hero-art" viewBox="0 0 160 100" aria-hidden="true" focusable="false">
      <defs><linearGradient id="hs-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9C78FF" /><stop offset="1" stopColor="#4326D2" /></linearGradient></defs>
      <ellipse cx="80" cy="58" rx="66" ry="16" transform="rotate(-14 80 58)" fill="none" stroke="#FFC83D" strokeOpacity=".7" strokeWidth="2" />
      <path d="M80 5L115 17v29c0 22-15 38-35 46C60 84 45 68 45 46V17z" fill="url(#hs-s)" stroke="rgba(255,255,255,.65)" strokeWidth="2.500" strokeLinejoin="round" />
      <path d="M80 12L108 22v24c0 17-12 30-28 37" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
      <path d="M72 44v-6a8 8 0 0116 0v6" fill="none" stroke="#fff" strokeWidth="4.500" strokeLinecap="round" />
      <rect x="67" y="44" width="26" height="22" rx="5.500" fill="#fff" />
      <circle cx="80" cy="54" r="3.200" fill="#4326D2" /><rect x="78.800" y="54" width="2.400" height="7" rx="1.200" fill="#4326D2" />
      <Sp x={26} y={26} s={0.9} /><Sp x={142} y={70} s={0.5} c="#fff" />
    </svg>
  );
}

function FootCube() {
  const card = (x, y, r, fill, glyph, key) => (
    <g key={key} transform={'translate(' + x + ' ' + y + ') rotate(' + r + ')'}>
      <rect width="34" height="34" rx="9" fill={fill} stroke="rgba(255,255,255,.45)" strokeWidth="1.500" />
      <text x="17" y="24" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff">{glyph}</text>
    </g>
  );
  return (
    <svg className="inf-foot-art" viewBox="0 0 260 130" aria-hidden="true" focusable="false">
      <defs><Gold id="fc-g" />
        <radialGradient id="fc-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFB84D" stopOpacity=".7" /><stop offset="1" stopColor="#FFB84D" stopOpacity="0" /></radialGradient>
        <linearGradient id="fc-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9B72FF" /><stop offset="1" stopColor="#6137EE" /></linearGradient>
      </defs>
      <ellipse cx="130" cy="116" rx="82" ry="12" fill="url(#fc-glow)" />
      <polygon points="72,70 130,92 130,116 72,94" fill="#4527BC" />
      <polygon points="188,70 130,92 130,116 188,94" fill="#6439EA" />
      <polygon points="130,48 188,70 130,92 72,70" fill="url(#fc-t)" stroke="rgba(255,255,255,.4)" strokeWidth="1.500" strokeLinejoin="round" />
      <path d={LEMNISCATE} transform="translate(130 70) scale(1.500 .8) translate(-24 -24)" fill="none" stroke="url(#fc-g)" strokeWidth="4.200" strokeLinecap="round" strokeLinejoin="round" />
      {card(40, 38, -14, '#9B6BFF', '📖', 'a')}
      {card(88, 6, 8, '#B678FF', '🧪', 'b')}
      {card(150, 8, -6, '#1FBFA0', '√x', 'c')}
      {card(196, 40, 14, '#4C86FF', '🌍', 'd')}
      <Sp x={20} y={80} s={0.7} /><Sp x={240} y={22} s={0.8} /><Sp x={232} y={100} s={0.5} c="#fff" />
    </svg>
  );
}

function FootTrophy() {
  const leaves = [[58, 76, -34], [49, 62, -18], [45, 47, -2], [47, 32, 14], [55, 19, 30]];
  return (
    <svg className="inf-foot-art" viewBox="0 0 220 130" aria-hidden="true" focusable="false">
      <defs><Gold id="ft-g" />
        <radialGradient id="ft-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#8E63FF" stopOpacity=".75" /><stop offset="1" stopColor="#8E63FF" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="110" cy="116" rx="92" ry="13" fill="url(#ft-glow)" />
      <rect x="52" y="98" width="116" height="16" rx="5" fill="#5B3FE0" /><rect x="58" y="104" width="104" height="3" rx="1.500" fill="#CFC4FF" opacity=".6" />
      <rect x="62" y="85" width="96" height="14" rx="4.500" fill="#3548D8" /><rect x="68" y="91" width="84" height="3" rx="1.500" fill="#D5DCFF" opacity=".6" />
      {leaves.map(([x, y, r], i) => (
        <Fragment key={i}>
          <ellipse cx={x} cy={y} rx="4.200" ry="9" transform={'rotate(' + r + ' ' + x + ' ' + y + ')'} fill="url(#ft-g)" />
          <ellipse cx={220 - x} cy={y} rx="4.200" ry="9" transform={'rotate(' + -r + ' ' + (220 - x) + ' ' + y + ')'} fill="url(#ft-g)" />
        </Fragment>
      ))}
      <path d="M76 22C56 22 56 52 84 58M144 22c20 0 20 30-8 36" fill="none" stroke="url(#ft-g)" strokeWidth="6" strokeLinecap="round" />
      <path d="M76 12h68v28c0 24-16 36-34 36S76 64 76 40z" fill="url(#ft-g)" />
      <path d="M84 18v24c0 14 6 24 14 29" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="3" strokeLinecap="round" />
      <path d={LEMNISCATE} transform="translate(110 38) scale(1.100) translate(-24 -24)" fill="none" stroke="#fff" strokeWidth="3.800" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="102" y="74" width="16" height="9" fill="#F5A300" /><rect x="88" y="82" width="44" height="8" rx="3" fill="url(#ft-g)" />
      <Sp x={26} y={22} s={0.8} /><Sp x={198} y={20} s={0.7} />
    </svg>
  );
}

function Laurel({flip}) {
  const leaves = [[10, 40, -22], [7, 32, -10], [6, 23, 2], [8, 15, 16], [13, 8, 34]];
  return (
    <svg className="inf-laurel" viewBox="0 0 24 48" aria-hidden="true" focusable="false" style={flip ? {transform: 'scaleX(-1)'} : undefined}>
      {leaves.map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx="3.200" ry="6.500" transform={'rotate(' + r + ' ' + x + ' ' + y + ')'} fill="#9B7BFF" opacity=".9" />)}
      <path d="M13 46C6 38 4 22 12 6" fill="none" stroke="#9B7BFF" strokeWidth="1.200" opacity=".7" />
    </svg>
  );
}

function Backdrop() {
  return (
    <svg className="inf-bg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bg-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8A5CFF" stopOpacity=".5" /><stop offset="1" stopColor="#2B1FB5" stopOpacity="0" /></linearGradient>
        <linearGradient id="bg-b" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#7B4DFF" stopOpacity=".5" /><stop offset="1" stopColor="#2B1FB5" stopOpacity="0" /></linearGradient>
      </defs>
      <path d="M-40 110C80 20 230 140 440 40V-20H-40z" fill="url(#bg-a)" />
      <path d="M-40 170C100 80 250 210 440 100" fill="none" stroke="rgba(185,165,255,.22)" strokeWidth="1.500" />
      <path d="M-40 740C120 670 270 790 440 680V830H-40z" fill="url(#bg-b)" />
      <path d="M-40 690C120 620 270 740 440 630" fill="none" stroke="rgba(185,165,255,.2)" strokeWidth="1.500" />
    </svg>
  );
}

/* Step dots joined by a line; finished steps show a tick. */
function Steps({step, total}) {
  return (
    <div className="inf-dots" role="img" aria-label={'Step ' + step + ' of ' + total}>
      {Array.from({length: total}, (_, i) => {
        const n = i + 1;
        const st = n < step ? 'done' : n === step ? 'now' : 'next';
        return (
          <Fragment key={n}>
            {i > 0 && <span className={n <= step ? 'on' : ''} />}
            <i className={st}>{st === 'done' && <Ico n="tick" className="inf-dot-tick" />}</i>
          </Fragment>
        );
      })}
    </div>
  );
}

function Field({label, icon, end, children}) {
  return (
    <label className="inf-field">
      <span className="inf-sr">{label}</span>
      <span className="inf-ctl"><Ico n={icon} />{children}{end}</span>
    </label>
  );
}

export default function AuthScreen({busy, error, notice, departments, onSubmit, onReset, onClearError}) {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [step, setStep] = useState(1);        // signup only: 1 account, 2 level, 3 department (university only)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [grade, setGrade] = useState('');
  const [dept, setDept] = useState('');
  const [localError, setLocalError] = useState('');
  const errId = useId();

  const signup = mode === 'signup';
  const shownError = localError || error;
  const switchMode = () => { setMode(signup ? 'signin' : 'signup'); setStep(1); setLocalError(''); onClearError(); };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setLocalError('');
    const cleanEmail = email.trim();
    if (signup && step === 1) {
      if (!name.trim()) return setLocalError('Enter your name.');
      if (password.length < 6) return setLocalError('Use at least 6 characters for your password.');
      return setStep(2);
    }
    if (signup && step === 2) {
      if (!grade) return setLocalError('Slide and choose your level to continue.');
      if (grade === 'uni') return setStep(3);
    }
    if (signup && step === 3 && !dept) return setLocalError('Choose your department.');
    await onSubmit({mode, name: name.trim(), email: cleanEmail, password, grade: signup ? grade : '', dept: signup ? dept : ''});
  };

  const levelBlock = (
    <div className="inf-level">
      <GradePicker grade={grade} onChange={(g) => { setGrade(g); if (g !== 'uni') setDept(''); setLocalError(''); }} />
    </div>
  );

  const total = signup && grade === 'uni' ? 3 : 2;
  const title = !signup ? 'Welcome back' : step === 1 ? 'Create your account' : step === 2 ? 'What do you study?' : 'Your department';
  const sub = !signup ? 'Sign in to continue. Your level is saved on your account.' : step === 1 ? 'Free to start. Takes under a minute.' : step === 2 ? 'Choose your educational stage and grade.' : 'Slide sideways and tap yours.';
  const chosen = GRADES.find((g) => g.id === grade);
  const levelName = chosen ? chosen.name.replace('University / College', 'University') : '';
  const deptName = departments.find((d) => d.id === dept)?.name || '';
  const ready = signup && ((step === 2 && !!grade) || (step === 3 && !!dept));
  const cta = !signup ? 'Sign in'
    : step === 1 ? 'Continue'
    : step === 2 ? (!grade ? 'Pick your level' : grade === 'uni' ? 'Next: your department' : 'Start as ' + levelName)
    : dept ? 'Start as ' + levelName + ' · ' + (deptName.length > 20 ? deptName.slice(0, 19) + '…' : deptName) : 'Pick your department';
  const back = () => { setStep((v) => Math.max(1, v - 1)); setLocalError(''); };

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const hero = !signup ? <HeroShield /> : step === 1 ? <HeroUser /> : <HeroCap />;
  const foot = !signup ? <FootTrophy /> : step === 1 ? <FootCube /> : null;

  return (
    <main className={'inf-app inf-auth' + (signup && step >= 2 ? ' is-compact' : '')}>
      <Backdrop />
      <section className="inf-auth-brand">
        <div className="inf-lockup"><Laurel /><Mark size={48} /><span>Infinity</span><Laurel flip /></div>
        <div className="inf-tag" aria-hidden="true">Learn <i /> Practice <i /> Excel</div>
        <h1 className="inf-sr">Infinity: prepare for every exam, from Kindergarten to university.</h1>
      </section>

      <section className="inf-auth-panel">
        <form onSubmit={submit} noValidate={false} aria-labelledby="inf-auth-title">
          <header>
            {signup && <Steps step={step} total={total} />}
            {hero}
            <h2 id="inf-auth-title">{title}</h2>
            <p>{sub}</p>
          </header>

          {(!signup || step === 1) && (
            <div className="inf-slide" key="s1">
              {signup && (
                <Field label="Full name" icon="user">
                  <input required autoComplete="name" placeholder="Full name" aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              )}
              <Field label="Email" icon="mail" end={signup && validEmail ? <span className="inf-ok" aria-hidden="true"><Ico n="tick" className="inf-ok-ico" /></span> : null}>
                <input type="email" required inputMode="email" placeholder="Email" aria-label="Email" autoComplete={signup ? 'email' : 'username'} autoCapitalize="none" spellCheck={false}
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password" icon="lock" end={
                <button type="button" className="inf-ghost inf-eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((v) => !v)}><Ico n={show ? 'eyeoff' : 'eye'} /></button>
              }>
                <input type={show ? 'text' : 'password'} required minLength={6} placeholder="Password" aria-label="Password" autoComplete={signup ? 'new-password' : 'current-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              {!signup && (
                <button type="button" className="inf-link inf-forgot" onClick={() => onReset(email.trim())}>Forgot password?</button>
              )}
            </div>
          )}

          {signup && step === 2 && <div className="inf-slide" key="s2">{levelBlock}</div>}
          {signup && step === 3 && <div className="inf-slide" key="s3"><DepartmentPicker departments={departments} value={dept} onChange={(id) => { setDept(id); setLocalError(''); }} /></div>}

          <div id={errId} aria-live="polite">
            {shownError && <p role="alert" className="inf-error">{shownError}</p>}
            {notice && !shownError && <p className="inf-notice">{notice}</p>}
          </div>

          <button className="inf-primary" type="submit" data-ready={ready || undefined} disabled={busy || (signup && step >= 2 && !ready)}>
            {busy ? 'Please wait…' : <><span>{cta}</span><Ico n="arrow" className="inf-arrow" /></>}
          </button>
          {signup && step >= 2 && (
            <button type="button" className="inf-link" onClick={back}>Back</button>
          )}
          <p className="inf-switch">
            {signup ? 'Already have an account?' : 'New to Infinity?'}{' '}
            <button type="button" className="inf-link" onClick={switchMode}>{signup ? 'Sign in' : 'Create an account'}</button>
          </p>
          {foot}
        </form>
      </section>
    </main>
  );
}
