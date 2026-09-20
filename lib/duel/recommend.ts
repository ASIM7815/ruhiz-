import type { ActivityAction } from '@/lib/types';
import type { DuelDB } from './db';
import { durationBucket, type Challenge, type DurationBucket } from './types';

/**
 * DUEL recommendation engine.
 *
 * Scores are derived from real behaviour stored in `activities`:
 * views, joins, check-ins, completions, likes, saves, shares, comments,
 * searches and explicit "not interested" feedback. The same algorithm is
 * implemented server-side in SQL (duel_refresh_recommendations) so other
 * clients and cron jobs see identical rankings.
 *
 * Diversity is enforced at selection time: results are drawn round-robin
 * across categories (capped per category per page) so a user never sees a
 * wall of identical challenges. Brand-new users with zero history get a
 * balanced mixture of every category, ordered by global popularity.
 */

export const ACTION_WEIGHTS: Record<ActivityAction, number> = {
  view: 1,
  like: 3,
  save: 4,
  comment: 3,
  join: 6,
  checkin: 2,
  complete: 8,
  share: 3,
  search: 2.5,
  create: 4,
  leave: -3,
  not_interested: -9,
};

export interface Affinity {
  categories: Record<string, number>;
  buckets: Record<DurationBucket, number>;
  interactions: number;
  /** titles of challenges the user joined/completed, for explanations */
  joinedTitles: Record<string, string[]>;
}

export interface RankedChallenge {
  id: string;
  score: number;
  reason: string;
}

const AGE_HALF_LIFE_DAYS = 45;

export function computeAffinity(db: DuelDB, userId: string): Affinity {
  const categories: Record<string, number> = {};
  const buckets: Record<DurationBucket, number> = { sprint: 0, short: 0, classic: 0, marathon: 0 };
  const joinedTitles: Record<string, string[]> = {};
  let interactions = 0;

  const challengeById = new Map(db.challenges.map((c) => [c.id, c]));

  for (const a of db.activities) {
    if (a.userId !== userId) continue;
    const w = ACTION_WEIGHTS[a.action] ?? 0;
    if (a.action === 'view' || a.action === 'like' || a.action === 'save' || a.action === 'comment' || a.action === 'join' || a.action === 'checkin' || a.action === 'complete' || a.action === 'share') {
      interactions += 1;
    }
    const ch = a.challengeId ? challengeById.get(a.challengeId) : undefined;
    const cat = a.categoryId ?? ch?.categoryId;
    if (cat) categories[cat] = (categories[cat] ?? 0) + w;
    const bucket = (a.bucket as DurationBucket) ?? (ch ? durationBucket(ch.durationDays) : undefined);
    if (bucket && buckets[bucket] !== undefined) buckets[bucket] += w;
    if ((a.action === 'join' || a.action === 'complete') && ch) {
      (joinedTitles[cat ?? ch.categoryId] ??= []).push(ch.title);
    }
  }

  // searches carry category intent too
  for (const s of db.searches) {
    if (s.userId !== userId) continue;
    const q = s.query.toLowerCase();
    for (const cat of db.categories) {
      if (q.includes(cat.name.toLowerCase()) || cat.name.toLowerCase().split(' ').some((w) => w.length > 4 && q.includes(w))) {
        categories[cat.id] = (categories[cat.id] ?? 0) + ACTION_WEIGHTS.search;
      }
    }
  }

  return { categories, buckets, interactions, joinedTitles };
}

function popularity(ch: Challenge): number {
  return Math.log10(1 + ch.participantCount + ch.likeCount * 2 + ch.saveCount);
}

function engagement(ch: Challenge): number {
  const denom = ch.viewCount + 1;
  return (ch.likeCount + ch.saveCount * 1.2 + ch.shareCount * 1.5 + ch.commentCount) / denom;
}

function ageDays(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 86400_000);
}

/** Deterministic per-user jitter so rankings are stable but not identical for everyone. */
function jitter(userId: string, challengeId: string): number {
  let h = 0;
  const s = userId + ':' + challengeId;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000; // 0..1
}

