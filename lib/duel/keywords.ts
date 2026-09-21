import type { ActivityAction } from '@/lib/types';
import type { DuelDB } from './db';
import { ACTION_WEIGHTS } from './recommend';
import type { Challenge } from './types';

/**
 * Client-side mirror of the SQL keyword system
 * (public.duel_tokenize / public.duel_bump_keywords / public.user_keywords).
 *
 * In production the Postgres user_keywords table is the source of truth
 * (maintained by triggers); this module gives the local preview adapter the
 * exact same interest signal so both engines rank identically.
 */

const STOPWORDS = new Set(
  'the and for with this that from have has had was were will would your you our their they them then than there here when what where which while about into over under again further once some such only other also very just because though through during before after above below out off up down all any both each few more most no nor not own same so too against between day today todays'.split(' ')
);

export const KEYWORD_DECAY_DAYS = 90;
export const KEYWORD_CAP = 40;

/** Tokenize text the same way duel_tokenize() does in SQL. */
export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue;
    if (STOPWORDS.has(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

export interface UserKeywords {
  weights: Map<string, number>;
}

/**
 * Rebuilds the user's keyword weight profile from their activity history,
 * applying the same recency decay as the SQL side:
 *   weight_effective = weight * exp(-age_days / 90), capped at 40.
 */
export function buildUserKeywords(db: DuelDB, userId: string): UserKeywords {
  const weights = new Map<string, number>();

  const challengeById = new Map<string, Challenge>(db.challenges.map((c) => [c.id, c]));

  const bump = (keywords: string[], weight: number, at: string) => {
    const ageDays = Math.max(0, (Date.now() - new Date(at).getTime()) / 86400_000);
    const factor = Math.exp(-ageDays / KEYWORD_DECAY_DAYS);
    for (const kw of keywords) {
      const prev = (weights.get(kw) ?? 0) * factor;
      weights.set(kw, Math.min(KEYWORD_CAP, prev + weight));
    }
  };

  for (const a of db.activities) {
    if (a.userId !== userId) continue;
    const w = ACTION_WEIGHTS[a.action] ?? 0;
    if (w <= 0) continue;
    if (a.action === 'search') {
      if (a.query) bump(tokenize(a.query), w, a.createdAt);
      continue;
    }
    const ch = a.challengeId ? challengeById.get(a.challengeId) : undefined;
    if (ch) {
      bump([...tokenize(ch.title), ...ch.tags.map((t) => t.toLowerCase())], w, a.createdAt);
    }
  }

  // searches table carries query intent too (mirrors the SQL trigger)
  for (const s of db.searches) {
    if (s.userId !== userId) continue;
    bump(tokenize(s.query), ACTION_WEIGHTS.search, s.createdAt);
  }

  // the user's own post notes signal interest (mirrors the SQL checkin trigger)
  for (const ck of db.checkins) {
    if (ck.userId !== userId) continue;
    bump(tokenize(ck.note), 2, ck.createdAt);
  }

  return { weights };
}

/** Sum of the viewer's keyword weights that appear in the given texts. */
export function keywordOverlap(keywords: UserKeywords, ...texts: (string | string[] | null | undefined)[]): number {
  const postTokens = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    if (Array.isArray(t)) {
      for (const x of t) postTokens.add(x.toLowerCase());
    } else {
      for (const x of tokenize(t)) postTokens.add(x);
    }
  }
  let total = 0;
  for (const [kw, w] of keywords.weights) {
    if (postTokens.has(kw)) total += w;
  }
  return total;
}

/** How much the viewer has interacted with content created by a given user. */
export function creatorAffinity(db: DuelDB, userId: string, creatorId: string): number {
  if (creatorId === userId) return 0;
  const theirChallenges = new Set(db.challenges.filter((c) => c.creatorId === creatorId).map((c) => c.id));
  let total = 0;
  for (const a of db.activities) {
    if (a.userId !== userId || !a.challengeId) continue;
    if (theirChallenges.has(a.challengeId)) total += ACTION_WEIGHTS[a.action as ActivityAction] ?? 0;
  }
  return total;
}
