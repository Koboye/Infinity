import type { TrendingTopic, UserProfile, VideoPost } from '@/types';

const HOURS = (iso: string) => Math.max(1, (Date.now() - new Date(iso).getTime()) / 3_600_000);

export function rankVideos(posts: VideoPost[], viewer?: Pick<UserProfile, 'id' | 'following'> | null): VideoPost[] {
  const followed = new Set(viewer?.following ?? []);
  return posts
    .map(p => {
      const engagement = p.likes + p.comments * 2 + p.shares * 3;
      const decay = Math.pow(HOURS(p.createdAt) + 2, 1.5);
      const boost = followed.has(p.userId) ? 1.5 : 1;
      return { p, score: (engagement / decay) * boost };
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.p);
}

export function trendingTags(posts: VideoPost[], limit = 10): TrendingTopic[] {
  const counts = new Map<string, { count: number; last24h: number }>();
  const dayAgo = Date.now() - 86_400_000;
  for (const p of posts) {
    for (const tag of p.hashtags ?? []) {
      const e = counts.get(tag) ?? { count: 0, last24h: 0 };
      e.count++; if (new Date(p.createdAt).getTime() > dayAgo) e.last24h++;
      counts.set(tag, e);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, { count, last24h }]) => ({ tag, growth: last24h === 0 ? 0 : Math.round((last24h / Math.max(1, count - last24h)) * 100), posts: count }))
    .sort((a, b) => b.growth - a.growth)
    .slice(0, limit);
}