export function rankChallenges(db: DuelDB, userId: string, limit = 12): RankedChallenge[] {
  const aff = computeAffinity(db, userId);
  const myPart = new Map(
    db.participants.filter((p) => p.userId === userId).map((p) => [p.challengeId, p.status])
  );
  const dismissed = new Set(
    db.activities.filter((a) => a.userId === userId && a.action === 'not_interested').map((a) => a.challengeId)
  );

  const candidates = db.challenges.filter(
    (c) => c.status === 'open' && !myPart.has(c.id) && !dismissed.has(c.id)
  );
  if (!candidates.length) return [];

  const maxCat = Math.max(0.0001, ...Object.values(aff.categories));
  const maxBucket = Math.max(0.0001, ...Object.values(aff.buckets));
  const maxPop = Math.max(0.0001, ...candidates.map(popularity));
  const maxEng = Math.max(0.0001, ...candidates.map(engagement));

  const scored = candidates.map((c) => {
    const catScore = Math.max(0, (aff.categories[c.categoryId] ?? 0)) / maxCat;
    const bucketScore = Math.max(0, aff.buckets[durationBucket(c.durationDays)] ?? 0) / maxBucket;
    const pop = popularity(c) / maxPop;
    const eng = engagement(c) / maxEng;
    const fresh = Math.exp(-ageDays(c.createdAt) / AGE_HALF_LIFE_DAYS);
    const base =
      0.36 * catScore + 0.12 * bucketScore + 0.3 * pop + 0.1 * eng + 0.12 * fresh;
    const score = base * 100 + jitter(userId, c.id) * 2;

    let reason: string;
    if (aff.interactions === 0) {
      reason = pop > 0.75 ? `Popular this week in ${catName(db, c.categoryId)}` : `Staff pick in ${catName(db, c.categoryId)}`;
    } else if ((aff.categories[c.categoryId] ?? 0) >= maxCat * 0.6 && aff.joinedTitles[c.categoryId]?.length) {
      reason = `Because you joined ${aff.joinedTitles[c.categoryId][0]}`;
    } else if ((aff.categories[c.categoryId] ?? 0) > 0) {
      reason = `You keep exploring ${catName(db, c.categoryId)}`;
    } else if (bucketScore > 0.6) {
      reason = `Matches your ${c.durationDays}-day rhythm`;
    } else if (pop > 0.8) {
      reason = `Trending in ${catName(db, c.categoryId)}`;
    } else {
      reason = `Fresh in ${catName(db, c.categoryId)}`;
    }
    return { id: c.id, score, reason, categoryId: c.categoryId };
  });

  return diversify(db, scored, limit);
}

function catName(db: DuelDB, id: string): string {
  return db.categories.find((c) => c.id === id)?.name ?? 'your categories';
}

/**
 * Round-robin selection across categories with a per-category cap, so the
 * final list is diverse even when one category dominates the raw scores.
 */
function diversify(
  db: DuelDB,
  scored: ({ id: string; score: number; reason: string; categoryId: string })[],
  limit: number
): RankedChallenge[] {
  const byCat = new Map<string, typeof scored>();
  for (const s of scored) {
    const list = byCat.get(s.categoryId) ?? [];
    list.push(s);
    byCat.set(s.categoryId, list);
  }
  for (const list of byCat.values()) list.sort((a, b) => b.score - a.score);

  // Category order: user affinity first, then global popularity of the category.
  const catPop = new Map<string, number>();
  for (const c of db.challenges) {
    catPop.set(c.categoryId, (catPop.get(c.categoryId) ?? 0) + c.participantCount + c.likeCount);
  }
  const aff = new Map<string, number>();
  for (const s of scored) aff.set(s.categoryId, Math.max(aff.get(s.categoryId) ?? 0, s.score));
  const catOrder = [...byCat.keys()].sort((a, b) => (catPop.get(b) ?? 0) - (catPop.get(a) ?? 0));

  const cap = Math.max(1, Math.ceil(limit / Math.max(3, Math.min(catOrder.length, 6))));
  const taken = new Map<string, number>();
  const out: RankedChallenge[] = [];

  // Round 1..n: one pick per category in affinity/popularity order.
  let round = 0;
  while (out.length < limit && round < 20) {
    let progressed = false;
    for (const cat of catOrder) {
      if (out.length >= limit) break;
      const list = byCat.get(cat)!;
      const used = taken.get(cat) ?? 0;
      if (used >= cap || used >= list.length) continue;
      const pick = list[used];
      taken.set(cat, used + 1);
      out.push({ id: pick.id, score: pick.score, reason: pick.reason });
      progressed = true;
    }
    if (!progressed) break;
    round++;
  }

  // Top-up with the best remaining scores regardless of category.
  if (out.length < limit) {
    const picked = new Set(out.map((o) => o.id));
    const rest = scored.filter((s) => !picked.has(s.id)).sort((a, b) => b.score - a.score);
    for (const s of rest) {
      if (out.length >= limit) break;
      out.push({ id: s.id, score: s.score, reason: s.reason });
    }
  }
  return out;
}

/** Category leaderboard used by Explore's "Trending categories". */
export function trendingCategories(db: DuelDB, limit = 6): { categoryId: string; challengeCount: number; participants: number }[] {
  const agg = new Map<string, { challengeCount: number; participants: number }>();
  for (const c of db.challenges) {
    const e = agg.get(c.categoryId) ?? { challengeCount: 0, participants: 0 };
    e.challengeCount += 1;
    e.participants += c.participantCount;
    agg.set(c.categoryId, e);
  }
  return [...agg.entries()]
    .map(([categoryId, v]) => ({ categoryId, ...v }))
    .sort((a, b) => b.participants - a.participants)
    .slice(0, limit);
}
