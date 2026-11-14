'use client';
import {goalOf, liveStreak, levelFor, nextUp, todayCount, upcomingExams, weekActivity} from '@/lib/studyStreak';
import {makeT} from '@/lib/infText';
const T0 = makeT('en');

/* ---------- shared pieces: icons, subject colours, rings ---------- */
export const Svg = ({children, size = 24}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
const P = {
  calc: <><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" /></>,
  book: <><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z" /><path d="M12 6v13.5" /></>,
  flask: <><path d="M9.5 3h5M10.5 3v6L5 18.5A2 2 0 006.7 21.5h10.6A2 2 0 0019 18.5L13.5 9V3" /><path d="M8 15h8" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><circle cx="17" cy="9.5" r="2.5" /><path d="M17.5 14.2c2.4.3 4 2 4 4.6" /></>,
  art: <><path d="M12 3a9 9 0 000 18c1.5 0 2-1 1.5-2.2-.5-1.3.3-2.3 1.7-2.3H17a4 4 0 004-4c0-5-4-9.5-9-9.5z" /><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" /></>,
  ict: <><rect x="4" y="5" width="16" height="11" rx="2" /><path d="M2.5 20h19" /></>,
  leaf: <><path d="M5 19C5 10 10 5 20 4c0 10-4 15-13 15z" /><path d="M5 19c3-5 6-8 10-10" /></>,
  compass: <><path d="M12 3 5 20M12 3l7 17M7.5 14.5h9" /><circle cx="12" cy="3" r="1.2" /></>,
};
/* [matcher, svg, glyph, accent]: each subject keeps one colour wherever it appears. */
const SUBJECTS = [
  [/math|calc|algebra|arith/, P.calc, '', '#6A3FD8'],
  [/engl/, P.book, '', '#1F7AE0'],
  [/scien|bio|chem|phys/, P.flask, '', '#12A06B'],
  [/amh/, null, 'አ', '#E8641B'],
  [/arab/, null, 'ع', '#4F46E5'],
  [/oromo|afaan/, null, 'O', '#0F8DB0'],
  [/tigr/, null, 'ት', '#B8741A'],
  [/social|geo|histor|civic|citizen/, P.people, '', '#C23BAD'],
  [/art|music|draw/, P.art, '', '#D6455D'],
  [/ict|comput|tech/, P.ict, '', '#0F8DB0'],
  [/life|health|environ|agri/, P.leaf, '', '#4E9A1F'],
  [/lang|read|liter/, P.book, '', '#1F7AE0'],
];
const FALLBACK = ['#6A3FD8', '#1F7AE0', '#12A06B', '#E8641B', '#C23BAD', '#4F46E5', '#D6455D', '#0F8DB0'];
export const ACCENTS = FALLBACK;
const find = (n) => SUBJECTS.find(([re]) => re.test(String(n).toLowerCase()));
export const iconFor = (n) => find(n)?.[1] || null;
export const accentFor = (n, i = 0) => find(n)?.[3] || FALLBACK[i % FALLBACK.length];
export function SubjectIcon({name, size = 26, i = 0}) {
  const m = find(name);
  if (m?.[1]) return <Svg size={size}>{m[1]}</Svg>;
  return <span className="inf-glyph" style={{fontSize: size * 0.85}}>{m?.[2] || String(name).trim().charAt(0).toUpperCase()}</span>;
}
export const initialOf = (s) => String(s || '?').trim().charAt(0).toUpperCase();

const greeting = (t, h) => t(h < 12 ? 'goodMorning' : h < 18 ? 'goodAfternoon' : 'goodEvening');
const when = (t, d) => (d === 0 ? t('today') : d === 1 ? t('tomorrow') : t('inDays', {n: d}));
const FLAME = <path d="M13.5 2c.5 3-1.5 4.5-3 6.5C9 10.5 8 12 8 14a4 4 0 008 0c0-1.5-.7-2.7-1.5-3.7 2.7 1 4.5 3.4 4.5 6.2A7 7 0 015 16.5C5 11 10 8.5 13.5 2z" />;
const BOLT = <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />;
const TARGET = <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>;

function Ring({value, goal, label}) {
  const r = 42, c = 2 * Math.PI * r, pct = Math.min(1, value / goal);
  return (
    <svg className="inf-ring" viewBox="0 0 104 104" role="img" aria-label={label}>
      <circle cx="52" cy="52" r={r} fill="none" strokeWidth="10" className="inf-ring-bg" />
      <circle cx="52" cy="52" r={r} fill="none" strokeWidth="10" strokeLinecap="round" className="inf-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 52 52)" />
      <text x="52" y="52" textAnchor="middle" className="inf-ring-n">{Math.min(value, goal)}</text>
      <text x="52" y="70" textAnchor="middle" className="inf-ring-g">/ {goal}</text>
    </svg>
  );
}

export default function HomeScreen({name, subjects, stats, onContinue, onOpen, onAll, onExams, now = new Date(), lang = 'en', t = T0}) {
  const goal = goalOf(stats), today = todayCount(stats, now), streak = liveStreak(stats, now), left = Math.max(0, goal - today);
  const acc = stats.answered ? Math.round(((stats.correct || 0) / stats.answered) * 100) : 0;
  const lv = levelFor(stats.xp);
  const next = nextUp(stats, subjects), up = upcomingExams(stats, now)[0];
  const why = !next ? '' : next.why === 'weak' ? t('whyWeak', {p: next.pct}) : next.why === 'last' ? t('whyLast') : t('whyNew');
  return (
    <div className="inf-h">
      <header className="inf-h-hello">
        <h1>{greeting(t, now.getHours())}{name ? ', ' : ''}{name && <span>{name}</span>}</h1>
        <p>{streak && !today ? t('saveStreak', {n: streak}) : streak ? t('answerKeep', {n: goal}) : t('answerStart', {n: goal})}</p>
      </header>

      {next ? (
        <section className="inf-hero" aria-label={t('continueLearning')}>
          <div className="inf-hero-text">
            <small>{t('continueLearning')}</small>
            <h2>{next.subject.name}</h2>
            <p>{why}</p>
            <button type="button" className="inf-hero-btn" onClick={() => onContinue(next.subject)}>{t('continueBtn')}<Svg size={20}><path d="M5 12h14M13 6l6 6-6 6" /></Svg></button>
          </div>
          <span className="inf-hero-art" aria-hidden="true"><SubjectIcon name={next.subject.name} size={54} /></span>
        </section>
      ) : <p className="inf-hint">{t('preparing')}</p>}

      <section className="inf-panel inf-pg" aria-label={t('yourProgress')}>
        <h2>{t('yourProgress')}</h2>
        <div className="inf-pg-row">
          <Ring value={today} goal={goal} label={Math.min(today, goal) + ' / ' + goal} />
          <div className="inf-pg-side">
            <p className="inf-pg-goal">{left ? t('toGoal', {n: left}) : t('goalReached')}</p>
            <ul className="inf-pills">
              <li data-k="streak"><Svg size={18}>{FLAME}</Svg><b>{streak}</b><span>{t('dayStreak')}</span></li>
              <li data-k="xp"><Svg size={18}>{BOLT}</Svg><b>{stats.xp || 0}</b><span>{t('xp')}</span></li>
              <li data-k="acc"><Svg size={18}>{TARGET}</Svg><b>{acc}%</b><span>{t('accuracy')}</span></li>
            </ul>
          </div>
        </div>
        <ol className="inf-week" aria-label={t('thisWeek')}>{weekActivity(stats, now, lang === 'am' ? 'am' : 'en').map((d) => <li key={d.key} className={(d.count >= goal ? 'is-full ' : d.count > 0 ? 'is-part ' : '') + (d.today ? 'is-today' : '')}><i aria-hidden="true">{d.count >= goal ? '🔥' : d.count > 0 ? '•' : ''}</i><span>{d.label.slice(0, 2)}</span></li>)}</ol>
        <div className="inf-lvl"><span>{t('levelN', {n: lv.level})}</span><div className="inf-bar" role="progressbar" aria-label={t('levelN', {n: lv.level})} aria-valuemin={0} aria-valuemax={lv.size} aria-valuenow={lv.into}><i style={{width: lv.into + '%'}} /></div><span>{t('xpToNext', {n: lv.size - lv.into, m: lv.level + 1})}</span></div>
      </section>

      <section className="inf-panel inf-up" aria-label={t('upcomingExams')}>
        <h2><Svg size={22}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>{t('upcomingExams')}</h2>
        {up ? (
          <button type="button" className="inf-up-item" onClick={onExams}>
            <span className="inf-up-ico" style={{'--accent': accentFor(up.subject)}}><SubjectIcon name={up.subject} size={22} /></span>
            <span><b>{up.subject}</b><small>{up.date}</small></span>
            <em className={up.days <= 1 ? 'is-soon' : ''}>{when(t, up.days)}</em>
          </button>
        ) : (
          <div className="inf-empty"><b>{t('noUpcoming')}</b><small>{t('noUpcomingSub')}</small><button type="button" className="inf-ghost-btn" onClick={onExams}>{t('planExam')}</button></div>
        )}
      </section>
    </div>
  );
}
export {when};
