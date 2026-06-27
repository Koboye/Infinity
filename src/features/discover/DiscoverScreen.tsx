'use client';
import { useState } from 'react';

const ACCENT = '#5B4EE8';
const ACCENT_LIGHT = '#EEF0FD';

const PEOPLE = [
  { name: 'Zoe', role: 'Designer', color: '#D85A30' },
  { name: 'Ethan', role: 'Developer', color: '#185FA5' },
  { name: 'Maya', role: 'Writer', color: '#8B7EE8' },
  { name: 'Noah', role: 'Creator', color: '#0F6E56' },
];
const TOPICS = [
  { name: 'Mindset', count: '12.5K posts', icon: '🧠' },
  { name: 'Productivity', count: '8.7K posts', icon: '⚡' },
  { name: 'Tech', count: '15.2K posts', icon: '</>' },
];
const VOICES = [
  { name: 'Noah', bio: 'Building in public', color: '#185FA5' },
  { name: 'Olivia', bio: 'Sharing thoughts', color: '#D4537E' },
  { name: 'Jason', bio: 'Helping creators', color: '#0F6E56' },
];

export function DiscoverScreen() {
  const [followed, setFollowed] = useState<string[]>([]);

  const toggle = (name: string) =>
    setFollowed(f => f.includes(name) ? f.filter(x => x !== name) : [...f, name]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F5F5F7' }}>

      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '16px 20px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0D0D12', margin: 0 }}>Explore</h1>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
      </div>

      {/* People section */}
      <div style={{ padding: '14px 0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 10px' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0D0D12' }}>People you'll vibe with</span>
          <span style={{ fontSize: 13, color: ACCENT, fontWeight: 600, cursor: 'pointer' }}>See all</span>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 20px', overflowX: 'auto' }}>
          {PEOPLE.map(p => (
            <div key={p.name} style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 100, border: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff' }}>{p.name[0]}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D0D12', textAlign: 'center' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>{p.role}</div>
              <button onClick={() => toggle(p.name)} style={{
                width: 30, height: 30, borderRadius: '50%',
                background: followed.includes(p.name) ? ACCENT : ACCENT_LIGHT,
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={followed.includes(p.name) ? 'white' : ACCENT} strokeWidth="3" strokeLinecap="round">
                  {followed.includes(p.name)
                    ? <polyline points="20 6 9 17 4 12"/>
                    : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                  }
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Trending topics */}
      <div style={{ padding: '16px 0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 10px' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0D0D12' }}>Trending topics</span>
          <span style={{ fontSize: 13, color: ACCENT, fontWeight: 600, cursor: 'pointer' }}>See all</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '0 20px' }}>
          {TOPICS.map(t => (
            <div key={t.name} style={{ background: '#FFFFFF', borderRadius: 12, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: '1px solid rgba(0,0,0,0.07)', cursor: 'pointer' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: ACCENT }}>
                {t.icon}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0D0D12', textAlign: 'center' }}>{t.name}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center' }}>{t.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top voices */}
      <div style={{ padding: '16px 0 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 10px' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0D0D12' }}>Top voices</span>
          <span style={{ fontSize: 13, color: ACCENT, fontWeight: 600, cursor: 'pointer' }}>See all</span>
        </div>
        <div style={{ padding: '0 20px' }}>
          {VOICES.map((v, i) => (
            <div key={v.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < VOICES.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: v.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff' }}>{v.name[0]}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0D0D12' }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{v.bio}</div>
                </div>
              </div>
              <button onClick={() => toggle(v.name)} style={{
                width: 30, height: 30, borderRadius: '50%',
                background: followed.includes(v.name) ? ACCENT : '#F5F5F7',
                border: followed.includes(v.name) ? 'none' : '1px solid rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={followed.includes(v.name) ? 'white' : '#6B7280'} strokeWidth="2.5" strokeLinecap="round">
                  {followed.includes(v.name)
                    ? <polyline points="20 6 9 17 4 12"/>
                    : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                  }
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
