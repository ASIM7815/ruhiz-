'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, GhostButton, Spinner } from '@/components/ui/Primitives';
import { R2Image, R2Video } from '@/components/ui/Media';
import { PostLightbox } from '@/components/challenge/PostCard';
import { fullDate, timeAgo } from '@/lib/format';
import type { Checkin, FeedPost } from '@/lib/duel/types';

/**
 * Day-by-day timeline of a duel.
 *
 * Every entry is a real check-in (challenge_checkins) — the same rows that
 * power streaks, the Explore feed and profiles — so the timeline works
 * identically in preview mode (local adapter) and against Supabase. Entries
 * carry an optional photo/video; written-only days show as text cards.
 *
 * Posting happens through the shared check-in flow (`onOpenDay`), which keeps
 * one entry per day per member and never lets the social layer drift away from
 * the streak engine.
 */

const DAY_WINDOW = 15;

interface ChallengeTimelineProps {
  challengeId: string;
  durationDays: number;
  isParticipant: boolean;
  meId: string | null;
  /** day whose date is today for this member — highlighted in the list */
  todayDay: number | null;
  /** the day this member should log next (drives the quick "log proof" action) */
  nextDay: number | null;
  /** open the check-in flow for a day (creates the entry / logs proof) */
  onOpenDay: (dayNumber: number) => void;
  /** open the check-in flow pre-filled with an existing entry (edit) */
  onEditEntry?: (checkin: Checkin) => void;
}

