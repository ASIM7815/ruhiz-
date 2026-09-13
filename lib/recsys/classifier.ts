import type { PostProblem, PostType } from '@/lib/types';
import { PROBLEMS, TOPIC_TO_PROBLEMS } from './problems';

/**
 * Deterministic keyword classifier — the TS twin of the Postgres trigger
 * `fn_classify_post()` in supabase/migrations. Scoring rules (identical in
 * both implementations):
 *
 *   topic alias hit          → +1.20 × mapping weight
 *   single keyword word hit  → +1.00
 *   multi-word phrase hit    → +1.40
 *
 * Categories scoring >= MIN_SCORE are kept (top MAX_CATEGORIES) and their
 * scores are normalised to shares of the total mass.
 */
export const CLASSIFY = {
  TOPIC_WEIGHT: 1.2,
  WORD_HIT: 1.0,
  PHRASE_HIT: 1.4,
  MIN_SCORE: 0.75,
  MAX_CATEGORIES: 4,
} as const;

const WORD_RE = /[a-z0-9']+/g;

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  const lower = (text || '').toLowerCase();
  const matches = lower.match(WORD_RE);
  if (matches) matches.forEach((t) => tokens.add(t));
  return tokens;
}

function countPhrase(lower: string, phrase: string): number {
  if (!phrase.includes(' ')) return 0;
  let count = 0;
  let idx = lower.indexOf(phrase);
  while (idx !== -1) {
    count += 1;
    idx = lower.indexOf(phrase, idx + phrase.length);
  }
  return count;
}

/** Escapes a string for safe use inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Classify post text + topics into problem categories.
 * `text` should include caption/content; `topics` the picked topic labels.
 */
export function classifyPost(text: string, topics: string[] = []): PostProblem[] {
  const lower = (text || '').toLowerCase();
  const tokens = tokenize(text);
  const scores = new Map<string, number>();

  const add = (id: string, amount: number) => {
    scores.set(id, (scores.get(id) ?? 0) + amount);
  };

  // 1) topic aliases
  for (const topic of topics) {
    const mapping = TOPIC_TO_PROBLEMS[topic];
    if (mapping) {
      for (const [problemId, weight] of mapping) {
        add(problemId, CLASSIFY.TOPIC_WEIGHT * weight);
      }
    }
  }

  // 2) keywords — words matched on token boundaries, phrases on substring
  for (const problem of PROBLEMS) {
    for (const kw of problem.keywords) {
      if (kw.includes(' ')) {
        const hits = countPhrase(lower, kw);
        if (hits > 0) add(problem.id, CLASSIFY.PHRASE_HIT * hits);
      } else if (tokens.has(kw)) {
        add(problem.id, CLASSIFY.WORD_HIT);
      }
    }
  }

  // 3) threshold, top-N, normalise — deterministic tie-break on (score desc, id asc)
  const ranked = [...scores.entries()]
    .filter(([, s]) => s >= CLASSIFY.MIN_SCORE)
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, CLASSIFY.MAX_CATEGORIES);

  const total = ranked.reduce((sum, [, s]) => sum + s, 0);
  if (total <= 0) return [];
  return ranked.map(([id, s]) => ({ id, score: Math.round((s / total) * 1000) / 1000 }));
}

/** Classify a free-text search query (weaker signal, same taxonomy). */
export function classifyQuery(query: string): PostProblem[] {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  return classifyPost(trimmed);
}

export function inferPostType(opts: { type: PostType }): PostType {
  return opts.type;
}
