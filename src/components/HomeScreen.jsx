'use client';
import {goalOf, liveStreak, todayCount} from '@/lib/studyStreak';
import {makeT} from '@/lib/infText';
const T0 = makeT('en');

const ACCENTS = ['#2748F0', '#B23FA8', '#6A3FD8', '#C9801A', '#0E8A6B', '#D6455D', '#0F8DB0', '#4E9A1F'];
const greeting = (t, h) => t(h < 12 ? 'goodMorning' : h < 18 ? 'goodAfternoon' : 'goodEvening');

/* Small line icons, picked from the subject's own name. Anything unmatched shows its initial. */
const P = {
  calc: <><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" /></>,
  book: <><path d="M4 5.5C6.5 4.5 9.500 4.500 12 6c2.500-1.500 5.500-1.500 8-.5V19c-2.500-1-5.500-1-8 .5-2.500-1.500-5.500-1.500-8-.5z" /><path d="M12 6v13.500" /></>,
  flask: <><path d="M9.500 3h5M10.500 3v6L5 18.500A2 2 0 006.700 21.500h10.600A2 2 0 0019 18.500L13.500 9V3" /><path d="M8 15h8" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  art: <><path d="M12 3a9 9 0 000 18c1.500 0 2-1 1.500-2.200-.5-1.300.3-2.300 1.700-2.300H17a4 4 0 004-4c0-5-4-9.500-9-9.500z" /><path d="M7.500 11h.01M10 7.500h.01M14.500 7.500h.01" /></>,
  ict: <><rect x="4" y="5" width="16" height="11" rx="2" /><path d="M2.500 20h19" /></>,
  leaf: <><path d="M5 19C5 10 10 5 20 4c0 10-4 15-13 15z" /><path d="M5 19c3-5 6-8 10-10" /></>,
};
const iconFor = (n) => {
  const s = n.toLowerCase();
  if (/math|calc|algebra|arith/.test(s)) return P.calc;
  if (/scien|bio|chem|phys/.test(s)) return P.flask;
  if (/social|geo|histor|civic/.test(s)) return P.globe;
  if (/art|music|draw/.test(s)) return P.art;
  if (/ict|comput|tech/.test(s)) return P.ict;
  if (/life|health|environ|agri/.test(s)) return P.leaf;
  if (/engl|amh|lang|read|liter|arab|oromo|tigr|somali|afar/.test(s)) return P.book;
  return null;
};
const Svg = ({children, size = 24}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
const STAT = {
  xp: <path d="M13 2L4.500 13.500H11L10 22l8.500-11.500H12z" />,
  acc: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  ans: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.500 12.500 2.500 2.500 4.500-5" /></>,
  streak: <path d="M13.500 2c.5 3-1.500 4.500-3 6.500C9 10.500 8 12 8 14a4 4 0 008 0c0-1.500-.7-2.700-1.500-3.700 2.700 1 4.500 3.400 4.500 6.200A7 7 0 015 16.500C5 11 10 8.500 13.500 2z" />,
};

function Ring({value, goal}) {
  const r = 46, c = 2 * Math.PI * r, v = Math.min(value, goal), pct = v / goal;
  return (
    <svg className="inf-h-ring" viewBox="0 0 112 112" role="img" aria-label={v + ' of ' + goal + ' questions today'}>
      <defs><linearGradient id="inf-ring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFE08A" /><stop offset="1" stopColor="#FFB800" /></linearGradient></defs>
      <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="9" />
      <circle cx="56" cy="56" r={r} fill="none" stroke="url(#inf-ring-g)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 56 56)" style={{transition: 'stroke-dashoffset .6s ease'}} />
      <text x="56" y="62" textAnchor="middle" className="inf-h-ring-n">{v}/{goal}</text>
    </svg>
  );
}

export function StatStrip({stats, now = new Date(), t = T0}) {
  const streak = liveStreak(stats, now);
  const acc = stats.answered ? Math.round(((stats.correct || 0) / stats.answered) * 100) : 0;
  const figures = [['xp', stats.xp || 0, t('xp')], ['acc', acc + '%', t('accuracy')], ['ans', stats.answered || 0, t('answered')], ['streak', streak, t('streak')]];
  return (
    <dl className="inf-h-stats" aria-label="Your progress">
      {figures.map(([k, v, l]) => (
        <div key={k}><span className="inf-h-ico" data-k={k}><Svg size={22}>{STAT[k]}</Svg></span><dd>{v}</dd><dt>{l}</dt></div>
      ))}
    </dl>
  );
}

export default function HomeScreen({name, gradeName, subjects, stats, resume, onResume, onQuick, onOpen, onAll, onGames, now = new Date(), t = T0}) {
  const goal = goalOf(stats);
  const today = todayCount(stats, now), streak = liveStreak(stats, now), left = Math.max(0, goal - today);
  const total = subjects.reduce((n, d) => n + d.q.length, 0);
  return (
    <div className="inf-h">
      <header className="inf-h-hello">
        <h1>{greeting(t, now.getHours())}{name ? ', ' + name : ''}</h1>
        <p>{left ? t(left === 1 ? 'goalLeft1' : 'goalLeft', {n: left}) : t('goalDone')}</p>
      </header>

      <section className="inf-h-goal" aria-label={t('todayGoal')}>
        <Ring value={today} goal={goal} />
        <div className="inf-h-goal-text">
          <h2>{t('todayGoal')}</h2>
          <p>{t(streak ? 'answerKeep' : 'answerStart', {n: goal})}</p>
          {resume
            ? <button type="button" className="inf-h-go" onClick={onResume}>{t('resume')}</button>
            : total > 0 && <button type="button" className="inf-h-go" onClick={onQuick}>{left ? t('start') : t('more10')}</button>}
        </div>
        <svg className="inf-h-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path pathLength="100" d="M24 24c-3.500-4.500-6.500-7-10-7a7 7 0 000 14c3.500 0 6.500-2.500 10-7s6.500-7 10-7a7 7 0 010 14c-3.500 0-6.500-2.500-10-7z" fill="none" stroke="currentColor" strokeWidth="3.600" strokeLinecap="round" /></svg>
      </section>

      <StatStrip stats={stats} now={now} t={t} />

      <div className="inf-h-row"><h2>{t('subjectsOf', {g: gradeName})}</h2>{subjects.length > 8 && <button type="button" className="inf-link" onClick={onAll}>{t('viewAll')}</button>}</div>
      {subjects.length ? (
        <div className="inf-h-grid">
          {subjects.slice(0, 8).map((d, i) => {
            const ico = iconFor(d.name);
            return (
              <button type="button" key={d.id} className="inf-h-card" style={{'--accent': ACCENTS[i % ACCENTS.length]}} onClick={() => onOpen(d)}>
                <span className="inf-h-card-ico" aria-hidden="true">{ico ? <Svg size={26}>{ico}</Svg> : d.name.trim().charAt(0).toUpperCase()}</span>
                <b>{d.name}</b>
                <small>{t('nQuestions', {n: d.q.length})}</small>
                <span className="inf-h-chev" aria-hidden="true"><Svg size={18}><path d="m9 6 6 6-6 6" /></Svg></span>
              </button>
            );
          })}
        </div>
      ) : <p className="inf-hint">{t('preparing')}</p>}

      <section className="inf-h-break">
        <div><h2>{t('breakTitle')}</h2><p>{t('breakSub')}</p></div>
        <button type="button" onClick={onGames}>{t('playGame')}</button>
      </section>
    </div>
  );
}
