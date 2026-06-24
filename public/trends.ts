/**
 * Smart Feed Ranking & Trend Detection
 * =====================================
 *
 * The original app showed posts in simple chronological order. V5 uses a
 * scoring function that combines engagement velocity, freshness, and
 * personalization signals.
 *
 * `rankVideos()` returns posts re-ordered by trendingScore, computed as:
 *
 *   score = (likes*1 + comments*2 + shares*3) / (hoursSincePost + 2)^1.5
 *
 * plus a personalization multiplier when we know the current user's
 * follow/interaction history.
 *
 * This is the same family of formula used by Hacker News and the early
 * Reddit "hot" algorithm — well-documented and predictable.
 */

import type { TrendingTopic, UserProfile, VideoPost } from '@/types';

const HOURS = (dateIso: string): number =>
  Math.max(1, (Date.now() - new Date(dateIso).getTime()) / 3_600_000);

export function rankVideos(
  posts: VideoPost[],
  viewer?: Pick<UserProfile, 'id' | 'following'> | null,
): VideoPost[] {
  const followedSet = new Set(viewer?.following ?? []);
  return posts
    .map(p => ({ p, score: computeScore(p, followedSet) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.p);
}

function computeScore(post: VideoPost, followedSet: Set<string>): number {
  const engagement = post.likes * 1 + post.comments * 2 + post.shares * 3;
  const recencyDecay = Math.pow(HOURS(post.createdAt) + 2, 1.5);
  const base = engagement / recencyDecay;
  const personalizationBoost = followedSet.has(post.userId) ? 1.5 : 1;
  const viewBonus = Math.log10(Math.max(1, post.views)) * 0.2;
  return base * personalizationBoost + viewBonus;
}

/** Extract trending tags from a list of recent posts. */
export function trendingTags(posts: VideoPost[], limit = 10): TrendingTopic[] {
  const counts = new Map<string, { count: number; last24h: number }>();
  const dayAgo = Date.now() - 86_400_000;

  for (const p of posts) {
    for (const tag of p.hashtags ?? []) {
      const entry = counts.get(tag) ?? { count: 0, last24h: 0 };
      entry.count += 1;
      if (new Date(p.createdAt).getTime() > dayAgo) entry.last24h += 1;
      counts.set(tag, entry);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, { count, last24h }]) => ({
      tag,
      growth: last24h === 0 ? 0 : ((last24h / Math.max(1, count - last24h)) * 100) | 0,
      posts: count,
    }))
    .sort((a, b) => b.growth - a.growth || b.posts - a.posts)
    .slice(0, limit);
}
