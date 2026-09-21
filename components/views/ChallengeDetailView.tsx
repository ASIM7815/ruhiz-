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
  Spinner,
} from '@/components/ui/Primitives';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import CommentsPanel from '@/components/challenge/CommentsPanel';
import { PostCard, PostLightbox } from '@/components/challenge/PostCard';
import ChallengeDayTimeline from '@/components/challenge/ChallengeDayTimeline';
import DailyPostModal from '@/components/challenge/DailyPostModal';
import { compactCount, fullDate } from '@/lib/format';
import { isoDay } from '@/lib/duel/seed';
import { calculatePerformance, type DayTimelineItem, type PerformanceReport } from '@/lib/duel/performance';
import { R2Image, R2Video } from '@/components/ui/Media';
import type { Checkin, FeedPost } from '@/lib/duel/types';

export default function ChallengeDetailView({ challengeId }: { challengeId: string }) {
  const store = useStore();
  const { navigate } = useNav();

  const [postDay, setPostDay] = useState<number | null>(null);
  const [postsVersion, setPostsVersion] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'completed' | 'missed' | 'pending'>('all');
  const [lightboxItem, setLightboxItem] = useState<{ checkin: Checkin; dayNumber: number } | null>(null);

  const view = store.findById(challengeId);

  useEffect(() => {
    if (view) store.viewChallenge(view.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  // Identify all real participants in the database
  const participants = useMemo(
    () => store.db.participants.filter((p) => p.challengeId === challengeId),
    [store.db.participants, challengeId]
  );

  const myPart = view?.participation ?? null;
  const isMine = view?.creatorId === store.db.meId;

  // Selected challenger whose proof & performance is being viewed:
  // Defaults to the current user if joined; otherwise creator or first participant.
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    if (myPart) return store.db.meId ?? view?.creatorId ?? '';
    return view?.creatorId ?? '';
  });

  useEffect(() => {
    if (myPart && !selectedUserId) {
      setSelectedUserId(store.db.meId ?? '');
    } else if (!selectedUserId && view?.creatorId) {
      setSelectedUserId(view.creatorId);
    }
  }, [myPart, selectedUserId, store.db.meId, view?.creatorId]);

  const activeUserId = selectedUserId || (myPart ? store.db.meId : view?.creatorId) || '';
  const activeUser = store.getUser(activeUserId);
  const isViewingSelf = activeUserId === store.db.meId;

  const activeParticipation = useMemo(() => {
    return participants.find((p) => p.userId === activeUserId) ?? (isViewingSelf ? myPart : null);
  }, [participants, activeUserId, isViewingSelf, myPart]);

  const relevantCheckins = useMemo(() => {
    return store.db.checkins.filter(
      (c) => c.challengeId === challengeId && c.userId === activeUserId
    );
  }, [store.db.checkins, challengeId, activeUserId]);

  // Dynamic live performance report
  const performance: PerformanceReport = useMemo(() => {
    if (!view) {
      return {
        score: 0,
        grade: 'D',
        gradeLabel: 'Needs Focus',
        gradeColor: '#f43f5e',
        completedDays: 0,
        missedDays: 0,
        pendingDays: 0,
        upcomingDays: 0,
        totalDays: 0,
        elapsedDays: 0,
        consistencyRate: 0,
        completionRate: 0,
        proofRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalCheckinsWithProof: 0,
        totalVideos: 0,
        totalPhotos: 0,
        summary: '',
        timeline: [],
      };
    }
    return calculatePerformance(view, activeParticipation, relevantCheckins);
  }, [view, activeParticipation, relevantCheckins]);

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

  const openCheckinForDay = (day: number) => {
    setPostDay(day);
  };

  const filteredTimeline = performance.timeline.filter((item) => {
    if (timelineFilter === 'completed') return item.status === 'completed';
    if (timelineFilter === 'missed') return item.status === 'missed';
    if (timelineFilter === 'pending') return item.status === 'pending' || item.status === 'upcoming';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 fade-in pb-12">
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
      >
        <Icon name="back" size={16} /> Back
      </button>

      {/* Hero Header */}
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
          {/* Real Statistics from database */}
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
                  onClick={() => openCheckinForDay((myPart.completedDays ?? 0) + 1)}
                  disabled={checkedToday}
                  className="flex-1 sm:flex-none"
                >
                  <Icon name="check" size={16} strokeWidth={3} />
                  {checkedToday ? 'Checked in today ✓' : `Check in — Day ${myPart.completedDays + 1}`}
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

          {/* Description & Rules */}
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

      {/* Performance Scorecard Section */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Icon name="chart" size={20} className="text-[var(--brand)]" />
              <h2 className="display text-lg sm:text-xl text-[var(--text)] font-bold">
                Performance Score & Metrics
              </h2>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              {isViewingSelf
                ? 'Your live consistency score based on streaks, check-ins, and proof quality.'
                : `Showing verified performance for @${activeUser?.username || 'challenger'}.`}
            </p>
          </div>

          {/* Participant switcher if multiple challengers exist */}
          {participants.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--muted)]">Challenger:</span>
              <select
                value={activeUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              >
                {participants.map((p) => {
                  const u = store.getUser(p.userId);
                  return (
                    <option key={p.userId} value={p.userId}>
                      {u.name} (@{u.username}) {p.userId === store.db.meId ? '(You)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Score Card Display */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Main Performance Score */}
          <div className="col-span-2 sm:col-span-1 bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Performance Score</span>
            <div className="my-2 flex items-baseline gap-2">
              <span className="display text-4xl font-extrabold text-[var(--text)]">
                {performance.score}%
              </span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${performance.gradeColor}22`,
                  color: performance.gradeColor,
                  border: `1px solid ${performance.gradeColor}44`,
                }}
              >
                Grade {performance.grade} · {performance.gradeLabel}
              </span>
            </div>
            <ProgressBar value={performance.score} max={100} color={performance.gradeColor} />
          </div>

          {/* Consistency Rate */}
          <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Consistency Rate</span>
            <div className="my-2">
              <p className="display text-3xl font-bold text-[var(--brand)]">
                {performance.consistencyRate}%
              </p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5 flex items-center gap-1">
                <Icon name="flame" size={13} className={performance.currentStreak > 0 ? 'flame-live' : ''} />
                {performance.currentStreak}-day current streak
              </p>
            </div>
            <ProgressBar value={performance.consistencyRate} max={100} />
          </div>

          {/* Completed vs Missed Days */}
          <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Days Breakdown</span>
            <div className="my-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--brand)] font-bold">✓ {performance.completedDays} Completed</span>
                <span className="text-amber-400 font-bold">✗ {performance.missedDays} Missed</span>
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                {performance.pendingDays > 0 ? `${performance.pendingDays} pending today` : `${performance.upcomingDays} upcoming`}
              </p>
            </div>
            <ProgressBar value={performance.completedDays} max={view.durationDays} />
          </div>

          {/* Verified Media Proofs */}
          <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Verified Proofs</span>
            <div className="my-2">
              <p className="display text-3xl font-bold text-[var(--text)]">
                {performance.totalCheckinsWithProof}
              </p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                {performance.totalVideos} videos · {performance.totalPhotos} photos
              </p>
            </div>
            <div className="text-[11px] font-semibold text-[var(--brand)]">
              {performance.proofRate}% proof rate
            </div>
          </div>
        </div>

        {/* Performance Summary Banner */}
        {performance.summary && (
          <div className="bg-[var(--card-2)]/60 border border-[var(--border)] rounded-2xl p-3.5 flex items-center gap-3 text-xs text-[var(--text)]">
            <Icon name="bolt" size={18} className="text-[var(--brand)] flex-shrink-0" />
            <p className="leading-relaxed">{performance.summary}</p>
          </div>
        )}
      </section>

      {/* Challenge Activity — community feed of every participant's posts */}
      <ChallengeActivitySection challengeId={view.id} refreshKey={postsVersion} />

      {/* Challenge Proof Timeline Section */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Icon name="calendar" size={20} className="text-[var(--brand)]" />
              <h2 className="display text-lg sm:text-xl text-[var(--text)] font-bold">
                Daily Proof & Check-in Timeline
              </h2>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              Every day’s uploaded photo/video proof, completed task descriptions, and streak log.
            </p>
          </div>

          {/* Timeline Filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <FilterChip
              label="All Days"
              count={view.durationDays}
              active={timelineFilter === 'all'}
              onClick={() => setTimelineFilter('all')}
            />
            <FilterChip
              label="Completed"
              count={performance.completedDays}
              active={timelineFilter === 'completed'}
              onClick={() => setTimelineFilter('completed')}
            />
            <FilterChip
              label="Missed"
              count={performance.missedDays}
              active={timelineFilter === 'missed'}
              onClick={() => setTimelineFilter('missed')}
            />
            <FilterChip
              label="Pending"
              count={performance.pendingDays + performance.upcomingDays}
              active={timelineFilter === 'pending'}
              onClick={() => setTimelineFilter('pending')}
            />
          </div>
        </div>

        {/* Timeline Grid / Cards */}
        {filteredTimeline.length === 0 ? (
          <div className="text-center py-10 bg-[var(--card-2)] rounded-2xl border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">No days match this filter.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredTimeline.map((item) => (
              <TimelineDayCard
                key={item.dayNumber}
                item={item}
                totalDays={view.durationDays}
                isParticipant={Boolean(myPart)}
                isViewerOwner={isViewingSelf}
                onOpenUpload={() => openCheckinForDay(item.dayNumber)}
                onViewMedia={(ck) => setLightboxItem({ checkin: ck, dayNumber: item.dayNumber })}
              />
            ))}
          </div>
        )}
      </section>

      {/* Comments Panel */}
      <CommentsPanel challengeId={view.id} />

      {/* Challenge → Day 1 → Day 2 … with real posts */}
      <ChallengeDayTimeline
        challengeId={challengeId}
        durationDays={view.durationDays}
        focusUserId={activeUserId}
        focusJoinedAt={activeParticipation?.joinedAt ?? null}
        isParticipant={Boolean(myPart) && isViewingSelf}
        refreshKey={postsVersion}
        onCreatePost={(dayNumber) => setPostDay(dayNumber)}
      />

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

      {/* Daily post modal (description + photos/videos → duel_submit_daily_post) */}
      {postDay !== null && (
        <DailyPostModal
          open
          onClose={() => setPostDay(null)}
          challengeId={challengeId}
          challengeTitle={view.title}
          durationDays={view.durationDays}
          dayNumber={postDay}
          onPosted={() => {
            setPostDay(null);
            setPostsVersion((v) => v + 1);
          }}
        />
      )}

      {/* Full Resolution Media Lightbox Modal */}
      {lightboxItem && (
        <MediaLightboxModal
          item={lightboxItem}
          challengeTitle={view.title}
          author={activeUser}
          onClose={() => setLightboxItem(null)}
        />
      )}

    </div>
  );
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

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
        active
          ? 'bg-[var(--brand)] text-black border-[var(--brand)]'
          : 'bg-[var(--card-2)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
      }`}
    >
      <span>{label}</span>
      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${active ? 'bg-black/20 text-black' : 'bg-black/40 text-[var(--muted)]'}`}>
        {count}
      </span>
    </button>
  );
}

/* ------------------------ Timeline Day Card ------------------------ */

function TimelineDayCard({
  item,
  totalDays,
  isParticipant,
  isViewerOwner,
  onOpenUpload,
  onViewMedia,
}: {
  item: DayTimelineItem;
  totalDays: number;
  isParticipant: boolean;
  isViewerOwner: boolean;
  onOpenUpload: () => void;
  onViewMedia: (ck: Checkin) => void;
}) {
  const ck = item.checkin;
  const isCompleted = item.status === 'completed';
  const isPending = item.status === 'pending';
  const isMissed = item.status === 'missed';

  return (
    <div
      className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
        isCompleted
          ? 'bg-[var(--card-2)] border-[var(--border)] hover:border-[var(--brand)]/40'
          : isPending
            ? 'bg-[var(--card-2)] border-[var(--brand)]/50 shadow-sm'
            : isMissed
              ? 'bg-[var(--card-2)]/60 border-amber-500/30'
              : 'bg-[var(--card-2)]/40 border-[var(--border)] opacity-60'
      }`}
    >
      <div>
        {/* Day Card Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${
                isCompleted
                  ? 'bg-[var(--brand)] text-black'
                  : isPending
                    ? 'bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/50'
                    : isMissed
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-[var(--card)] text-[var(--muted)]'
              }`}
            >
              {item.dayNumber}
            </span>
            <span className="font-semibold text-sm text-[var(--text)]">
              Day {item.dayNumber}
            </span>
            <span className="text-[11px] text-[var(--muted)]">
              {item.dateStr ? fullDate(item.dateStr) : `Day ${item.dayNumber} of ${totalDays}`}
            </span>
          </div>

          {/* Status Badge */}
          {isCompleted && (
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] text-[11px] font-bold flex items-center gap-1">
              <Icon name="check" size={12} strokeWidth={3} /> Completed
            </span>
          )}
          {isPending && (
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand)]/15 text-[var(--brand)] border border-[var(--brand)]/40 text-[11px] font-bold animate-pulse">
              Today Open
            </span>
          )}
          {isMissed && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-bold">
              Missed Day
            </span>
          )}
          {item.status === 'upcoming' && (
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--card)] text-[var(--muted)] text-[11px] font-medium">
              Upcoming
            </span>
          )}
        </div>

        {/* Day Card Content */}
        {isCompleted && ck ? (
          <div className="space-y-3">
            {/* Uploaded media proof thumbnail */}
            {ck.mediaUrl && (
              <div
                onClick={() => onViewMedia(ck)}
                className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-48 cursor-pointer group border border-[var(--border)]"
              >
                {ck.mediaType === 'video' ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <R2Video mediaKey={ck.mediaUrl} controls={false} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <span className="w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Icon name="bolt" size={18} />
                      </span>
                    </div>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-bold">
                      VIDEO
                    </span>
                  </div>
                ) : (
                  <div className="relative w-full h-full">
                    <R2Image mediaKey={ck.mediaUrl} alt={`Day ${item.dayNumber} proof`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-bold">
                      PHOTO
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Note / Description */}
            {ck.note ? (
              <p className="text-xs text-[var(--text)] leading-relaxed whitespace-pre-wrap bg-[var(--card)]/80 p-3 rounded-xl border border-[var(--border)]/60">
                {ck.note}
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)] italic">Checked in with verified proof.</p>
            )}
          </div>
        ) : isPending ? (
          <div className="space-y-2 py-2">
            <p className="text-xs text-[var(--text)]">
              Today’s check-in window is open. Upload photo or video proof to keep your streak going!
            </p>
            {isParticipant && isViewerOwner && (
              <PrimaryButton onClick={onOpenUpload} className="w-full !py-2 text-xs mt-2">
                <Icon name="upload" size={14} /> Upload Day {item.dayNumber} Proof
              </PrimaryButton>
            )}
          </div>
        ) : isMissed ? (
          <div className="space-y-2 py-1">
            <p className="text-xs text-[var(--muted)]">
              No check-in recorded for this day.
            </p>
            {isParticipant && isViewerOwner && (
              <button
                type="button"
                onClick={onOpenUpload}
                className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
              >
                <Icon name="edit" size={13} /> Submit proof for Day {item.dayNumber}
              </button>
            )}
          </div>
        ) : (
          <div className="py-2 text-xs text-[var(--muted)]">
            Day locked until reached in the challenge schedule.
          </div>
        )}
      </div>

      {/* Edit button if completed and viewer owns the record */}
      {isCompleted && isViewerOwner && (
        <div className="pt-3 border-t border-[var(--border)]/50 mt-3 flex justify-end">
          <button
            type="button"
            onClick={onOpenUpload}
            className="text-[11px] font-semibold text-[var(--brand)] hover:underline flex items-center gap-1"
          >
            <Icon name="edit" size={12} /> Edit Proof
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------- Lightbox Modal for Full Media -------------------- */

function MediaLightboxModal({
  item,
  challengeTitle,
  author,
  onClose,
}: {
  item: { checkin: Checkin; dayNumber: number };
  challengeTitle: string;
  author: any;
  onClose: () => void;
}) {
  const ck = item.checkin;

  return (
    <Modal open={true} onClose={onClose} labelledBy="proof-lightbox" maxWidth="max-w-3xl">
      <ModalHeader
        title={`Day ${item.dayNumber} Proof`}
        onClose={onClose}
        subtitle={challengeTitle}
      />

      <div className="p-5 sm:p-6 space-y-4">
        {/* Media Player / Image */}
        <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[65vh]">
          {ck.mediaType === 'video' ? (
            <R2Video mediaKey={ck.mediaUrl} controls autoPlay className="w-full max-h-[65vh] object-contain" />
          ) : (
            <R2Image mediaKey={ck.mediaUrl} alt={`Day ${item.dayNumber} proof`} className="w-full max-h-[65vh] object-contain" />
          )}
        </div>

        {/* Challenger Info and Description */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-3">
              <Avatar user={author} size={40} />
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{author?.name}</p>
                <p className="text-xs text-[var(--muted)]">@{author?.username}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-[var(--brand)]">Day {item.dayNumber}</span>
              <p className="text-[11px] text-[var(--muted)]">{fullDate(ck.date || ck.createdAt)}</p>
            </div>
          </div>

          {ck.note && (
            <div className="bg-[var(--card-2)] p-4 rounded-xl border border-[var(--border)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
                Proof Description
              </p>
              <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed">{ck.note}</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------ Challenge Activity (community posts) ------------------ */

function ChallengeActivitySection({ challengeId, refreshKey = 0 }: { challengeId: string; refreshKey?: number }) {
  const store = useStore();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [openPost, setOpenPost] = useState<FeedPost | null>(null);

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

  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="grid" size={20} className="text-[var(--brand)]" />
            <h2 className="display text-lg sm:text-xl text-[var(--text)] font-bold">Challenge Activity</h2>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Every photo and video posted by this duel&apos;s challengers — the journey as it happens.
          </p>
        </div>
        {posts && posts.length > 0 && (
          <span className="text-xs font-semibold text-[var(--muted)] flex-shrink-0">
            {posts.length} post{posts.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {posts === null ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-[var(--border)] rounded-2xl">
          <p className="text-sm font-semibold text-[var(--text)]">No posts yet</p>
          <p className="text-xs text-[var(--muted)] mt-1 max-w-sm mx-auto">
            Proof lands here the moment challengers check in with a photo or video. Day 1 lights the fuse.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
          {posts.map((p) => (
            <div key={p.id} className="w-40 sm:w-48 flex-shrink-0">
              <PostCard post={p} onOpen={setOpenPost} />
            </div>
          ))}
        </div>
      )}

      {openPost && <PostLightbox post={openPost} onClose={() => setOpenPost(null)} />}
    </section>
  );
}
