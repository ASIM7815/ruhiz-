import type { ActivityAction, Post, PostProblem, PostType } from '@/lib/types';
import { CLASSIFY, classifyPost, classifyQuery } from './classifier';

/* ====================================================================== */
/* Configurable weights — mirrored in the DB (table `app_settings`,        */
/* key 'recsys_weights', used by the record_activities SQL function).      */
/* Keep in sync when tuning.                                              */
/* ====================================================================== */

export const ACTION_WEIGHTS: Record<ActivityAction, number> = {
  view: 1,
  watch: 3,
  support: 5,
  comment: 6,
  save: 8,
  share: 7,
  search: 2.5,
  been_there: 4,
  ignore: -1.5,
  not_interested: -9,
};

export const ENGINE_CONFIG = {
  /** Interest score half-life in days (older interactions fade). */
  DECAY_HALF_LIFE_DAYS: 14,
  SCORE_MIN: -60,
  SCORE_MAX: 400,
  /** Sigmoid temperature when converting raw interest into 0..1. */
  INTEREST_TEMP: 12,
  /** Recency: exp(-ageHours / HALF_LIFE_HOURS). */
  RECENCY_HALF_LIFE_HOURS: 30,
  /** Rank blend weights (interest + recency + social + content + follow). */
  W_INTEREST: 0.4,
  W_RECENCY: 0.22,
  W_SOCIAL: 0.14,
  W_CONTENT: 0.12,
  W_FOLLOW: 0.12,
  /** Exploration: noise amplitude range. New users ≈ high, active ≈ low. */
  EXPLORATION_MAX: 0.85,
  EXPLORATION_MIN: 0.22,
  EXPLORATION_TAU: 25, // interactions constant: level = 1 - e^(-n/tau)
  NOISE_SCALE: 0.35,
  /** Penalise posts the user already saw less than this many hours ago. */
  SEEN_PENALTY_HOURS: 36,
  SEEN_PENALTY: 0.45,
  /** Post of a problem the user marked "not interested". */
  BLOCKED_PROBLEM_FACTOR: 0.2,
  /** Max consecutive posts sharing the same dominant problem. */
  DIVERSITY_MAX_RUN: 2,
  /** Seen-log + hidden-post caps kept in localStorage. */
  SEEN_LOG_CAP: 600,
} as const;

/* ====================================================================== */
/* Seeded deterministic randomness                                         */
/* ====================================================================== */

