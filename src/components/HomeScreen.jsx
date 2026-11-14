'use client';
import {DAILY_GOAL, liveStreak, todayCount} from '@/lib/studyStreak';

const ACCENTS = ['#2748F0', '#6A3FD8', '#0E8A6B', '#D6455D', '#E8A400', '#0F8DB0'];
const greeting = (h) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

function Ring({value, goal}) {
  const r = 34, c = 2 * Math.PI * r, pct = Math.min(1, value / goal);
  return (
    <svg className="inf-ring" width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={Math.min(value, goal) + ' of ' + goal + ' questions today'}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="9" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--inf-sun)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 44 44)" style={{transition: 'stroke-dashoffset .6s ease'}} />
      <text x="44" y="50" textAnchor="middle" className="inf-ring-n">{Math.min(value, goal)}</text>
    </svg>
  );
}
const Flame = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.500 2c.5 3-1.500 4.500-3 6.500C9 10.500 8 12 8 14a4 4 0 008 0c0-1.500-.7-2.700-1.500-3.700 2.700 1 4.500 3.400 4.500 6.200A7 7 0 015 16.500C5 11 10 8.500 13.500 2z"/></svg>
);

export default function HomeScreen({name, gradeName, subjects, stats, resume, onResume, onQuick, onOpen, onAll, onGames, now = new Date()}) {
  const today = todayCount(stats, now), streak = liveStreak(stats, now), left = Math.max(0, DAILY_GOAL - today);
  const total = subjects.reduce((n, d) => n + d.q.length, 0);
  const acc = stats.answered ? Math.round(((stats.correct || 0) / stats.answered) * 100) : 0;
  return (
    <div className="inf-home-screen">
      <p className="inf-hello">{greeting(now.getHours())}{name ? ', ' + name : ''}</p>
      <section className="inf-hero" aria-label="Today">
        <Ring value={today} goal={DAILY_GOAL} />
        <div>
          <h1>{left ? left + ' more to hit today’s goal' : 'Goal done. Keep going!'}</h1>
          <p className="inf-streak"><Flame /> {streak ? streak + '-day streak' : 'Start your streak today'}</p>
        </div>
      </section>
      {resume
        ? <button className="inf-primary inf-cta" onClick={onResume}>Resume your exam →</button>
        : total > 0 && <button className="inf-primary inf-cta" onClick={onQuick}>{left ? 'Start today’s ' + DAILY_GOAL + ' →' : 'Practice 10 more →'}</button>}
      <div className="inf-mini" aria-label="Your progress">
        <div><b>{stats.xp || 0}</b><span>XP</span></div>
        <div><b>{acc}%</b><span>Accuracy</span></div>
        <div><b>{stats.answered || 0}</b><span>Answered</span></div>
      </div>
      <div className="inf-row"><h2>{gradeName} subjects</h2>{subjects.length > 6 && <button className="inf-link" onClick={onAll}>See all</button>}</div>
      {subjects.length ? (
        <div className="inf-tiles">
          {subjects.slice(0, 6).map((d, i) => (
            <button key={d.id} className="inf-tile" style={{'--accent': ACCENTS[i % ACCENTS.length]}} onClick={() => onOpen(d)}>
              <span className="inf-tile-dot" aria-hidden="true">{d.name.trim().charAt(0).toUpperCase()}</span>
              <b>{d.name}</b><small>{d.q.length} questions</small>
            </button>
          ))}
        </div>
      ) : <p className="inf-hint">Questions for your level are being prepared. Come back soon.</p>}
      <button className="inf-gamebar" onClick={onGames}><span>Need a break?</span><b>Play a game →</b></button>
    </div>
  );
}
