'use client';
import { useEffect, useState } from 'react';
import { fetchBoard } from '@/lib/studyClient';

/** Weekly leaderboard of the learner's own grade or department. Only first names are shown. */
export default function RankScreen({ t, gradeName, onBack }) {
  const [kind, setKind] = useState('week'), [data, setData] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    let live = true; setData(null); setErr('');
    fetchBoard(kind).then((d) => live && setData(d)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [kind]);
  const unit = kind === 'week' ? t('xp') : t('dayStreak');
  const rows = data?.rows || [];
  return (
    <section className="inf-rank" aria-label={t('boardTitle')}>
      <header className="inf-rank-top"><button type="button" className="inf-ghost-btn" onClick={onBack}>← {t('nav_home')}</button><h1>{t('boardTitle')}</h1><p>{gradeName}</p></header>
      <div className="inf-seg" role="group" aria-label={t('boardTitle')}>
        {[['week', t('boardWeek')], ['streak', t('boardStreak')]].map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {err && <p role="alert" className="inf-error">{err}</p>}
      {!err && !data && <p className="inf-hint">…</p>}
      {data && !data.hasGroup && <p className="inf-hint">{t('boardNoGroup')}</p>}
      {data && data.hasGroup && rows.length === 0 && <p className="inf-hint">{t('boardEmpty')}</p>}
      <ol className="inf-rank-list">
        {rows.map((r) => (
          <li key={r.rank} className={r.me ? 'is-me' : ''}><span className="inf-rank-n">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span><b>{r.me ? t('you') + ' · ' + r.name : r.name}</b><em>{r.score} {unit}</em></li>
        ))}
      </ol>
      {data?.me && data.me.rank > 20 && <p className="inf-rank-me">{t('you')}: #{data.me.rank} · {data.me.score} {unit}</p>}
    </section>
  );
}
