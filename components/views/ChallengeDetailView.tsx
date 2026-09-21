'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import {
  Avatar,
  Badge,
  Cover,
  DifficultyBadge,
  EmptyState,
  GhostButton,
  Modal,
  ModalHeader,
  PrimaryButton,
  ProgressBar,
} from '@/components/ui/Primitives';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import CheckinModal from '@/components/challenge/CheckinModal';
import PostCard from '@/components/posts/PostCard';
import PostLightbox from '@/components/posts/PostLightbox';
import CommentsPanel from '@/components/challenge/CommentsPanel';
import { compactCount, fullDate } from '@/lib/format';
import { isoDay } from '@/lib/duel/seed';
import { calculatePerformance, type PerformanceReport } from '@/lib/duel/performance';
import type { ChallengePost } from '@/lib/duel/types';

/**
 * CHALLENGE VIEW = EVERYTHING HAPPENING INSIDE THAT CHALLENGE.
 *
 * Two clearly separated concepts, top to bottom:
 *   1. Challenge information — cover, creator, category, duration, difficulty,
 *      description, rules, daily task, participants, join/save/share.
 *   2. Challenge activity — the posts participants log (photo/video +
 *      description + day number), each with real likes/comments/saves/shares.
 *
 * Plus the participant journey: my day-by-day progress and each challenger's
 * completion, streak and score — all computed from real posts.
 */
