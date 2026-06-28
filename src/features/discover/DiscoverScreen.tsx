'use client';
import { useState } from 'react';

const ACCENT = '#3D6B4F';
const ACCENT_LIGHT = '#EBF3EE';

const CATEGORIES = ['All', 'Nature', 'Culture', 'Travel', 'Quotes'];

const PEOPLE = [
  { name: 'Selam', handle: '@selam_21', color: '#5A9A6F', following: false },
  { name: 'Yared', handle: '@yared_v', color: '#3D6B4F', following: true },
  { name: 'Hana', handle: '@hana.life', color: '#8B6B4F', following: false },
  { name: 'Elias', handle: '@elias_ph', color: '#4F6B8B', following: false },
  { name: 'Meklit', handle: '@meklit.m', color: '#7B6B3D', following: true },
  { name: 'Abel', handle: '@abel_17', color: '#6B3D5A', following: false },
];

const POPULAR_PLACES = [
  { name: 'Simen Mountains', gradient: 'linear-gradient(135deg, #3D6B4F, #5A9A6F)' },
  { name: 'Lalibela', gradient: 'linear-gradient(135deg, #8B6B4F, #B8956A)' },
  { name: 'Tana Lake', gradient: 'linear-gradient(135deg, #4F6B8B, #6B8BB8)' },
];

const TRENDING = [
  { name: 'Ethiopian Highlands', posts: '2.4K posts', icon: '🏔' },
  { name: 'Inspirational Quotes', posts: '16K posts', icon: '💬' },
  { name: 'Cultural Heritage', posts: '980 posts', icon: '🏛' },
];

export function DiscoverScreen() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [followed, setFollowed] = useState<string[]>(
    PEOPLE.filter(p => p.following).map(p => p.name)
  );
  const [search, setSearch] = useState('');

  const toggle = (name: string) =>
    setFollowed(f => f.includes(name) ? f.filter(x => x !== name) : [...f, name]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '16px 18px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: '0 0 12px' }}>Explore</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8F7F4', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(0,0,0,0.07)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search places, people, topics..."
            style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: 14, color: '#1A1A1A' }}
          />
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto' }}>
          {CATEGORIES.map((c, i) => (
            <button key={c} onClick={() => setActiveCategory(i)} style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              whiteSpace: 'nowrap', flexShrink: 0, border: 'none', cursor: 'pointer',
              background: i === activeCategory ? ACCENT : '#F8F7F4',
              color: i === activeCategory ? '#fff' : '#6B7280',
            }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Popular Places */}
      <div style={{ padding: '18px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 12px' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>Popular Places</span>
          <span style={{ fontSize: 13, color: ACCENT, fontWeight: 600, cursor: 'pointer' }}>See all</span>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 18px', overflowX: 'auto' }}>
          {POPULAR_PLACES.map(p => (
            <div key={p.name} style={{
              width: 130, height: 90, borderRadius: 14, background: p.gradient,
              flexShrink: 0, display: 'flex', alignItems: 'flex-end', padding: '10px',
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', position: 'relative', zIndex: 1 }}>{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trending Now */}
      <div style={{ padding: '18px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 12px' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>Trending Now</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 18px' }}>
          {TRENDING.map(t => (
            <div key={t.name} style={{
              background: '#FFFFFF', borderRadius: 12, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
              border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', marginBottom: 6,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{t.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t.posts}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* People Section */}
      <div style={{ padding: '18px 0 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 12px' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>People</span>
          <span style={{ fontSize: 13, color: ACCENT, fontWeight: 600, cursor: 'pointer' }}>See all</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 18px' }}>
          {PEOPLE.map(p => (
            <div key={p.name} style={{
              background: '#FFFFFF', borderRadius: 14, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{p.name[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{p.handle}</div>
              </div>
              <button onClick={() => toggle(p.name)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: followed.includes(p.name) ? `1.5px solid ${ACCENT}` : 'none',
                background: followed.includes(p.name) ? 'transparent' : ACCENT,
                color: followed.includes(p.name) ? ACCENT : '#fff',
                cursor: 'pointer',
              }}>
                {followed.includes(p.name) ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