/** FNV-1a string hash — deterministic across sessions. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — tiny, fast, deterministic. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Day bucket used to rotate the feed's randomness daily. */
export function dayBucket(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/* ====================================================================== */
/* Interest scores                                                         */
/* ====================================================================== */

export interface InterestState {
  /** problemId -> decayed interest score (can be negative). */
  scores: Record<string, number>;
  /** post type -> affinity 0..1 (defaults to 0.5 until there is history). */
  typeAffinity: Record<PostType, number>;
  /** Total weighted interactions — drives the exploration level. */
  interactionCount: number;
}

export const EMPTY_INTEREST: InterestState = {
  scores: {},
  typeAffinity: { photo: 0.5, video: 0.5, moment: 0.5, question: 0.5 },
  interactionCount: 0,
};

export function clampScore(v: number): number {
  return Math.max(ENGINE_CONFIG.SCORE_MIN, Math.min(ENGINE_CONFIG.SCORE_MAX, v));
}

/** Exponential decay with a half-life, applied over elapsed days. */
export function decayScore(score: number, lastEventAt: string | number, now = Date.now()): number {
  const then = typeof lastEventAt === 'number' ? lastEventAt : new Date(lastEventAt).getTime();
  const days = Math.max(0, (now - then) / 86_400_000);
  return score * Math.pow(0.5, days / ENGINE_CONFIG.DECAY_HALF_LIFE_DAYS);
}

export type InteractionTarget = {
  problems: PostProblem[];
  type: PostType;
} | null;

/**
 * Client-side mirror of the SQL `record_activities` scoring: returns the new
 * interest state after applying one interaction. Deterministic.
 */
export function applyInteraction(
  state: InterestState,
  action: ActivityAction,
  target: InteractionTarget,
  now = Date.now()
): InterestState {
  const weight = ACTION_WEIGHTS[action] ?? 0;
  const scores: Record<string, number> = {};
  for (const [pid, s] of Object.entries(state.scores)) scores[pid] = s;
  let touched = false;

  if (target && target.problems.length > 0) {
    for (const { id, score: share } of target.problems) {
      const prev = scores[id] ?? 0;
      const lastEventAt = now; // decay handled lazily on read below
      scores[id] = clampScore(decayScore(prev, lastEventAt, now) + weight * share);
    }
    touched = true;
  } else if (action === 'search') {
    // search queries are classified before calling applyInteraction
    touched = true;
  }

  // Content-type affinity: strong actions move type preference, weak ones barely.
  const strong = ['support', 'comment', 'save', 'share', 'watch', 'been_there'].includes(action);
  const weak = ['view'].includes(action);
  const affinity = { ...state.typeAffinity };
  if ((strong || weak) && target) {
    const t = target.type;
    const step = strong ? 0.06 : 0.015;
    const dir = weight >= 0 ? 1 : -1;
    affinity[t] = Math.max(0, Math.min(1, affinity[t] + dir * step));
  }

  return {
    scores: touched || Object.keys(scores).length ? scores : state.scores,
    typeAffinity: affinity,
    interactionCount: state.interactionCount + (weight !== 0 ? 1 : 0),
  };
}

/** Batch convenience: apply several interactions in order. */
export function applyInteractions(
  state: InterestState,
  items: { action: ActivityAction; target: InteractionTarget; at?: number }[],
  now = Date.now()
): InterestState {
  let s = state;
  for (const it of items) s = applyInteraction(s, it.action, it.target, it.at ?? now);
  return s;
}

/** 0..1 exploration level — the higher, the more discovery/randomness. */
export function explorationLevel(state: InterestState): number {
  const engagement = 1 - Math.exp(-Math.max(0, state.interactionCount) / ENGINE_CONFIG.EXPLORATION_TAU);
  const raw = ENGINE_CONFIG.EXPLORATION_MAX - engagement * (ENGINE_CONFIG.EXPLORATION_MAX - ENGINE_CONFIG.EXPLORATION_MIN);
  return Math.max(ENGINE_CONFIG.EXPLORATION_MIN, Math.min(ENGINE_CONFIG.EXPLORATION_MAX, raw));
}

/* ====================================================================== */
/* Feed ranking                                                            */
/* ====================================================================== */

export interface RankContext {
  userId: string;
  interest: InterestState;
  /** postIds seen recently (value = ISO time last seen). */
  seenAt: Record<string, string>;
  following: string[];
  hiddenPosts: string[];
  blockedAuthors: string[];
  notInterestedProblems: string[];
  now?: number;
}

export interface RankedPost {
  post: Post;
  score: number;
  reason: string; // human-readable "why am I seeing this"
  exploration: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function socialProof(post: Post): number {
  const raw = 2 * post.supports + 1.5 * post.commentCount + 1.2 * post.shares + 0.4 * post.views;
  return Math.max(0, Math.min(1, Math.log10(1 + raw) / 3.7));
}

function interestFor(post: Post, state: InterestState): number {
  if (!post.problems?.length) return sigmoid(0 / ENGINE_CONFIG.INTEREST_TEMP) * 0.5;
  let raw = 0;
  for (const { id, score: share } of post.problems) {
    raw += (state.scores[id] ?? 0) * share;
  }
  return sigmoid(raw / ENGINE_CONFIG.INTEREST_TEMP);
}

/** Rank candidate posts. Deterministic for a given user + day bucket. */
export function rankFeed(posts: Post[], ctx: RankContext): RankedPost[] {
  const now = ctx.now ?? Date.now();
  const bucket = dayBucket(now);
  const exploration = explorationLevel(ctx.interest);
  const ranked: RankedPost[] = [];

  for (const post of posts) {
    if (ctx.hiddenPosts.includes(post.id)) continue;
    if (ctx.blockedAuthors.includes(post.userId)) continue;

    const ageHours = Math.max(0, (now - new Date(post.createdAt).getTime()) / 3_600_000);
    const recency = Math.exp(-ageHours / ENGINE_CONFIG.RECENCY_HALF_LIFE_HOURS);
    const interest = interestFor(post, ctx.interest);
    const social = socialProof(post);
    const content = ctx.interest.typeAffinity[post.type] ?? 0.5;
    const follow = ctx.following.includes(post.userId) ? 1 : 0;

    let base =
      ENGINE_CONFIG.W_INTEREST * interest +
      ENGINE_CONFIG.W_RECENCY * recency +
      ENGINE_CONFIG.W_SOCIAL * social +
      ENGINE_CONFIG.W_CONTENT * content +
      ENGINE_CONFIG.W_FOLLOW * follow * (0.5 + 0.5 * interest);

    // Seen recently → demote (feed keeps moving).
    const seenIso = ctx.seenAt[post.id];
    if (seenIso) {
      const seenHours = (now - new Date(seenIso).getTime()) / 3_600_000;
      if (seenHours < ENGINE_CONFIG.SEEN_PENALTY_HOURS) base *= ENGINE_CONFIG.SEEN_PENALTY;
    }

    // Explicitly not-interested problem → sink, but don't fully hide.
    const blockedProblem = post.problems.some((p) => ctx.notInterestedProblems.includes(p.id));
    if (blockedProblem) base *= ENGINE_CONFIG.BLOCKED_PROBLEM_FACTOR;

    // Controlled, seeded randomness. Stable within a day; rotates daily so
    // the feed feels alive without ever being non-deterministic for a given day.
    const rng = mulberry32(hashSeed(`${ctx.userId}:${post.id}:${bucket}`));
    const noise = (rng() - 0.5) * 2 * exploration * ENGINE_CONFIG.NOISE_SCALE;

    const score = base + noise;
    const dominant = post.problems[0]?.id;
    let reason = 'Fresh from the community';
    if (interest > 0.65) reason = `Matches your interest${dominant ? ` in ${dominant.replace('_', ' ')}` : ''}`;
    else if (follow && interest > 0.45) reason = 'From someone you support';
    else if (recency > 0.7 && social > 0.5) reason = 'Rising in the community';
    else if (exploration > 0.6) reason = 'Discovery pick';

    ranked.push({ post, score, reason, exploration });
  }

  ranked.sort((a, b) => b.score - a.score);

  // Diversity pass: avoid long runs of the same dominant problem.
  const out: RankedPost[] = [];
  let runProblem: string | null = null;
  let runLen = 0;
  const deferred: RankedPost[] = [];

  for (const item of ranked) {
    const dominant = item.post.problems[0]?.id ?? null;
    if (dominant && dominant === runProblem && runLen >= ENGINE_CONFIG.DIVERSITY_MAX_RUN) {
      deferred.push(item);
      continue;
    }
    out.push(item);
    if (dominant === runProblem) runLen += 1;
    else {
      runProblem = dominant;
      runLen = 1;
    }
    // periodically re-admit deferred items
    while (deferred.length && out.length % 4 === 0) {
      const next = deferred.shift()!;
      out.push(next);
    }
  }
  while (deferred.length) out.push(deferred.shift()!);

  return out;
}

/** Classify helper re-exports for UI (composer hints etc.). */
export { classifyPost, classifyQuery, CLASSIFY };