export default function ChallengeTimeline({
  challengeId,
  durationDays,
  isParticipant,
  meId,
  todayDay,
  nextDay,
  onOpenDay,
  onEditEntry,
}: ChallengeTimelineProps) {
  const store = useStore();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [visibleDays, setVisibleDays] = useState(DAY_WINDOW);
  const [openPost, setOpenPost] = useState<FeedPost | null>(null);
  const [failed, setFailed] = useState(false);

  /* Re-fetch whenever the shared snapshot changes (new check-in, edit, like). */
  const revision = `${store.db.checkins.length}|${store.db.postLikes.length}|${store.db.postComments.length}`;

  useEffect(() => {
    let alive = true;
    setFailed(false);
    store
      .loadChallengePosts(challengeId)
      .then((rows) => {
        if (alive) setPosts(rows);
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        setPosts((prev) => prev ?? []);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId, revision, store.authed, store.hydrated]);

  const entries = useMemo(
    () => (posts ?? []).filter((p) => (filter === 'mine' ? p.isMine : true)),
    [posts, filter]
  );

  const byDay = useMemo(() => {
    const map = new Map<number, FeedPost[]>();
    for (const post of entries) {
      const list = map.get(post.dayNumber);
      if (list) list.push(post);
      else map.set(post.dayNumber, [post]);
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return map;
  }, [entries]);

  const challengers = useMemo(() => new Set(entries.map((p) => p.authorId)).size, [entries]);
  const myDays = useMemo(
    () => new Set((posts ?? []).filter((p) => p.isMine).map((p) => p.dayNumber)),
    [posts]
  );
  const maxEntryDay = useMemo(
    () => (posts ?? []).reduce((max, p) => Math.max(max, p.dayNumber), 0),
    [posts]
  );

  /* Always reveal any day that already holds an entry. */
  useEffect(() => {
    if (maxEntryDay > visibleDays) setVisibleDays(Math.min(durationDays, maxEntryDay + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxEntryDay, durationDays]);

  const shownDays = Math.min(durationDays, Math.max(DAY_WINDOW, visibleDays));
  const days = Array.from({ length: shownDays }, (_, i) => i + 1);

  const openEdit = useCallback(
    (post: FeedPost) => {
      const checkin = store.db.checkins.find((c) => c.id === post.id);
      if (checkin && onEditEntry) onEditEntry(checkin);
      else onOpenDay(post.dayNumber);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.db.checkins, onEditEntry, onOpenDay]
  );

  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="calendar" size={20} className="text-[var(--brand)]" />
            <h2 className="display text-lg sm:text-xl text-[var(--text)] font-bold">Day-by-Day Timeline</h2>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1 max-w-xl">
            {entries.length > 0
              ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} from ${challengers} ${
                  challengers === 1 ? 'challenger' : 'challengers'
                } — every day of this duel, as it happens.`
              : 'Entries land here the moment a challenger logs proof for a day.'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(['all', 'mine'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                filter === value
                  ? 'bg-[var(--brand)] text-black border-[var(--brand)]'
                  : 'bg-[var(--card-2)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
              }`}
            >
              {value === 'all' ? 'Everyone' : 'Mine'}
            </button>
          ))}
          {isParticipant && (
            <GhostButton
              onClick={() => onOpenDay(nextDay ?? todayDay ?? nextOpenDay(myDays, durationDays))}
              className="!py-1.5 !px-3 !text-xs"
            >
              <Icon name="plus" size={14} /> Log proof
            </GhostButton>
          )}
        </div>
      </div>

      {failed && (
        <div className="p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
          <Icon name="warning" size={14} className="flex-shrink-0" />
          <span>Could not refresh the timeline. Pull up again in a moment.</span>
        </div>
      )}

      {posts === null ? (
        <div className="flex justify-center py-10">
          <Spinner size={28} />
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day) => {
            const dayEntries = byDay.get(day) ?? [];
            const mine = myDays.has(day);
            const isToday = todayDay === day;
            const dayDate = dayEntries[0]?.date;
            const showAction = isParticipant && !mine && day <= (nextDay ?? durationDays);

            if (dayEntries.length === 0) {
              return (
                <div
                  key={day}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 ${
                    isToday
                      ? 'border-[var(--brand)]/50 bg-[var(--brand-soft)]/40'
                      : 'border-[var(--border)] bg-[var(--card-2)]/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg text-[11px] font-bold flex items-center justify-center flex-shrink-0 ${
                        isToday ? 'bg-[var(--brand)] text-black' : 'bg-[var(--card-2)] text-[var(--muted)]'
                      }`}
                    >
                      {day}
                    </span>
                    <span className="text-xs text-[var(--muted)] truncate">
                      Day {day} ·{' '}
                      {isToday ? 'today' : day <= (nextDay ?? 0) ? 'open — no entry yet' : 'upcoming'}
                    </span>
                  </div>
                  {showAction && (
                    <button
                      type="button"
                      onClick={() => onOpenDay(day)}
                      className="text-[11px] font-semibold text-[var(--brand)] hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                      <Icon name="upload" size={12} /> Add Day {day}
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div
                key={day}
                className={`rounded-2xl border overflow-hidden ${
                  isToday ? 'border-[var(--brand)]/50' : 'border-[var(--border)]'
                }`}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[var(--card-2)] border-b border-[var(--border)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-[var(--brand)] text-black text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {day}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                        Day {day}
                        {isToday && (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] text-[10px] font-bold">
                            Today
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-[var(--muted)] truncate">
                        {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
                        {dayDate ? ` · ${fullDate(dayDate)}` : ''}
                      </p>
                    </div>
                  </div>
                  {isParticipant && !mine && (
                    <button
                      type="button"
                      onClick={() => onOpenDay(day)}
                      className="text-[11px] font-semibold text-[var(--brand)] hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                      <Icon name="upload" size={12} /> Add Day {day}
                    </button>
                  )}
                </div>

                <div className="divide-y divide-[var(--border)]">
                  {dayEntries.map((post) => (
                    <TimelineEntry
                      key={post.id}
                      post={post}
                      meId={meId}
                      isOwn={post.isMine}
                      onOpen={() => setOpenPost(post)}
                      onEdit={() => openEdit(post)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {shownDays < durationDays && (
            <div className="flex justify-center pt-1">
              <GhostButton
                onClick={() => setVisibleDays(Math.min(durationDays, shownDays + DAY_WINDOW))}
                className="!text-xs"
              >
                <Icon name="list" size={14} /> Show next {Math.min(DAY_WINDOW, durationDays - shownDays)} days
              </GhostButton>
            </div>
          )}
        </div>
      )}

      {openPost && <PostLightbox post={openPost} onClose={() => setOpenPost(null)} />}
    </section>
  );
}

/** First day the member has not logged yet — their natural next check-in. */
function nextOpenDay(myDays: Set<number>, durationDays: number): number {
  for (let d = 1; d <= durationDays; d++) if (!myDays.has(d)) return d;
  return durationDays;
}

/* ------------------------------- entry card ------------------------------- */

function TimelineEntry({
  post,
  meId,
  isOwn,
  onOpen,
  onEdit,
}: {
  post: FeedPost;
  meId: string | null;
  isOwn: boolean;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const store = useStore();
  const { navigate } = useNav();
  const [liked, setLiked] = useState(post.iLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLiked(post.iLiked);
    setLikeCount(post.likeCount);
  }, [post.id, post.iLiked, post.likeCount]);

  const author = store.getUser(post.authorId);
  const avatar = { name: post.authorName, avatar: post.authorAvatar, avatarHue: author?.avatarHue };

  const toggleLike = async () => {
    if (busy || !meId) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      const real = await store.togglePostLike(post.id);
      setLiked(real);
      setLikeCount((n) => Math.max(0, n + (real === next ? 0 : real ? 1 : -1)));
    } catch {
      setLiked(!next);
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="p-4 sm:p-5">
      <header className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => navigate('profile', post.authorId)}
          className="flex items-center gap-3 min-w-0 text-left group"
        >
          <Avatar user={avatar} size={38} />
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-[var(--text)] truncate group-hover:text-[var(--brand)] transition-colors">
              {post.authorName}
              {isOwn && <span className="ml-2 text-[10px] font-bold text-[var(--brand)]">YOU</span>}
            </span>
            <span className="block text-[11px] text-[var(--muted)] truncate">
              @{post.authorUsername} · {timeAgo(post.createdAt)}
            </span>
          </span>
        </button>
      </header>

      {post.note && (
        <p className="text-[13px] leading-relaxed text-[var(--text)] whitespace-pre-wrap break-words mb-3">
          {post.note}
        </p>
      )}

      {post.mediaUrl &&
        (post.mediaType === 'video' ? (
          /* player stays interactive — the comment button opens the full post */
          <div className="rounded-2xl overflow-hidden bg-black/80 border border-[var(--border)]">
            <R2Video mediaKey={post.mediaUrl} className="w-full max-h-[420px] object-contain" controls />
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="relative block w-full rounded-2xl overflow-hidden bg-black/80 border border-[var(--border)] max-h-[420px] text-left"
            aria-label={`Open Day ${post.dayNumber} proof`}
          >
            <R2Image
              mediaKey={post.mediaUrl}
              alt={`Day ${post.dayNumber} proof`}
              className="w-full max-h-[420px] object-contain"
            />
          </button>
        ))}

      <div className="flex items-center gap-5 mt-3 text-[var(--muted)]">
        <button
          type="button"
          onClick={toggleLike}
          disabled={busy || !meId}
          aria-label={`${liked ? 'Unlike' : 'Like'} ${post.authorName}'s Day ${post.dayNumber} entry`}
          className={`flex items-center gap-1.5 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
            liked ? 'text-[var(--brand)]' : 'hover:text-[var(--text)]'
          }`}
        >
          <Icon name="heart" size={16} filled={liked} className={liked ? 'like-pop' : ''} />
          {likeCount}
        </button>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Comment on ${post.authorName}'s Day ${post.dayNumber} entry`}
          className="flex items-center gap-1.5 text-[12px] font-semibold hover:text-[var(--text)] transition-colors"
        >
          <Icon name="comment" size={16} />
          {post.commentCount}
        </button>
        {isOwn && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-[var(--brand)] hover:underline"
          >
            <Icon name="edit" size={14} /> Edit entry
          </button>
        )}
      </div>
    </article>
  );
}