export default function ChallengeDetailView({ challengeId }: { challengeId: string }) {
  const store = useStore();
  const { navigate } = useNav();

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinDay, setCheckinDay] = useState<number | undefined>(undefined);
  const [editingPost, setEditingPost] = useState<ChallengePost | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedUser, setFeedUser] = useState<string>('all');
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  const view = store.findById(challengeId);

  useEffect(() => {
    if (view) store.viewChallenge(view.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  useEffect(() => {
    setFeedUser('all');
  }, [challengeId]);

  const participants = useMemo(
    () => store.db.participants.filter((p) => p.challengeId === challengeId),
    [store.db.participants, challengeId]
  );

  const myPart = view?.participation ?? null;
  const isMine = view?.creatorId === store.db.meId;

  const myPosts = useMemo(
    () => store.db.posts.filter((p) => p.challengeId === challengeId && p.userId === store.db.meId),
    [store.db.posts, challengeId, store.db.meId]
  );

  const myPerformance: PerformanceReport = useMemo(() => {
    if (!view) return emptyReport();
    return calculatePerformance(view, myPart, myPosts);
  }, [view, myPart, myPosts]);

  const feedPosts = useMemo(() => {
    let list = store.db.posts.filter((p) => p.challengeId === challengeId);
    if (feedUser !== 'all') list = list.filter((p) => p.userId === feedUser);
    // Only real members: skip rows whose profile no longer resolves.
    list = list.filter((p) => store.hasProfile(p.userId) || p.userId === store.db.meId);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [store.db.posts, store.db.meId, challengeId, feedUser, store]);

  const openPost = openPostId ? store.findPost(openPostId) : undefined;

  if (!view) {
    return (
      <EmptyState
        icon="warning"
        title="Challenge not found"
        description="This challenge does not exist or may have been removed."
        action={<PrimaryButton onClick={() => navigate('explore')}>Browse challenges</PrimaryButton>}
      />
    );
  }

  const creator = store.getUser(view.creatorId);
  const checkedToday = myPart?.lastCheckinDate === isoDay(0);

  const similar = store.db.challenges
    .filter((c) => c.categoryId === view.categoryId && c.id !== view.id)
    .slice(0, 4)
    .map((c) => store.getView(c));

  const messageCreator = async () => {
    const threadId = await store.openThreadWith(view.creatorId);
    if (threadId) navigate('messages', threadId);
  };

  const openCheckinForDay = (day: number, existing?: ChallengePost) => {
    setCheckinDay(day);
    setEditingPost(existing ?? null);
    setCheckinOpen(true);
  };

  const nextDay = (myPart?.completedDays ?? 0) + 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6 fade-in pb-12">
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
      >
        <Icon name="back" size={16} /> Back
      </button>

      {/* ================================================================ */}
      {/* 1. CHALLENGE INFORMATION                                          */}
      {/* ================================================================ */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl overflow-hidden">
        <div className="relative h-52 sm:h-64">
          <Cover coverUrl={view.coverUrl} category={view.category} title={view.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <Badge>{view.category?.emoji} {view.category?.name}</Badge>
              <DifficultyBadge level={view.difficulty} />
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand)] text-black text-xs font-bold display">
                {view.durationDays} Days
              </span>
            </div>
            <h1 className="display text-2xl sm:text-4xl text-white font-bold">{view.title}</h1>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Real statistics from database counters */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
            <Stat label="Challengers" value={compactCount(view.participantCount)} icon="people" />
            <Stat label="Likes" value={compactCount(view.likeCount)} icon="heart" />
            <Stat label="Saves" value={compactCount(view.saveCount)} icon="bookmark" />
            <Stat label="Finished" value={compactCount(view.completionCount)} icon="trophy" />
            <Stat label="Comments" value={compactCount(view.commentCount)} icon="comment" />
            <Stat label="Views" value={compactCount(view.viewCount)} icon="eye" />
          </div>

          {/* Primary Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!myPart ? (
              <PrimaryButton onClick={() => store.joinChallenge(view.id)} className="flex-1 sm:flex-none">
                <Icon name="swords" size={16} /> Join challenge
              </PrimaryButton>
            ) : myPart.status === 'active' ? (
              <>
                <PrimaryButton
                  onClick={() => openCheckinForDay(nextDay)}
                  disabled={checkedToday}
                  className="flex-1 sm:flex-none"
                >
                  <Icon name="check" size={16} strokeWidth={3} />
                  {checkedToday ? 'Checked in today ✓' : `Check in — Day ${nextDay}`}
                </PrimaryButton>
                {!isMine && (
                  <GhostButton onClick={() => store.leaveChallenge(view.id)}>
                    <Icon name="logout" size={15} /> Leave
                  </GhostButton>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] font-bold text-sm">
                <Icon name="trophy" size={16} /> Completed {myPart.completedAt ? fullDate(myPart.completedAt) : ''}
              </div>
            )}

            <GhostButton
              onClick={() => store.toggleLike(view.id)}
              className={view.liked ? '!text-[var(--brand)] !border-[var(--brand)]/40' : ''}
            >
              <Icon name="heart" size={15} filled={view.liked} /> {compactCount(view.likeCount)}
            </GhostButton>

            <GhostButton
              onClick={() => store.toggleSave(view.id)}
              className={view.saved ? '!text-[var(--brand)] !border-[var(--brand)]/40' : ''}
            >
              <Icon name="bookmark" size={15} filled={view.saved} /> {view.saved ? 'Saved' : 'Save'}
            </GhostButton>

            <GhostButton onClick={() => store.shareChallenge(view.id)}>
              <Icon name="share" size={15} /> Share
            </GhostButton>

            <div className="relative ml-auto">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2.5 rounded-xl hover:bg-[var(--card-2)] text-[var(--muted)]"
                aria-label="More options"
              >
                <Icon name="dots" size={18} />
              </button>
              {menuOpen && (
                <div className="pop-in absolute right-0 top-full mt-1 w-52 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-20 overflow-hidden">
                  {!isMine && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        void messageCreator();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2"
                    >
                      <Icon name="chat" size={15} className="text-[var(--muted)]" /> Message creator
                    </button>
                  )}
                  {isMine && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('create', view.id);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2"
                    >
                      <Icon name="edit" size={15} className="text-[var(--muted)]" /> Edit challenge
                    </button>
                  )}
                  {isMine ? (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        void store.deleteChallenge(view.id).then((ok) => ok && navigate('challenges'));
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-[var(--danger)] hover:bg-[var(--danger-soft)] flex items-center gap-2"
                    >
                      <Icon name="trash" size={15} /> Delete challenge
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        store.notInterested(view.id);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2"
                    >
                      <Icon name="eyeOff" size={15} className="text-[var(--muted)]" /> Not interested
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description, rules & daily task */}
          <div className="space-y-3 pt-2">
            <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{view.description}</p>
            <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-4 flex gap-3">
              <Icon name="target" size={20} className="text-[var(--brand)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1">Daily Task Rule</p>
                <p className="text-sm text-[var(--text)]">{view.dailyTask}</p>
              </div>
            </div>
            {view.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {view.tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => navigate('explore', t)}
                    className="px-2.5 py-1 rounded-full bg-[var(--card-2)] text-[var(--muted)] text-xs hover:text-[var(--brand)] transition-colors"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Creator Attribution */}
          <div className="flex items-center gap-3 border-t border-[var(--border)] pt-4">
            <Avatar user={creator} size={44} onClick={() => navigate('profile', view.creatorId)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text)] flex items-center gap-1.5">
                {creator.name} {creator.verified && <Icon name="badge" size={14} className="text-[var(--brand)]" />}
              </p>
              <p className="text-xs text-[var(--muted)] truncate">
                @{creator.username} · created {fullDate(view.createdAt)}
              </p>
            </div>
            {!isMine && (
              <GhostButton onClick={() => void messageCreator()}>
                <Icon name="chat" size={15} /> Message
              </GhostButton>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 2. MY PROGRESS (my journey through this challenge)               */}
      {/* ================================================================ */}
      {myPart && (
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon name="flame" size={20} className="text-[var(--brand)]" />
              <h2 className="display text-lg sm:text-xl text-[var(--text)] font-bold">My progress</h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1">
                <Icon name="flame" size={13} className={myPart.currentStreak > 0 ? 'text-[var(--brand)] flame-live' : ''} />
                {myPart.currentStreak}-day streak
              </span>
              <span>·</span>
              <span>best {myPart.longestStreak}</span>
              <span>·</span>
              <span>{myPart.completedDays}/{view.durationDays} days</span>
            </div>
          </div>

          <ProgressBar value={myPart.completedDays} max={view.durationDays} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <MiniStat label="Performance" value={`${myPerformance.score}%`} sub={`Grade ${myPerformance.grade} · ${myPerformance.gradeLabel}`} />
            <MiniStat label="Consistency" value={`${myPerformance.consistencyRate}%`} sub={`${myPerformance.completedDays} completed · ${myPerformance.missedDays} missed`} />
            <MiniStat label="Proof rate" value={`${myPerformance.proofRate}%`} sub={`${myPerformance.totalVideos} videos · ${myPerformance.totalPhotos} photos`} />
            <MiniStat
              label="Current day"
              value={myPart.status === 'completed' ? 'Done' : `Day ${Math.min(nextDay, view.durationDays)}`}
              sub={checkedToday ? 'Checked in today' : 'Today is open'}
            />
          </div>

          {/* Day grid: which days I completed / missed / have ahead */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Day map — tap a day to log or edit its proof</p>
            <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
              {myPerformance.timeline.map((d) => {
                const done = d.status === 'completed';
                const missed = d.status === 'missed';
                const pending = d.status === 'pending';
                return (
                  <button
                    key={d.dayNumber}
                    onClick={() => {
                      if (myPart.status !== 'completed') openCheckinForDay(d.dayNumber, d.checkin);
                    }}
                    title={`Day ${d.dayNumber} — ${d.status}`}
                    className={`h-8 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors border ${
                      done
                        ? 'bg-[var(--brand)]/20 border-[var(--brand)]/50 text-[var(--brand)] hover:bg-[var(--brand)]/30'
                        : pending
                          ? 'bg-[var(--brand)]/10 border-[var(--brand)] text-[var(--brand)] animate-pulse'
                          : missed
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                            : 'bg-[var(--card-2)] border-[var(--border)] text-[var(--muted)] opacity-70'
                    }`}
                  >
                    {d.dayNumber}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* 3. CHALLENGERS (real participants with real progress)            */}
      {/* ================================================================ */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="people" size={20} className="text-[var(--brand)]" />
          <h2 className="display text-lg sm:text-xl text-[var(--text)] font-bold">
            Challengers <span className="text-sm text-[var(--muted)] font-normal">({participants.length})</span>
          </h2>
        </div>
        {participants.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No challengers yet. {myPart ? '' : 'Join to become the first.'}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {participants.map((p) => {
              const u = store.getUser(p.userId);
              const me = p.userId === store.db.meId;
              return (
                <button
                  key={p.userId}
                  onClick={() => setFeedUser(feedUser === p.userId ? 'all' : p.userId)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${
                    feedUser === p.userId ? 'border-[var(--brand)]/60 bg-[var(--brand-soft)]' : 'border-[var(--border)] hover:bg-[var(--card-2)]'
                  }`}
                >
                  <Avatar user={u} size={38} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text)] truncate">
                      {u.name} {me && <span className="text-[var(--brand)] text-xs">(You)</span>}
                    </span>
                    <span className="block text-[11px] text-[var(--muted)]">
                      Day {p.completedDays}/{view.durationDays} · streak {p.currentStreak} · {Math.round((p.completedDays / Math.max(1, view.durationDays)) * 100)}%
                      {p.status === 'completed' && ' · 🏆 finished'}
                    </span>
                  </span>
                  <Icon name={feedUser === p.userId ? 'check' : 'eye'} size={14} className={feedUser === p.userId ? 'text-[var(--brand)]' : 'text-[var(--muted)]'} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* 4. CHALLENGE ACTIVITY — progress posts by participants           */}
      {/* ================================================================ */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="display text-lg sm:text-xl text-[var(--text)] font-bold flex items-center gap-2">
              <Icon name="bolt" size={18} className="text-[var(--brand)]" />
              {feedUser === 'all' ? 'Challenge activity' : 'Posts by'}
              {feedUser !== 'all' && (
                <span className="text-[var(--brand)]">{store.getUser(feedUser).name}</span>
              )}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {feedPosts.length} real progress post{feedPosts.length === 1 ? '' : 's'} — every photo and video a challenger logged in this challenge.
            </p>
          </div>
          {feedUser !== 'all' && (
            <button onClick={() => setFeedUser('all')} className="text-xs font-bold text-[var(--brand)] hover:underline">
              Show everyone
            </button>
          )}
        </div>

        {feedPosts.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center">
            <Icon name="camera" size={28} className="text-[var(--muted)] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--text)]">
              {feedUser === 'all' ? 'No progress posts yet' : 'No posts from this challenger yet'}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              {myPart
                ? 'Join the journey — upload your first photo or video for today.'
                : 'Join this challenge and log the first day.'}
            </p>
            {myPart && myPart.status === 'active' && (
              <PrimaryButton className="mt-4" onClick={() => openCheckinForDay(nextDay)}>
                <Icon name="upload" size={15} /> Log Day {Math.min(nextDay, view.durationDays)}
              </PrimaryButton>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {feedPosts.map((post) => (
              <PostCard key={post.id} post={post} onOpen={() => setOpenPostId(post.id)} onEdit={() => openCheckinForDay(post.dayNumber, post)} />
            ))}
          </div>
        )}
      </section>

      {/* Challenge-level comments */}
      <CommentsPanel challengeId={view.id} />

      {/* Similar challenges in category */}
      {similar.length > 0 && (
        <section>
          <h3 className="display text-sm text-[var(--text)] mb-3 flex items-center gap-2">
            <Icon name="spark" size={16} className="text-[var(--brand)]" /> More in {view.category?.name}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {similar.map((s) => (
              <ChallengeCard key={s.id} view={s} />
            ))}
          </div>
        </section>
      )}

      {/* Daily Proof Upload Modal */}
      <CheckinModal
        view={view}
        open={checkinOpen}
        dayNumber={checkinDay}
        initialCheckin={editingPost}
        onClose={() => {
          setCheckinOpen(false);
          setEditingPost(null);
        }}
      />

      {/* Post detail with comments */}
      {openPost && (
        <PostLightbox
          post={openPost}
          onClose={() => setOpenPostId(null)}
          onEdit={() => openCheckinForDay(openPost.dayNumber, openPost)}
        />
      )}
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function emptyReport(): PerformanceReport {
  return {
    score: 0, grade: 'D', gradeLabel: 'Needs Focus', gradeColor: '#f43f5e',
    completedDays: 0, missedDays: 0, pendingDays: 0, upcomingDays: 0, totalDays: 0, elapsedDays: 0,
    consistencyRate: 0, completionRate: 0, proofRate: 0, currentStreak: 0, longestStreak: 0,
    totalCheckinsWithProof: 0, totalVideos: 0, totalPhotos: 0, summary: '', timeline: [],
  };
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-xl py-2.5 px-1">
      <Icon name={icon} size={15} className="text-[var(--brand)] mx-auto mb-1" />
      <p className="text-sm font-bold text-[var(--text)]">{value}</p>
      <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="display text-xl text-[var(--text)] mt-1">{value}</p>
      <p className="text-[10px] text-[var(--muted)] mt-0.5 leading-snug">{sub}</p>
    </div>
  );
}
