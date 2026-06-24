'use client';

import { useMemo, useState } from 'react';
import { Search, TrendingUp, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
import { snapshotTo } from '@/lib/firebase/converters';
import { trendingTags } from '@/lib/ai/trends';
import { Avatar } from '@/components/Avatar';
import { cn, formatCount } from '@/lib/utils/cn';
import type { UserProfile, VideoPost } from '@/types';
import { useUIStore } from '@/stores/uiStore';

/**
 * Semantic-ish search: tokenises the query, expands synonyms for common
 * social terms, and ranks results by combined tag + caption + username
 * match count. Better than substring match, simpler than embedding.
 */
function tokenScore(text: string, tokens: string[]): number {
  if (!text || tokens.length === 0) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (lower.includes(t)) score += 1;
  }
  return score;
}

const SYNONYMS: Record<string, string[]> = {
  dance: ['dance', 'dancing', 'choreo', 'tiktok'],
  food: ['food', 'cooking', 'recipe', 'foodie', 'eat'],
  travel: ['travel', 'trip', 'vacation', 'wander'],
  music: ['music', 'song', 'remix', 'beat', 'sound'],
  funny: ['funny', 'comedy', 'lol', 'meme', 'humor'],
  fitness: ['fitness', 'workout', 'gym', 'exercise', 'trainer'],
  tech: ['tech', 'coding', 'ai', 'software', 'developer'],
};

function expandTokens(query: string): string[] {
  const lower = query.toLowerCase().trim();
  const base = lower.split(/\s+/).filter(Boolean);
  const expanded = new Set(base);
  for (const token of base) {
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (syns.includes(token)) expanded.add(key);
    }
  }
  return Array.from(expanded);
}

export function DiscoverScreen() {
  const [query, setQuery] = useState('');
  const showToast = useUIStore(s => s.showToast);
  const tokens = useMemo(() => expandTokens(query), [query]);

  const { data: videos = [] } = useQuery<VideoPost[]>({
    queryKey: ['discover-videos'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(firebaseDb(), 'videos'), orderBy('createdAt', 'desc'), limit(50)));
      return snap.docs.map(d => snapshotTo<VideoPost>(d));
    },
  });

  const { data: users = [] } = useQuery<UserProfile[]>({
    queryKey: ['discover-users'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(firebaseDb(), 'users'), limit(30)));
      return snap.docs.map(d => ({ ...(d.data() as UserProfile), id: d.id }));
    },
  });

  const trending = useMemo(() => trendingTags(videos, 8), [videos]);

  const rankedVideos = useMemo(() => {
    if (!tokens.length) return videos.slice(0, 12);
    return videos
      .map(v => ({
        v,
        score:
          tokenScore(v.description, tokens) * 2 +
          tokenScore(v.hashtags.join(' '), tokens) * 3 +
          tokenScore(v.username, tokens),
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.v)
      .slice(0, 24);
  }, [videos, tokens]);

  const rankedUsers = useMemo(() => {
    if (!tokens.length) return [];
    return users
      .map(u => ({
        u,
        score: tokenScore(u.username, tokens) + tokenScore(u.bio, tokens) * 0.5,
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.u)
      .slice(0, 20);
  }, [users, tokens]);

  return (
    <div className="h-full overflow-y-auto bg-bg-base">
      <header className="sticky top-0 z-10 border-b border-white/6 bg-bg-base/95 p-4 backdrop-blur">
        <h1 className="mb-3 text-xl font-extrabold">Discover</h1>
        <label className="flex items-center gap-2 rounded-full bg-white/6 px-4 py-2.5">
          <Search className="h-4 w-4 text-white/40" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search videos, people, hashtags…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
            aria-label="Search"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-xs text-white/40">
              ✕
            </button>
          )}
        </label>
      </header>

      <div className="px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/40">
          <TrendingUp className="h-3.5 w-3.5" />
          Trending
        </div>
        <div className="flex flex-wrap gap-1.5">
          {trending.length === 0 ? (
            <span className="text-xs text-white/30">No trends yet</span>
          ) : (
            trending.map(t => (
              <button
                key={t.tag}
                type="button"
                onClick={() => setQuery(t.tag.replace('#', ''))}
                className="rounded-full bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent"
              >
                {t.tag}
                <span className="ml-1 text-accent/60">{t.posts}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {!query && (
        <div className="px-4 py-2">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/40">
            <Sparkles className="h-3.5 w-3.5" />
            Suggested creators
          </div>
          <div className="space-y-2">
            {users.slice(0, 8).map(u => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-white/4 p-3">
                <Avatar name={u.username} color={u.avatarColor} src={u.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-bold">@{u.username}</div>
                  <div className="truncate text-xs text-white/40">{formatCount(u.followers.length)} followers</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {query && rankedUsers.length > 0 && (
        <section className="px-4 py-2">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">People</h3>
          <div className="space-y-2">
            {rankedUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-white/4 p-3">
                <Avatar name={u.username} color={u.avatarColor} src={u.avatarUrl} size="md" />
                <div className="flex-1">
                  <div className="text-sm font-bold">@{u.username}</div>
                  <div className="text-xs text-white/40">{formatCount(u.followers.length)} followers</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {query && (
        <section className="px-4 py-2">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">Videos</h3>
          {rankedVideos.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/40">No results — try a different search.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {rankedVideos.map(v => {
                const isImage = v.media.kind === 'image' || !!v.images;
                return (
                  <div key={v.id} className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-bg-elev2">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.images?.[0] ?? v.media.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <video src={v.media.url} className="h-full w-full object-cover" muted />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
                      <div className="truncate text-xs font-bold">@{v.username}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
