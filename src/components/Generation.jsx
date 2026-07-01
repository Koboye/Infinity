'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Home, Compass, Bell, Mail, Bookmark, Users, User, Plus, MoreHorizontal,
  Search, Heart, MessageCircle, Share2, Download, Flag, Eye, Edit2, Pin,
  Link2, Repeat2, Send, FolderPlus, VolumeX, Ban, Sun, Moon, Monitor,
  ChevronDown, X, Image as ImageIcon, Video as VideoIcon, BarChart2, Smile,
  Crown, ArrowLeft, Sliders, MousePointer2, Feather, Copy,
} from 'lucide-react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query,
  where, orderBy, limit, onSnapshot, serverTimestamp, increment, setDoc,
} from 'firebase/firestore';

/* ─────────────────────────── helpers ─────────────────────────── */
const genFormatNumber = (n) => {
  n = n || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

const timeAgo = (ts) => {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d`;
  return date.toLocaleDateString();
};

const initials = (name) => (name || 'U').slice(0, 1).toUpperCase();

/* ─────────────────────────── avatar ─────────────────────────── */
const GenAvatar = ({ user, size = 40, onClick, ring }) => (
  <div
    onClick={onClick}
    style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: user?.avatarUrl ? `url(${user.avatarUrl}) center/cover` : (user?.avatarColor || '#7C3AED'),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.4, cursor: onClick ? 'pointer' : 'default',
      border: ring ? `2px solid ${ring}` : 'none', boxShadow: ring ? '0 0 0 2px var(--g-card)' : 'none',
    }}
  >
    {!user?.avatarUrl && initials(user?.username || user?.avatar)}
  </div>
);

/* ─────────────────────────── global css ─────────────────────────── */
export const GenGlobalCSS = () => (
  <style>{`
  .gen-app {
    --g-bg: #F6F5FB; --g-card: #FFFFFF; --g-border: rgba(20,20,30,0.08);
    --g-text: #15151E; --g-sub: #6B6B78; --g-mute: #9494A0;
    --g-hover: rgba(124,58,237,0.08); --g-accent: #7C3AED; --g-accent2: #EC4899;
    --g-grad: linear-gradient(135deg,#7C3AED,#EC4899);
    background: var(--g-bg); color: var(--g-text); min-height: 100dvh; width: 100%;
    font-family: 'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    display: flex; position: relative;
  }
  .gen-app.gen-dark {
    --g-bg: #0B0B10; --g-card: #15151D; --g-border: rgba(255,255,255,0.08);
    --g-text: #F2F2F6; --g-sub: #9A9AA8; --g-mute: #6E6E7A; --g-hover: rgba(124,58,237,0.16);
  }
  .gen-app * { box-sizing: border-box; }
  .gen-app button { font-family: inherit; }
  .gen-app ::-webkit-scrollbar { width: 6px; height: 6px; }
  .gen-app ::-webkit-scrollbar-thumb { background: var(--g-border); border-radius: 10px; }

  /* Sidebar */
  .gen-sidebar { width: 264px; flex-shrink: 0; height: 100dvh; position: sticky; top: 0;
    border-right: 1px solid var(--g-border); padding: 20px 16px; display: flex; flex-direction: column; gap: 18px; }
  .gen-logo { display: flex; align-items: center; gap: 10px; padding: 4px 8px 10px; }
  .gen-logo-mark { width: 36px; height: 36px; border-radius: 10px; background: var(--g-grad);
    display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 18px; }
  .gen-logo-text { font-weight: 800; font-size: 15px; letter-spacing: 0.5px; }
  .gen-logo-sub { font-size: 10.5px; color: var(--g-sub); }
  .gen-nav { display: flex; flex-direction: column; gap: 3px; }
  .gen-nav-item { display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 12px;
    cursor: pointer; color: var(--g-text); font-size: 14.5px; font-weight: 600; background: none; border: none;
    text-align: left; width: 100%; position: relative; }
  .gen-nav-item:hover { background: var(--g-hover); }
  .gen-nav-item.active { background: var(--g-grad); color: #fff; }
  .gen-nav-badge { margin-left: auto; background: #EC4899; color: #fff; font-size: 10.5px; font-weight: 700;
    border-radius: 20px; padding: 1px 7px; }
  .gen-nav-item.active .gen-nav-badge { background: rgba(255,255,255,0.25); }
  .gen-create-btn { margin-top: 4px; background: var(--g-grad); border: none; border-radius: 14px; color: #fff;
    font-weight: 700; font-size: 14.5px; padding: 13px; display: flex; align-items: center; justify-content: center;
    gap: 8px; cursor: pointer; box-shadow: 0 8px 20px -8px rgba(124,58,237,0.6); }
  .gen-sidebar-spacer { flex: 1; }
  .gen-user-card { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 14px; cursor: pointer; }
  .gen-user-card:hover { background: var(--g-hover); }
  .gen-user-name { font-size: 13.5px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
  .gen-user-handle { font-size: 12px; color: var(--g-sub); }
  .gen-user-stats { display: flex; gap: 14px; padding: 2px 10px 0; font-size: 12px; color: var(--g-sub); }
  .gen-user-stats b { color: var(--g-text); }
  .gen-theme-pop { position: absolute; bottom: 100%; left: 16px; right: 16px; margin-bottom: 8px;
    background: var(--g-card); border: 1px solid var(--g-border); border-radius: 14px; box-shadow: 0 12px 30px rgba(0,0,0,0.18);
    padding: 6px; z-index: 40; }
  .gen-theme-opt { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; }
  .gen-theme-opt:hover { background: var(--g-hover); }

  /* Main */
  .gen-main { flex: 1; min-width: 0; max-width: 640px; border-right: 1px solid var(--g-border); min-height: 100dvh; }
  .gen-topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 14px 20px; background: color-mix(in srgb, var(--g-bg) 85%, transparent); backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--g-border); }
  .gen-topbar-title { font-size: 19px; font-weight: 800; }
  .gen-search-box { flex: 1; max-width: 320px; display: flex; align-items: center; gap: 8px; background: var(--g-hover);
    border-radius: 20px; padding: 9px 14px; cursor: pointer; }
  .gen-search-box input { border: none; background: none; outline: none; font-size: 13.5px; color: var(--g-text); width: 100%; cursor: pointer; }
  .gen-search-box input::placeholder { color: var(--g-mute); }

  .gen-stories-row { display: flex; gap: 16px; padding: 16px 20px; overflow-x: auto; border-bottom: 1px solid var(--g-border); }
  .gen-story { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; flex-shrink: 0; width: 64px; }
  .gen-story-ring { width: 60px; height: 60px; border-radius: 50%; padding: 2.5px; background: var(--g-grad); position: relative; }
  .gen-story-ring.seen { background: var(--g-border); }
  .gen-story-ring-inner { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 2.5px solid var(--g-card); background: var(--g-hover); }
  .gen-story-ring-inner img, .gen-story-ring-inner .gen-story-fallback { width: 100%; height: 100%; object-fit: cover; }
  .gen-story-add { position: absolute; bottom: -2px; right: -2px; width: 20px; height: 20px; border-radius: 50%; background: var(--g-grad);
    display: flex; align-items: center; justify-content: center; border: 2px solid var(--g-card); color: #fff; }
  .gen-story-label { font-size: 11px; color: var(--g-sub); text-align: center; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .gen-composer { display: flex; gap: 12px; padding: 16px 20px; border-bottom: 8px solid var(--g-bg); }
  .gen-composer-input { flex: 1; background: var(--g-hover); border-radius: 20px; padding: 12px 16px; color: var(--g-mute);
    font-size: 13.5px; cursor: pointer; display: flex; align-items: center; }
  .gen-composer-actions { display: flex; gap: 6px; padding: 0 20px 16px; border-bottom: 8px solid var(--g-bg); }
  .gen-composer-actions button { display: flex; align-items: center; gap: 6px; background: var(--g-hover); border: none;
    border-radius: 20px; padding: 7px 13px; font-size: 12.5px; font-weight: 700; color: var(--g-text); cursor: pointer; }
  .gen-composer-post { margin-left: auto; background: var(--g-grad) !important; color: #fff !important; padding: 7px 20px !important; }

  .gen-feed { display: flex; flex-direction: column; }
  .gen-empty-feed { padding: 60px 20px; text-align: center; color: var(--g-mute); font-size: 14px; }

  /* Post card */
  .gen-post { border-bottom: 1px solid var(--g-border); padding: 16px 20px 6px; }
  .gen-post-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .gen-post-name { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 4px; cursor: pointer; }
  .gen-post-meta { font-size: 12.5px; color: var(--g-sub); display: flex; gap: 6px; align-items: center; }
  .gen-post-more { margin-left: auto; background: none; border: none; cursor: pointer; color: var(--g-sub); padding: 6px; border-radius: 50%; position: relative; }
  .gen-post-more:hover { background: var(--g-hover); }
  .gen-post-text { font-size: 14.5px; line-height: 1.5; margin-bottom: 12px; white-space: pre-wrap; }
  .gen-post-media { border-radius: 16px; overflow: hidden; margin-bottom: 10px; background: var(--g-hover); position: relative; cursor: pointer; }
  .gen-post-media img, .gen-post-media video { width: 100%; max-height: 520px; object-fit: cover; display: block; }
  .gen-post-media-grid { display: grid; gap: 3px; border-radius: 16px; overflow: hidden; margin-bottom: 10px; cursor: pointer; }
  .gen-post-media-grid img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .gen-post-actions { display: flex; align-items: center; gap: 4px; padding: 4px 0 12px; color: var(--g-sub); }
  .gen-post-actions .grp { display: flex; align-items: center; gap: 5px; }
  .gen-post-actbtn { display: flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; color: var(--g-sub);
    font-size: 13px; font-weight: 600; padding: 7px 10px; border-radius: 10px; }
  .gen-post-actbtn:hover { background: var(--g-hover); }
  .gen-post-actbtn.liked { color: #EC4899; }
  .gen-post-actbtn.saved { color: #F5A623; }
  .gen-post-actbtn.right { margin-left: auto; }

  .gen-menu { position: absolute; top: 100%; right: 0; margin-top: 6px; width: 210px; background: var(--g-card);
    border: 1px solid var(--g-border); border-radius: 14px; box-shadow: 0 16px 40px rgba(0,0,0,0.2); z-index: 60; overflow: hidden; padding: 6px; }
  .gen-menu-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; font-size: 13px; font-weight: 600;
    color: var(--g-text); cursor: pointer; border-radius: 9px; }
  .gen-menu-item:hover { background: var(--g-hover); }
  .gen-menu-item.danger { color: #EF4444; }
  .gen-menu-sep { height: 1px; background: var(--g-border); margin: 5px 2px; }

  /* Right panel */
  .gen-right { width: 336px; flex-shrink: 0; padding: 20px 20px 20px 22px; display: flex; flex-direction: column; gap: 22px; height: 100dvh; overflow-y: auto; position: sticky; top: 0; }
  .gen-panel { background: var(--g-card); border: 1px solid var(--g-border); border-radius: 18px; padding: 16px; }
  .gen-panel-title { display: flex; align-items: center; justify-content: space-between; font-size: 15.5px; font-weight: 800; margin-bottom: 12px; }
  .gen-panel-link { font-size: 12.5px; color: var(--g-accent); font-weight: 700; cursor: pointer; }
  .gen-mini-stories { display: flex; gap: 10px; overflow-x: auto; }
  .gen-mini-story { flex-shrink: 0; width: 78px; height: 108px; border-radius: 12px; overflow: hidden; position: relative; cursor: pointer;
    background: var(--g-hover); }
  .gen-mini-story img { width: 100%; height: 100%; object-fit: cover; }
  .gen-mini-story::after { content:''; position:absolute; inset:0; background: linear-gradient(to top, rgba(0,0,0,0.65), transparent 55%); }
  .gen-mini-story-name { position: absolute; bottom: 6px; left: 6px; right: 6px; color: #fff; font-size: 10.5px; font-weight: 700; z-index: 2; }
  .gen-mini-story-ago { position: absolute; bottom: -2px; left: 6px; color: rgba(255,255,255,0.75); font-size: 9px; z-index: 2; }
  .gen-trend-row { padding: 9px 0; cursor: pointer; }
  .gen-trend-tag { font-size: 13.5px; font-weight: 700; }
  .gen-trend-count { font-size: 11.5px; color: var(--g-sub); }
  .gen-suggest-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
  .gen-suggest-info { flex: 1; min-width: 0; cursor: pointer; }
  .gen-suggest-name { font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gen-suggest-handle { font-size: 11.5px; color: var(--g-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gen-follow-btn { background: var(--g-text); color: var(--g-bg); border: none; border-radius: 20px; padding: 6px 14px;
    font-size: 12px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
  .gen-follow-btn.following { background: none; border: 1px solid var(--g-border); color: var(--g-text); }
  .gen-premium { background: linear-gradient(145deg,#1B1030,#3B0F4D); border-radius: 18px; padding: 20px; color: #fff; position: relative; overflow: hidden; }
  .gen-premium-crown { width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
  .gen-premium h4 { font-size: 16px; font-weight: 800; margin: 0 0 4px; }
  .gen-premium p { font-size: 12.5px; color: rgba(255,255,255,0.7); margin: 0 0 14px; }
  .gen-premium button { width: 100%; background: var(--g-grad); border: none; border-radius: 14px; padding: 11px; color: #fff; font-weight: 700; font-size: 13.5px; cursor: pointer; }

  /* mobile bottom nav */
  .gen-mobile-nav { display: none; }

  @media (max-width: 1150px) { .gen-right { display: none; } .gen-main { max-width: none; border-right: none; } }
  @media (max-width: 860px) {
    .gen-sidebar { display: none; }
    .gen-app { padding-bottom: 64px; }
    .gen-mobile-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: color-mix(in srgb, var(--g-card) 92%, transparent);
      backdrop-filter: blur(16px); border-top: 1px solid var(--g-border); padding: 8px 6px max(8px, env(safe-area-inset-bottom)); z-index: 50; }
    .gen-mobile-nav button { flex: 1; background: none; border: none; display: flex; align-items: center; justify-content: center; padding: 8px; cursor: pointer; }
    .gen-mobile-create { background: var(--g-grad) !important; border-radius: 12px !important; margin: 0 4px; }
  }

  /* modals (mobile-app style) */
  .gen-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 200; display: flex; align-items: center; justify-content: center; }
  .gen-modal-shell { width: 100%; max-width: 460px; height: 100dvh; max-height: 100dvh; background: var(--g-bg); color: var(--g-text);
    display: flex; flex-direction: column; overflow: hidden; }
  @media (min-width: 620px) { .gen-modal-shell { height: 92vh; max-height: 820px; border-radius: 22px; box-shadow: 0 30px 80px rgba(0,0,0,0.4); } }
  .gen-modal-topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--g-border); flex-shrink: 0; }
  .gen-modal-topbar .t { font-size: 15px; font-weight: 800; }
  .gen-modal-iconbtn { background: var(--g-hover); border: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--g-text); }
  .gen-modal-primary { background: var(--g-grad); color: #fff; border: none; border-radius: 18px; padding: 8px 16px; font-weight: 700; font-size: 13px; cursor: pointer; }
  .gen-modal-primary:disabled { opacity: 0.5; cursor: default; }
  .gen-modal-body { flex: 1; overflow-y: auto; }

  .gen-toolgrid { display: grid; grid-template-columns: repeat(6,1fr); gap: 4px; padding: 10px 12px; border-top: 1px solid var(--g-border); flex-shrink: 0; }
  .gen-toolgrid button { background: none; border: none; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 2px;
    color: var(--g-sub); font-size: 9.5px; cursor: pointer; border-radius: 10px; }
  .gen-toolgrid button:hover { background: var(--g-hover); }

  .gen-share-item { display: flex; align-items: center; gap: 14px; padding: 13px 16px; cursor: pointer; font-size: 14px; font-weight: 600; }
  .gen-share-item:hover { background: var(--g-hover); }
  .gen-share-icon { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
  `}</style>
);

/* ─────────────────────────── icon button w/ tiny label helper ─────────────────────────── */
const ToolBtn = ({ icon, label, onClick }) => (
  <button onClick={onClick} type="button">{icon}<span>{label}</span></button>
);

/* ─────────────────────────── Sidebar ─────────────────────────── */
export const GenSidebar = ({ currentUser, isDark, toggleTheme, onCreatePost, onNav, active, notifCount, msgCount }) => {
  const [showTheme, setShowTheme] = useState(false);
  const items = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: notifCount },
    { id: 'messages', label: 'Messages', icon: Mail, badge: msgCount },
    { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
    { id: 'communities', label: 'Communities', icon: Users },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'more', label: 'More', icon: MoreHorizontal },
  ];
  return (
    <aside className="gen-sidebar">
      <div className="gen-logo">
        <div className="gen-logo-mark">G</div>
        <div>
          <div className="gen-logo-text">GENERATION</div>
          <div className="gen-logo-sub">Express. Connect. Inspire.</div>
        </div>
      </div>

      <nav className="gen-nav">
        {items.map(it => (
          <button key={it.id} className={`gen-nav-item${active === it.id ? ' active' : ''}`} onClick={() => onNav(it.id)} type="button">
            <it.icon size={20} strokeWidth={active === it.id ? 2.4 : 2} />
            {it.label}
            {!!it.badge && <span className="gen-nav-badge">{it.badge > 99 ? '99+' : it.badge}</span>}
          </button>
        ))}
      </nav>

      <button className="gen-create-btn" onClick={onCreatePost} type="button">
        <Plus size={18} strokeWidth={2.6} /> Create Post
      </button>

      <div className="gen-sidebar-spacer" />

      <div style={{ position: 'relative' }}>
        {showTheme && (
          <div className="gen-theme-pop">
            <div className="gen-theme-opt" onClick={() => { if (isDark) toggleTheme(); setShowTheme(false); }}>
              <Sun size={16} /> Light
            </div>
            <div className="gen-theme-opt" onClick={() => { if (!isDark) toggleTheme(); setShowTheme(false); }}>
              <Moon size={16} /> Dark
            </div>
            <div className="gen-theme-opt" onClick={() => setShowTheme(false)}>
              <Monitor size={16} /> System
            </div>
          </div>
        )}
        <div className="gen-user-card" onClick={() => setShowTheme(v => !v)}>
          <GenAvatar user={currentUser} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="gen-user-name">{currentUser?.fullName || currentUser?.username || 'You'}{currentUser?.verified && <span style={{ color: '#7C3AED' }}>✓</span>}</div>
            <div className="gen-user-handle">@{currentUser?.username || 'you'}</div>
          </div>
          <ChevronDown size={16} color="var(--g-sub)" />
        </div>
        <div className="gen-user-stats">
          <span><b>{genFormatNumber((currentUser?.following || []).length)}</b> Following</span>
          <span><b>{genFormatNumber((currentUser?.followers || []).length)}</b> Followers</span>
        </div>
      </div>
    </aside>
  );
};

/* ─────────────────────────── Stories row (feed top) ─────────────────────────── */
export const GenStoriesRow = ({ storyUsers, currentUser, onOpenCreate, onMyStory, onView }) => {
  const mine = storyUsers.find(g => g.userId === currentUser?.id);
  const others = storyUsers.filter(g => g.userId !== currentUser?.id);
  return (
    <div className="gen-stories-row">
      <div className="gen-story" onClick={onMyStory}>
        <div className={`gen-story-ring${mine ? '' : ' seen'}`}>
          <div className="gen-story-ring-inner">
            {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> :
              <div className="gen-story-fallback" style={{ background: currentUser?.avatarColor || '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>{initials(currentUser?.username)}</div>}
          </div>
          {!mine && <div className="gen-story-add" onClick={(e) => { e.stopPropagation(); onOpenCreate?.(); }}><Plus size={12} strokeWidth={3} /></div>}
        </div>
        <div className="gen-story-label">Your story</div>
      </div>
      {others.map(g => (
        <div className="gen-story" key={g.userId} onClick={() => onView(g)}>
          <div className="gen-story-ring">
            <div className="gen-story-ring-inner">
              {g.avatarUrl ? <img src={g.avatarUrl} alt="" /> :
                <div className="gen-story-fallback" style={{ background: g.avatarColor || '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, width: '100%', height: '100%' }}>{initials(g.username)}</div>}
            </div>
          </div>
          <div className="gen-story-label">{g.username}</div>
        </div>
      ))}
      {others.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--g-mute)', fontSize: 12.5, paddingLeft: 4 }}>
          More stories
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────── Composer (opens create modal) ─────────────────────────── */
export const GenComposer = ({ currentUser, onOpenCreate }) => (
  <>
    <div className="gen-composer">
      <GenAvatar user={currentUser} size={40} />
      <div className="gen-composer-input" onClick={onOpenCreate}>What's happening?</div>
    </div>
    <div className="gen-composer-actions">
      <button onClick={onOpenCreate} type="button"><ImageIcon size={15} color="#7C3AED" /> Photo</button>
      <button onClick={onOpenCreate} type="button"><VideoIcon size={15} color="#EC4899" /> Video</button>
      <button onClick={onOpenCreate} type="button"><BarChart2 size={15} color="#F5A623" /> Poll</button>
      <button onClick={onOpenCreate} type="button"><Smile size={15} color="#3DB2FF" /> Feeling</button>
      <button className="gen-composer-post" onClick={onOpenCreate} type="button">Post</button>
    </div>
  </>
);

/* ─────────────────────────── Post media ─────────────────────────── */
const GenPostMedia = ({ video, onOpen }) => {
  const images = video.images && video.images.length > 1 ? video.images : null;
  const isVideo = !images && (video.mediaType?.startsWith('video') || /\.(mp4|webm|mov)/i.test(video.videoUrl || ''));
  if (images) {
    const count = Math.min(images.length, 4);
    const cols = count >= 3 ? 2 : count;
    return (
      <div className="gen-post-media-grid" style={{ gridTemplateColumns: `repeat(${cols},1fr)`, aspectRatio: count === 1 ? '16/10' : '4/3' }} onClick={onOpen}>
        {images.slice(0, 4).map((src, i) => <img key={i} src={src} alt="" />)}
      </div>
    );
  }
  return (
    <div className="gen-post-media" onClick={onOpen}>
      {isVideo ? (
        <video src={video.videoUrl} muted loop playsInline style={{ width: '100%', maxHeight: 520, objectFit: 'cover', display: 'block' }} />
      ) : (
        <img src={video.videoUrl} alt="" loading="lazy" />
      )}
    </div>
  );
};

/* ─────────────────────────── Post card ─────────────────────────── */
export const GenPostCard = ({ video, currentUser, users, onFollow, followed, onOpenPost, onOpenShare, onViewProfile, showToast, db, sendNotification }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [saved, setSaved] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const author = users?.find(u => u.id === video.userId);
  const isMine = video.userId === currentUser?.id;
  const isFollowing = (followed || []).includes(video.userId);

  useEffect(() => {
    if (!currentUser?.id) return;
    getDoc(doc(db, 'likes', `${video.id}_${currentUser.id}`)).then(d => setLiked(d.exists())).catch(() => {});
    getDoc(doc(db, 'saves', `${video.id}_${currentUser.id}`)).then(d => setSaved(d.exists())).catch(() => {});
  }, [video.id, currentUser?.id]);

  const toggleLike = async (e) => {
    e?.stopPropagation();
    if (!currentUser?.id) return;
    if (liked) {
      setLiked(false); setLikeCount(p => Math.max(0, p - 1));
      await deleteDoc(doc(db, 'likes', `${video.id}_${currentUser.id}`));
      await updateDoc(doc(db, 'videos', video.id), { likes: increment(-1) });
    } else {
      setLiked(true); setLikeCount(p => p + 1);
      await setDoc(doc(db, 'likes', `${video.id}_${currentUser.id}`), { videoId: video.id, userId: currentUser.id, createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'videos', video.id), { likes: increment(1) });
      if (video.userId !== currentUser.id) sendNotification?.(video.userId, currentUser.id, 'like', 'liked your post', { videoId: video.id });
    }
  };

  const toggleSave = async (e) => {
    e?.stopPropagation();
    if (!currentUser?.id) return;
    if (saved) {
      await deleteDoc(doc(db, 'saves', `${video.id}_${currentUser.id}`));
      setSaved(false); showToast?.('Removed from saved', 'info');
    } else {
      await setDoc(doc(db, 'saves', `${video.id}_${currentUser.id}`), { videoId: video.id, userId: currentUser.id, createdAt: serverTimestamp() });
      setSaved(true); showToast?.('Saved ✨', 'success');
    }
  };

  const doDownload = (e) => {
    e?.stopPropagation();
    const url = video.videoUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = ''; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    showToast?.('Downloading…', 'info');
  };

  const doRepost = async (e) => {
    e?.stopPropagation(); setShowMenu(false);
    await updateDoc(doc(db, 'videos', video.id), { shares: increment(1) }).catch(() => {});
    showToast?.('Reposted to your profile', 'success');
  };

  const copyLink = (e) => {
    e?.stopPropagation(); setShowMenu(false);
    navigator.clipboard?.writeText(`${window.location.origin}/post/${video.id}`);
    showToast?.('Link copied', 'success');
  };

  const doDelete = async (e) => {
    e?.stopPropagation(); setShowMenu(false);
    if (!confirm('Delete this post?')) return;
    await deleteDoc(doc(db, 'videos', video.id));
    showToast?.('Post deleted', 'success');
  };

  const menuRef = useRef(null);
  useEffect(() => {
    if (!showMenu) return;
    const close = (ev) => { if (menuRef.current && !menuRef.current.contains(ev.target)) setShowMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  return (
    <article className="gen-post">
      <div className="gen-post-head">
        <GenAvatar user={author || video} size={42} onClick={() => onViewProfile?.(video.userId)} />
        <div style={{ minWidth: 0 }}>
          <div className="gen-post-name" onClick={() => onViewProfile?.(video.userId)}>
            {video.username || author?.username || 'user'}
            {(author?.verified || video.verified) && <span style={{ color: '#7C3AED' }}>✓</span>}
          </div>
          <div className="gen-post-meta">
            <span>@{video.username || author?.username}</span>·<span>{timeAgo(video.createdAt)}</span>
          </div>
        </div>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button className="gen-post-more" onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }} type="button">
            <MoreHorizontal size={19} />
          </button>
          {showMenu && (
            <div className="gen-menu" onClick={(e) => e.stopPropagation()}>
              {isMine && <div className="gen-menu-item" onClick={() => { setShowMenu(false); showToast?.('Edit coming soon', 'info'); }}><Edit2 size={15} /> Edit</div>}
              {isMine && <div className="gen-menu-item" onClick={() => { setShowMenu(false); showToast?.('Pinned to profile', 'success'); }}><Pin size={15} /> Pin Post</div>}
              <div className="gen-menu-item" onClick={copyLink}><Link2 size={15} /> Copy Link</div>
              <div className="gen-menu-item" onClick={doRepost}><Repeat2 size={15} /> Repost</div>
              <div className="gen-menu-item" onClick={() => { setShowMenu(false); onOpenShare?.(video); }}><Send size={15} /> Send to Friends</div>
              <div className="gen-menu-item" onClick={() => { setShowMenu(false); toggleSave(); }}><FolderPlus size={15} /> Add to Collection</div>
              <div className="gen-menu-sep" />
              {!isMine && <div className="gen-menu-item" onClick={() => { setShowMenu(false); showToast?.(`Muted @${video.username}`, 'info'); }}><VolumeX size={15} /> Mute {video.username}</div>}
              {!isMine && <div className="gen-menu-item danger" onClick={() => { setShowMenu(false); showToast?.(`Blocked @${video.username}`, 'info'); }}><Ban size={15} /> Block {video.username}</div>}
              <div className="gen-menu-item danger" onClick={() => { setShowMenu(false); showToast?.('Reported. Thanks for flagging.', 'success'); }}><Flag size={15} /> Report</div>
              {isMine && <div className="gen-menu-item danger" onClick={doDelete}><MoreHorizontal size={15} /> Delete Post</div>}
            </div>
          )}
        </div>
      </div>

      {video.description && <div className="gen-post-text">{video.description}</div>}
      {video.videoUrl && <GenPostMedia video={video} onOpen={() => onOpenPost(video)} />}

      <div className="gen-post-actions">
        <div className="grp">
          <button className={`gen-post-actbtn${liked ? ' liked' : ''}`} onClick={toggleLike} type="button">
            <Heart size={18} fill={liked ? '#EC4899' : 'none'} /> {genFormatNumber(likeCount)}
          </button>
        </div>
        <div className="grp">
          <button className="gen-post-actbtn" onClick={() => onOpenPost(video)} type="button">
            <MessageCircle size={18} /> {genFormatNumber(video.comments)}
          </button>
        </div>
        <div className="grp">
          <button className="gen-post-actbtn" onClick={(e) => { e.stopPropagation(); onOpenShare?.(video); }} type="button">
            <Share2 size={18} /> {genFormatNumber(video.shares)}
          </button>
        </div>
        <button className={`gen-post-actbtn${saved ? ' saved' : ''}`} onClick={toggleSave} type="button">
          <Bookmark size={18} fill={saved ? '#F5A623' : 'none'} />
        </button>
        <button className="gen-post-actbtn right" onClick={doDownload} type="button">
          <Download size={17} />
        </button>
      </div>
    </article>
  );
};

/* ─────────────────────────── Right panel ─────────────────────────── */
const TRENDING_STATIC = [
  { tag: '#GoodVibesOnly', count: '24.5K' },
  { tag: '#WeekendDiaries', count: '18.7K' },
  { tag: '#NewBeginnings', count: '12.3K' },
];

export const GenRightPanel = ({ storyUsers, users, currentUser, followed, onFollow, onViewProfile, videos, onOpenStoryViewer, onOpenPremium, onSeeAllStories }) => {
  const suggestions = useMemo(() => {
    return (users || [])
      .filter(u => u.id !== currentUser?.id && !(followed || []).includes(u.id))
      .slice(0, 4);
  }, [users, currentUser?.id, followed]);

  const trending = useMemo(() => {
    const counts = {};
    (videos || []).forEach(v => (v.hashtags || []).forEach(h => { counts[h] = (counts[h] || 0) + 1; }));
    const dynamic = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag, n]) => ({ tag, count: `${n} post${n === 1 ? '' : 's'}` }));
    return dynamic.length ? dynamic : TRENDING_STATIC;
  }, [videos]);

  return (
    <aside className="gen-right">
      <div className="gen-panel">
        <div className="gen-panel-title">Stories <span className="gen-panel-link" onClick={onSeeAllStories}>See all</span></div>
        <div className="gen-mini-stories">
          {storyUsers.slice(0, 6).map((g, i) => (
            <div key={g.userId} className="gen-mini-story" onClick={() => onOpenStoryViewer?.({ groups: storyUsers, startIdx: i })}>
              {g.avatarUrl ? <img src={g.avatarUrl} alt="" /> : <div style={{ width: '100%', height: '100%', background: g.avatarColor || '#7C3AED' }} />}
              <div className="gen-mini-story-name">{g.username}</div>
            </div>
          ))}
          {storyUsers.length === 0 && <div style={{ color: 'var(--g-mute)', fontSize: 12.5, padding: '10px 0' }}>No stories yet</div>}
        </div>
      </div>

      <div className="gen-panel">
        <div className="gen-panel-title">Trending for you</div>
        {trending.map(tr => (
          <div className="gen-trend-row" key={tr.tag}>
            <div className="gen-trend-tag">{tr.tag}</div>
            <div className="gen-trend-count">{tr.count} posts</div>
          </div>
        ))}
        <div className="gen-panel-link" style={{ marginTop: 4 }}>Show more</div>
      </div>

      <div className="gen-panel">
        <div className="gen-panel-title">Suggested for you</div>
        {suggestions.map(u => (
          <div className="gen-suggest-row" key={u.id}>
            <GenAvatar user={u} size={38} onClick={() => onViewProfile?.(u.id)} />
            <div className="gen-suggest-info" onClick={() => onViewProfile?.(u.id)}>
              <div className="gen-suggest-name">{u.fullName || u.username}</div>
              <div className="gen-suggest-handle">@{u.username}</div>
            </div>
            <button className="gen-follow-btn" onClick={() => onFollow(u.id)} type="button">Follow</button>
          </div>
        ))}
        {suggestions.length === 0 && <div style={{ color: 'var(--g-mute)', fontSize: 12.5 }}>You're following everyone!</div>}
        {suggestions.length > 0 && <div className="gen-panel-link" style={{ marginTop: 4 }}>Show more</div>}
      </div>

      <div className="gen-premium">
        <div className="gen-premium-crown"><Crown size={20} color="#F5C451" /></div>
        <h4>Go Premium</h4>
        <p>Unlock exclusive features and premium content.</p>
        <button onClick={onOpenPremium} type="button">Upgrade Now</button>
      </div>
    </aside>
  );
};

/* ─────────────────────────── Post detail modal ─────────────────────────── */
export const GenPostDetailModal = ({ video, currentUser, onClose, onViewProfile, showToast, db, sendNotification, users }) => {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [saved, setSaved] = useState(false);
  const author = users?.find(u => u.id === video.userId);

  useEffect(() => {
    const q = query(collection(db, 'comments'), where('videoId', '==', video.id), orderBy('createdAt', 'asc'), limit(200));
    const unsub = onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => unsub();
  }, [video.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    getDoc(doc(db, 'likes', `${video.id}_${currentUser.id}`)).then(d => setLiked(d.exists())).catch(() => {});
    getDoc(doc(db, 'saves', `${video.id}_${currentUser.id}`)).then(d => setSaved(d.exists())).catch(() => {});
  }, [video.id, currentUser?.id]);

  const toggleLike = async () => {
    if (!currentUser?.id) return;
    if (liked) {
      setLiked(false); setLikeCount(p => Math.max(0, p - 1));
      await deleteDoc(doc(db, 'likes', `${video.id}_${currentUser.id}`));
      await updateDoc(doc(db, 'videos', video.id), { likes: increment(-1) });
    } else {
      setLiked(true); setLikeCount(p => p + 1);
      await setDoc(doc(db, 'likes', `${video.id}_${currentUser.id}`), { videoId: video.id, userId: currentUser.id, createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'videos', video.id), { likes: increment(1) });
      if (video.userId !== currentUser.id) sendNotification?.(video.userId, currentUser.id, 'like', 'liked your post', { videoId: video.id });
    }
  };

  const toggleSave = async () => {
    if (!currentUser?.id) return;
    if (saved) { await deleteDoc(doc(db, 'saves', `${video.id}_${currentUser.id}`)); setSaved(false); }
    else { await setDoc(doc(db, 'saves', `${video.id}_${currentUser.id}`), { videoId: video.id, userId: currentUser.id, createdAt: serverTimestamp() }); setSaved(true); }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !currentUser?.id) return;
    const txt = commentText; setCommentText('');
    await addDoc(collection(db, 'comments'), {
      videoId: video.id, userId: currentUser.id, username: currentUser.username,
      avatar: currentUser.avatar || initials(currentUser.username), avatarColor: currentUser.avatarColor || '#7C3AED',
      avatarUrl: currentUser.avatarUrl || null, text: txt, likes: 0, createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'videos', video.id), { comments: increment(1) });
    if (video.userId !== currentUser.id) sendNotification?.(video.userId, currentUser.id, 'comment', 'commented on your post', { videoId: video.id });
  };

  return (
    <div className="gen-modal-overlay" onClick={onClose}>
      <div className="gen-modal-shell" onClick={e => e.stopPropagation()}>
        <div className="gen-modal-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="gen-modal-iconbtn" onClick={onClose} type="button"><ArrowLeft size={17} /></button>
            <GenAvatar user={author || video} size={30} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{video.username}</div>
              <div style={{ fontSize: 11, color: 'var(--g-sub)' }}>@{video.username}</div>
            </div>
          </div>
          <button className="gen-modal-iconbtn" type="button" onClick={() => showToast?.('More options', 'info')}><MoreHorizontal size={17} /></button>
        </div>

        <div className="gen-modal-body">
          {video.description && <div style={{ padding: '14px 16px 0', fontSize: 14, lineHeight: 1.5 }}>{video.description}</div>}
          {video.videoUrl && <div style={{ padding: 14 }}><GenPostMedia video={video} onOpen={() => {}} /></div>}

          <div style={{ display: 'flex', gap: 4, padding: '0 14px 8px', color: 'var(--g-sub)' }}>
            <button className={`gen-post-actbtn${liked ? ' liked' : ''}`} onClick={toggleLike} type="button"><Heart size={17} fill={liked ? '#EC4899' : 'none'} /> {genFormatNumber(likeCount)}</button>
            <button className="gen-post-actbtn" type="button"><MessageCircle size={17} /> {genFormatNumber(comments.length)}</button>
            <button className="gen-post-actbtn" type="button"><Share2 size={17} /> {genFormatNumber(video.shares)}</button>
            <button className={`gen-post-actbtn${saved ? ' saved' : ''}`} onClick={toggleSave} type="button"><Bookmark size={17} fill={saved ? '#F5A623' : 'none'} /></button>
          </div>

          <div style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: 'var(--g-sub)', borderTop: '8px solid var(--g-hover)' }}>
            Comments ({comments.length})
          </div>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, padding: '8px 16px' }}>
              <GenAvatar user={c} size={30} onClick={() => onViewProfile?.(c.userId)} />
              <div>
                <div style={{ fontSize: 12.5 }}><b>{c.username}</b> <span style={{ color: 'var(--g-mute)', fontWeight: 400 }}>{timeAgo(c.createdAt)}</span></div>
                <div style={{ fontSize: 13.5, marginTop: 2 }}>{c.text}</div>
              </div>
            </div>
          ))}
          {comments.length === 0 && <div style={{ padding: '20px 16px', color: 'var(--g-mute)', fontSize: 13 }}>No comments yet. Say something!</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--g-border)', alignItems: 'center', flexShrink: 0 }}>
          <GenAvatar user={currentUser} size={30} />
          <input
            value={commentText} onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitComment(); }}
            placeholder="Add a comment…"
            style={{ flex: 1, background: 'var(--g-hover)', border: 'none', borderRadius: 20, padding: '10px 14px', fontSize: 13.5, color: 'var(--g-text)', outline: 'none' }}
          />
          <button className="gen-modal-iconbtn" onClick={submitComment} type="button"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────── Create post modal ─────────────────────────── */
export const GenCreatePostModal = ({ currentUser, onClose, showToast, db, uploadToCloudinary }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]); // {file, url, type}
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const pickFiles = (accept) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.multiple = true;
    inp.onchange = (e) => {
      const list = Array.from(e.target.files || []).map(f => ({ file: f, url: URL.createObjectURL(f), type: f.type }));
      setFiles(prev => [...prev, ...list].slice(0, 4));
    };
    inp.click();
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!text.trim() && files.length === 0) { showToast?.('Write something or add media', 'error'); return; }
    setPosting(true); setProgress(0);
    try {
      let videoData;
      if (files.length > 1) {
        const urls = [];
        for (let i = 0; i < files.length; i++) {
          const u = await uploadToCloudinary(files[i].file, p => setProgress(Math.round(((i + p / 100) / files.length) * 100)));
          urls.push(u);
        }
        videoData = {
          userId: currentUser.id, username: currentUser.username || '',
          avatar: currentUser.avatar || initials(currentUser.username), avatarColor: currentUser.avatarColor || '#7C3AED',
          avatarUrl: currentUser.avatarUrl || null, verified: currentUser.verified || false,
          description: text, videoUrl: urls[0], images: urls, mediaType: 'image/multi',
          song: 'Original sound', likes: 0, comments: 0, shares: 0, views: 0,
          hashtags: (text || '').match(/#\w+/g) || [], category: 'foryou', createdAt: serverTimestamp(),
        };
      } else if (files.length === 1) {
        const mediaUrl = await uploadToCloudinary(files[0].file, setProgress);
        videoData = {
          userId: currentUser.id, username: currentUser.username || '',
          avatar: currentUser.avatar || initials(currentUser.username), avatarColor: currentUser.avatarColor || '#7C3AED',
          avatarUrl: currentUser.avatarUrl || null, verified: currentUser.verified || false,
          description: text, videoUrl: mediaUrl, mediaType: files[0].type,
          song: 'Original sound', likes: 0, comments: 0, shares: 0, views: 0,
          hashtags: (text || '').match(/#\w+/g) || [], category: 'foryou', createdAt: serverTimestamp(),
        };
      } else {
        videoData = {
          userId: currentUser.id, username: currentUser.username || '',
          avatar: currentUser.avatar || initials(currentUser.username), avatarColor: currentUser.avatarColor || '#7C3AED',
          avatarUrl: currentUser.avatarUrl || null, verified: currentUser.verified || false,
          description: text, videoUrl: '', mediaType: 'text',
          song: '', likes: 0, comments: 0, shares: 0, views: 0,
          hashtags: (text || '').match(/#\w+/g) || [], category: 'foryou', createdAt: serverTimestamp(),
        };
      }
      await addDoc(collection(db, 'videos'), videoData);
      showToast?.('Posted! 🚀', 'success');
      onClose();
    } catch (e) {
      showToast?.('Post failed: ' + (e?.message || 'try again'), 'error');
    }
    setPosting(false);
  };

  const tools = [
    { icon: <MessageCircle size={18} />, label: 'Chat' },
    { icon: <MousePointer2 size={18} />, label: 'Mouse' },
    { icon: <Share2 size={18} />, label: 'Share', onClick: () => showToast?.('Share after posting', 'info') },
    { icon: <ImageIcon size={18} />, label: 'Multiple', onClick: () => pickFiles('image/*') },
    { icon: <Feather size={18} />, label: 'Leaf' },
    { icon: <Edit2 size={18} />, label: 'Edit' },
    { icon: <Feather size={18} />, label: 'Feather' },
    { icon: <Bookmark size={18} />, label: 'Save' },
    { icon: <MessageCircle size={18} />, label: 'Comment' },
    { icon: <Heart size={18} />, label: 'Like' },
    { icon: <Download size={18} />, label: 'Download' },
    { icon: <Flag size={18} />, label: 'Report' },
  ];

  return (
    <div className="gen-modal-overlay" onClick={onClose}>
      <div className="gen-modal-shell" onClick={e => e.stopPropagation()}>
        <div className="gen-modal-topbar">
          <button className="gen-modal-iconbtn" onClick={onClose} type="button" style={{ width: 'auto', borderRadius: 20, padding: '0 12px', fontSize: 13, fontWeight: 700 }}>Cancel</button>
          <div className="t">Create Post</div>
          <button className="gen-modal-primary" onClick={submit} disabled={posting} type="button">{posting ? `${progress}%` : 'Post'}</button>
        </div>

        <div className="gen-modal-body">
          <div style={{ display: 'flex', gap: 12, padding: 16 }}>
            <GenAvatar user={currentUser} size={40} />
            <textarea
              value={text} onChange={e => setText(e.target.value)} placeholder="What's happening?"
              rows={4}
              style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', background: 'none', color: 'var(--g-text)', fontSize: 15, fontFamily: 'inherit' }}
            />
          </div>

          {files.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(files.length + 1, 4)},1fr)`, gap: 8, padding: '0 16px 8px' }}>
              {files.map((f, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1/1', background: 'var(--g-hover)' }}>
                  {f.type.startsWith('video') ? <video src={f.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={f.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                  <button onClick={() => removeFile(i)} type="button" style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', cursor: 'pointer' }}><X size={13} /></button>
                </div>
              ))}
              {files.length < 4 && (
                <button onClick={() => pickFiles('image/*,video/*')} type="button" style={{ aspectRatio: '1/1', borderRadius: 12, border: '1.5px dashed var(--g-border)', background: 'none', color: 'var(--g-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={22} />
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, padding: '4px 16px 16px' }}>
            <button onClick={() => pickFiles('image/*')} type="button" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--g-hover)', border: 'none', borderRadius: 20, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--g-text)', cursor: 'pointer' }}><ImageIcon size={15} color="#7C3AED" /> Photo</button>
            <button onClick={() => pickFiles('video/*')} type="button" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--g-hover)', border: 'none', borderRadius: 20, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--g-text)', cursor: 'pointer' }}><VideoIcon size={15} color="#EC4899" /> Video</button>
            <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--g-hover)', border: 'none', borderRadius: 20, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--g-text)', cursor: 'pointer' }} onClick={() => showToast?.('Poll builder coming soon', 'info')}><BarChart2 size={15} color="#F5A623" /> Poll</button>
            <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--g-hover)', border: 'none', borderRadius: 20, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--g-text)', cursor: 'pointer' }} onClick={() => showToast?.('Feeling tag coming soon', 'info')}><Smile size={15} color="#3DB2FF" /> Feeling</button>
          </div>

          <div style={{ padding: '0 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--g-border)', paddingTop: 14 }}>
            <span style={{ fontSize: 12.5, color: 'var(--g-sub)' }}>Who can see this?</span>
            <span style={{ fontSize: 12.5, color: 'var(--g-accent)', fontWeight: 700, cursor: 'pointer' }}>Everyone</span>
          </div>
        </div>

        <div className="gen-toolgrid">
          {tools.map((tItem, i) => <ToolBtn key={i} icon={tItem.icon} label={tItem.label} onClick={tItem.onClick} />)}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────── Share sheet ─────────────────────────── */
export const GenShareSheetLight = ({ video, currentUser, onClose, showToast, db }) => {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/post/${video.id}` : '';
  const bump = () => updateDoc(doc(db, 'videos', video.id), { shares: increment(1) }).catch(() => {});
  const items = [
    { name: 'Copy link', color: '#6B6B78', icon: <Copy size={16} />, fn: () => { navigator.clipboard?.writeText(url); showToast?.('Link copied', 'success'); bump(); } },
    { name: 'WhatsApp', color: '#25D366', icon: <Send size={16} />, fn: () => { window.open(`https://wa.me/?text=${encodeURIComponent(url)}`); bump(); } },
    { name: 'Twitter', color: '#1DA1F2', icon: <Share2 size={16} />, fn: () => { window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`); bump(); } },
    { name: 'Facebook', color: '#1877F2', icon: <Share2 size={16} />, fn: () => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`); bump(); } },
  ];
  return (
    <div className="gen-modal-overlay" onClick={onClose}>
      <div className="gen-modal-shell" style={{ height: 'auto', maxHeight: '70vh' }} onClick={e => e.stopPropagation()}>
        <div className="gen-modal-topbar">
          <button className="gen-modal-iconbtn" onClick={onClose} type="button" style={{ width: 'auto', borderRadius: 20, padding: '0 12px', fontSize: 13, fontWeight: 700 }}>Cancel</button>
          <div className="t">Share</div>
          <div style={{ width: 34 }} />
        </div>
        <div className="gen-modal-body">
          <div style={{ display: 'flex', gap: 10, padding: 14, borderBottom: '1px solid var(--g-border)' }}>
            {video.videoUrl && <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--g-hover)' }}><img src={video.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /></div>}
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>{video.description || 'Shared post'} <span style={{ color: 'var(--g-mute)' }}>by {video.username}</span></div>
          </div>
          <div style={{ padding: '10px 16px 4px', fontSize: 12.5, fontWeight: 700, color: 'var(--g-sub)' }}>Share to</div>
          {items.map(it => (
            <div className="gen-share-item" key={it.name} onClick={() => { it.fn(); }}>
              <div className="gen-share-icon" style={{ background: it.color }}>{it.icon}</div>
              {it.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────── Orchestrator ─────────────────────────── */
export const GenerationHome = ({
  currentUser, users, videos, followed, onFollow, showToast, onViewProfile,
  setActiveTab, onOpenExplore, onOpenNotifications, onOpenBookmarks,
  onOpenCreateStory, onOpenStoryViewer, isDark, toggleTheme,
  db, uploadToCloudinary, sendNotification, notifCount, msgCount,
}) => {
  const [storyUsers, setStoryUsers] = useState([]);
  const [detailPost, setDetailPost] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [shareVideo, setShareVideo] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date();
        const snap = await getDocs(query(collection(db, 'stories'), orderBy('createdAt', 'desc')));
        const byUser = {};
        snap.docs.forEach(d => {
          const data = d.data();
          const exp = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
          if (exp < now) return;
          if (!byUser[data.userId]) byUser[data.userId] = { userId: data.userId, stories: [] };
          byUser[data.userId].stories.push({ id: d.id, ...data });
        });
        const result = Object.values(byUser).map(g => {
          const u = users.find(x => x.id === g.userId);
          return { ...g, username: u?.username || g.stories[0]?.username || 'user', avatarColor: u?.avatarColor || g.stories[0]?.avatarColor, avatarUrl: u?.avatarUrl || g.stories[0]?.avatarUrl };
        });
        setStoryUsers(result);
      } catch {}
    };
    load();
  }, [users, db]);

  const handleMyStory = () => {
    const mine = storyUsers.find(g => g.userId === currentUser?.id);
    if (mine) onOpenStoryViewer?.({ groups: storyUsers, startIdx: storyUsers.findIndex(g => g.userId === currentUser?.id) });
    else onOpenCreateStory?.();
  };

  return (
    <div className={`gen-app${isDark ? ' gen-dark' : ''}`}>
      <GenGlobalCSS />
      <GenSidebar
        currentUser={currentUser}
        isDark={isDark}
        toggleTheme={toggleTheme}
        active="home"
        notifCount={notifCount}
        msgCount={msgCount}
        onCreatePost={() => setShowCreate(true)}
        onNav={(id) => {
          if (id === 'home') return;
          if (id === 'explore') onOpenExplore?.();
          else if (id === 'notifications') onOpenNotifications?.();
          else if (id === 'messages') setActiveTab?.('inbox');
          else if (id === 'bookmarks') onOpenBookmarks?.();
          else if (id === 'communities') showToast?.('Communities coming soon', 'info');
          else if (id === 'profile') setActiveTab?.('profile');
          else if (id === 'more') showToast?.('More options coming soon', 'info');
        }}
      />

      <main className="gen-main">
        <div className="gen-topbar">
          <div className="gen-topbar-title">Home</div>
          <div className="gen-search-box" onClick={() => onOpenExplore?.()}>
            <Search size={15} color="var(--g-mute)" />
            <input placeholder="Search Generation" readOnly />
          </div>
        </div>

        <GenStoriesRow
          storyUsers={storyUsers}
          currentUser={currentUser}
          onOpenCreate={onOpenCreateStory}
          onMyStory={handleMyStory}
          onView={(g) => onOpenStoryViewer?.({ groups: storyUsers, startIdx: storyUsers.findIndex(x => x.userId === g.userId) })}
        />

        <GenComposer currentUser={currentUser} onOpenCreate={() => setShowCreate(true)} />

        <div className="gen-feed">
          {videos.length === 0 && <div className="gen-empty-feed">No posts yet. Be the first to share something!</div>}
          {videos.map(v => (
            <GenPostCard
              key={v.id}
              video={v}
              currentUser={currentUser}
              users={users}
              followed={followed}
              onFollow={onFollow}
              onOpenPost={setDetailPost}
              onOpenShare={setShareVideo}
              onViewProfile={onViewProfile}
              showToast={showToast}
              db={db}
              sendNotification={sendNotification}
            />
          ))}
        </div>
      </main>

      <GenRightPanel
        storyUsers={storyUsers}
        users={users}
        currentUser={currentUser}
        followed={followed}
        onFollow={onFollow}
        onViewProfile={onViewProfile}
        videos={videos}
        onOpenStoryViewer={onOpenStoryViewer}
        onSeeAllStories={() => storyUsers.length && onOpenStoryViewer?.({ groups: storyUsers, startIdx: 0 })}
        onOpenPremium={() => showToast?.('Premium plans coming soon ✨', 'info')}
      />

      <nav className="gen-mobile-nav">
        <button className="active" type="button"><Home size={21} color="#7C3AED" /></button>
        <button onClick={() => onOpenExplore?.()} type="button"><Compass size={21} color="var(--g-sub)" /></button>
        <button className="gen-mobile-create" onClick={() => setShowCreate(true)} type="button"><Plus size={21} color="#fff" /></button>
        <button onClick={() => setActiveTab?.('inbox')} type="button"><Mail size={21} color="var(--g-sub)" /></button>
        <button onClick={() => setActiveTab?.('profile')} type="button"><User size={21} color="var(--g-sub)" /></button>
      </nav>

      {detailPost && (
        <GenPostDetailModal video={detailPost} currentUser={currentUser} users={users} onClose={() => setDetailPost(null)} onViewProfile={onViewProfile} showToast={showToast} db={db} sendNotification={sendNotification} />
      )}
      {showCreate && (
        <GenCreatePostModal currentUser={currentUser} onClose={() => setShowCreate(false)} showToast={showToast} db={db} uploadToCloudinary={uploadToCloudinary} />
      )}
      {shareVideo && (
        <GenShareSheetLight video={shareVideo} currentUser={currentUser} onClose={() => setShareVideo(null)} showToast={showToast} db={db} />
      )}
    </div>
  );
};

export default GenerationHome;
