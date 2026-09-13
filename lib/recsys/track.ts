'use client';

import type { ActivityAction, Post, PostProblem, PostType } from '@/lib/types';
import {
  EMPTY_INTEREST,
  applyInteraction,
  applyInteractions,
  type InterestState,
} from './engine';
import { classifyPost, classifyQuery } from './classifier';
import { safeClient } from '@/lib/supabase/client';

const KEY = 'ruhiz.recsys.v1';

interface PersistedRecsys {
  interest: InterestState;
  /** postId -> ISO time last seen in feed (drives seen penalty). */
  seenAt: Record<string, string>;
  hiddenPosts: string[];
  notInterestedProblems: string[];
}

function load(): PersistedRecsys {
  const fallback: PersistedRecsys = {
    interest: EMPTY_INTEREST,
    seenAt: {},
    hiddenPosts: [],
    notInterestedProblems: [],
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return fallback;
    return {
      interest: { ...EMPTY_INTEREST, ...parsed.interest },
      seenAt: parsed.seenAt ?? {},
      hiddenPosts: parsed.hiddenPosts ?? [],
      notInterestedProblems: parsed.notInterestedProblems ?? [],
    };
  } catch {
    return fallback;
  }
}

function persist(state: PersistedRecsys) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: 1, ...state }));
  } catch {
    /* quota — recsys state stays in memory */
  }
}

export interface TrackablePost {
  id: string;
  problems: PostProblem[];
  type: PostType;
}

/**
 * Activity tracking engine.
 * - Applies interactions to local interest scores instantly (feed reacts in-session).
 * - Persists recsys state in localStorage.
 * - Ships activities to Supabase (`record_activities` RPC) in production mode,
 *   debounced and batched.
 */
export class ActivityTracker {
  private state: PersistedRecsys;
  private meId = 'me';
  private profileId: string | null = null;
  private queue: { post_id: string | null; action: ActivityAction; query: string | null; meta: Record<string, unknown> }[] = [];
  private flushTimer: number | null = null;
  private enabled = false; // production mode
  private listeners = new Set<() => void>();

  constructor() {
    this.state = load();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  configure(opts: { enabled: boolean; meId?: string; profileId?: string | null; interest?: InterestState }) {
    this.enabled = opts.enabled;
    this.meId = opts.meId ?? 'me';
    this.profileId = opts.profileId ?? null;
    if (opts.interest) {
      this.state.interest = opts.interest;
      persist(this.state);
      this.emit();
    }
  }

  get interest(): InterestState {
    return this.state.interest;
  }

  get seenAt(): Record<string, string> {
    return this.state.seenAt;
  }

  get hiddenPosts(): string[] {
    return this.state.hiddenPosts;
  }

  get notInterestedProblems(): string[] {
    return this.state.notInterestedProblems;
  }

  /** Seed interest from server-computed scores (production boot). */
  hydrateScores(scores: Record<string, number>, interactionCount: number) {
    this.state.interest = { ...this.state.interest, scores, interactionCount };
    persist(this.state);
    this.emit();
  }

  markSeen(postIds: string[], now = Date.now()) {
    let changed = false;
    for (const id of postIds) {
      if (!this.state.seenAt[id]) changed = true;
      this.state.seenAt[id] = new Date(now).toISOString();
    }
    const ids = Object.keys(this.state.seenAt);
    if (ids.length > 600) {
      // trim oldest
      const sorted = ids.sort((a, b) => this.state.seenAt[a].localeCompare(this.state.seenAt[b]));
      for (const id of sorted.slice(0, ids.length - 600)) delete this.state.seenAt[id];
    }
    if (changed) persist(this.state);
  }

  track(
    action: ActivityAction,
    opts: { post?: TrackablePost | Post; query?: string; meta?: Record<string, unknown> } = {}
  ) {
    const now = Date.now();
    let target: { problems: PostProblem[]; type: PostType } | null = null;

    if (opts.post) {
      const p = opts.post as Post;
      const problems = p.problems?.length ? p.problems : classifyPost(p.text ?? '', p.topics ?? []);
      target = { problems, type: p.type };
    } else if (action === 'search' && opts.query) {
      // search applies its classified problems as a pseudo-target
      const problems = classifyQuery(opts.query);
      target = problems.length ? { problems, type: 'moment' } : null;
    }

    this.state.interest = applyInteraction(this.state.interest, action, target, now);
    persist(this.state);
    this.emit();

    this.queue.push({
      post_id: opts.post ? (opts.post as Post).id : null,
      action,
      query: action === 'search' ? opts.query ?? null : null,
      meta: { ...(opts.meta ?? {}), ...(target ? { problems: target.problems, post_type: target.type } : {}) },
    });
    this.scheduleFlush();
  }

  hidePost(postId: string) {
    if (!this.state.hiddenPosts.includes(postId)) {
      this.state.hiddenPosts = [...this.state.hiddenPosts, postId].slice(-300);
      persist(this.state);
      this.emit();
    }
  }

  markProblemNotInterested(problemId: string) {
    if (!this.state.notInterestedProblems.includes(problemId)) {
      this.state.notInterestedProblems = [...this.state.notInterestedProblems, problemId].slice(-30);
      persist(this.state);
      this.emit();
    }
  }

  reset() {
    this.state = { interest: EMPTY_INTEREST, seenAt: {}, hiddenPosts: [], notInterestedProblems: [] };
    persist(this.state);
    this.emit();
  }

  /* ------------------------- Supabase sync ------------------------- */

  private scheduleFlush() {
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 1200);
  }

  async flush() {
    if (!this.queue.length) return;
    const batch = this.queue;
    this.queue = [];
    if (!this.enabled || !this.profileId) return;
    const sb = safeClient();
    if (!sb) return;
    const { error } = await sb.rpc('record_activities', {
      p_activities: batch.map((b) => ({
        post_id: b.post_id,
        action: b.action,
        query: b.query,
        meta: b.meta,
      })),
    });
    if (error) {
      // table not migrated yet — drop silently in pending-migration mode
      console.warn('[recsys] record_activities failed:', error.message);
    }
  }
}

/** Singleton — survives across views inside the session. */
let tracker: ActivityTracker | null = null;
export function getTracker(): ActivityTracker {
  if (!tracker) tracker = new ActivityTracker();
  return tracker;
}
