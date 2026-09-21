'use client';

/**
 * ChallengeDayTimeline — Challenge → Day 1 → Day 2 … rail.
 * Real posts only (from `get_challenge_timeline` / duel_feed), grouped by day,
 * with completed / missed / upcoming state derived from the focused user's posts.
 */

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Primitives';
import { PostCard, PostLightbox } from '@/components/challenge/PostCard';
import { useStore } from '@/lib/duel/store';
import type { FeedPost } from '@/lib/duel/types';

type DayState = 'completed' | 'missed' | 'today' | 'upcoming';

function isoDayUTC(offset = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function ChallengeDayTimeline({
  challengeId,
  durationDays,
  focusUserId,
  focusJoinedAt,
  isParticipant,
  refreshKey = 0,
  onCreatePost,
}: {
  challengeId: string;
  durationDays: number;
  focusUserId: string;
  /** ISO date the focused user joined — day 1 targets this date. */
  focusJoinedAt?: string | null;
  /** Whether the VIEWER can post (only their own timeline). */
  isParticipant: boolean;
  refreshKey?: number;
  onCreatePost: (dayNumber: number) => void;
}) {
  const store = useStore();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [openPost, setOpenPost] = useState<FeedPost | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'missed'>('all');

  useEffect(() => {
    let alive = true;
    setPosts(null);
    store
      .loadChallengePosts(challengeId)
      .then((rows) => {
        if (alive) setPosts(rows);
      })
      .catch(() => {
        if (alive) setPosts([]);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId, refreshKey, store.authed, store.hydrated]);

  const byDay = useMemo(() => {
    const map = new Map<number, FeedPost[]>();
    for (const p of posts ?? []) {
      const list = map.get(p.dayNumber) ?? [];
      list.push(p);
      map.set(p.dayNumber, list);
    }
    return map;
  }, [posts]);

  const myDayState = useMemo(() => {
    // Which day number is "today" for the focused user?
    let currentDay = 1;
    if (focusJoinedAt) {
      const joined = String(focusJoinedAt).slice(0, 10);
      const today = isoDayUTC(0);
      const diff = Math.floor((Date.parse(today) - Date.parse(joined)) / 86400000);
      currentDay = Math.min(Math.max(diff + 1, 1), durationDays);
    }
    const posted = new Set(
      (posts ?? []).filter((p) => p.authorId === focusUserId).map((p) => p.dayNumber)
    );
    const states = new Map<number, DayState>();
    for (let d = 1; d <= durationDays; d++) {
      if (posted.has(d)) states.set(d, 'completed');
      else if (d < currentDay && focusJoinedAt) states.set(d, 'missed');
      else if (d === currentDay) states.set(d, 'today');
      else states.set(d, 'upcoming');
    }
    return { states, currentDay };
  }, [posts, focusUserId, focusJoinedAt, durationDays]);

  const completedCount = [...myDayState.states.values()].filter((s) => s === 'completed').length;
  const missedCount = [...myDayState.states.values()].filter((s) => s === 'missed').length;

  const days = Array.from({ length: durationDays }, (_, i) => durationDays - i); // newest first

  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="calendar" size={20} className="text-[var(--brand)]" />
            <h2 className="display text-lg sm:text-xl text-[var(--text)] font-bold">Day-by-day timeline</h2>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Completed {completedCount}
            {missedCount > 0 ? ` · ${missedCount} missed` : ''} · {durationDays} days total
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          {(['all', 'completed', 'missed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold capitalize transition-colors ${
                filter === f
                  ? 'bg-[var(--brand)] text-black'
                  : 'bg-[var(--card-2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {posts === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-0">
          {days
            .filter((d) => {
              const st = myDayState.states.get(d) ?? 'upcoming';
              if (filter === 'all') return true;
              return st === filter;
            })
            .map((d) => {
              const st = myDayState.states.get(d) ?? 'upcoming';
              const dayPosts = (byDay.get(d) ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
              const canPost = isParticipant && (st === 'today' || st === 'missed' || (st === 'upcoming' && d <= myDayState.currentDay));
              return (
                <div key={d} className="relative pl-8 pb-6 last:pb-0">
                  {/* rail */}
                  <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-[var(--border)]" />
                  <div
                    className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                      st === 'completed'
                        ? 'bg-emerald-400/20 border-emerald-400 text-emerald-300'
                        : st === 'missed'
                          ? 'bg-red-400/10 border-red-400/70 text-red-400'
                          : st === 'today'
                            ? 'bg-[var(--brand)] border-[var(--brand)] text-black'
                            : 'bg-[var(--card-2)] border-[var(--border)] text-[var(--muted)]'
                    }`}
                  >
                    {st === 'completed' ? (
                      <Icon name="check" size={12} />
                    ) : st === 'missed' ? (
                      <Icon name="close" size={11} />
                    ) : st === 'today' ? (
                      <Icon name="flame" size={12} />
                    ) : (
                      <span className="text-[9px] font-bold">{d}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-bold text-[var(--text)] display">Day {d}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          st === 'completed'
                            ? 'bg-emerald-400/15 text-emerald-300'
                            : st === 'missed'
                              ? 'bg-red-400/15 text-red-400'
                              : st === 'today'
                                ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                                : 'bg-[var(--card-2)] text-[var(--muted)]'
                        }`}
                      >
                        {st === 'today' ? 'due today' : st}
                      </span>
                    </div>
                    {canPost && (
                      <button
                        onClick={() => onCreatePost(d)}
                        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] text-[11px] font-bold hover:bg-[var(--brand)] hover:text-black transition-colors"
                      >
                        <Icon name="plus" size={12} /> {st === 'missed' ? 'Backfill' : 'Post'}
                      </button>
                    )}
                  </div>

                  {dayPosts.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] py-2">
                      {st === 'missed'
                        ? 'No post this day.'
                        : st === 'upcoming'
                          ? 'Not reached yet.'
                          : 'No posts yet — be the first here.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {dayPosts.map((p) => (
                        <PostCard key={p.id} post={p} onOpen={setOpenPost} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {openPost && <PostLightbox post={openPost} onClose={() => setOpenPost(null)} />}
    </section>
  );
}
