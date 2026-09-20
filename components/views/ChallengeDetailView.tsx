'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, Badge, Cover, DifficultyBadge, EmptyState, GhostButton, PrimaryButton, ProgressBar } from '@/components/ui/Primitives';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import CheckinModal from '@/components/challenge/CheckinModal';
import CommentsPanel from '@/components/challenge/CommentsPanel';
import { compactCount, fullDate } from '@/lib/format';
import { isoDay } from '@/lib/duel/seed';

export default function ChallengeDetailView({ challengeId }: { challengeId: string }) {
  const store = useStore();
  const { navigate } = useNav();
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const view = store.findById(challengeId);

  useEffect(() => {
    if (view) store.viewChallenge(view.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  const myCheckins = useMemo(
    () => store.db.checkins.filter((c) => c.challengeId === challengeId && c.userId === store.db.meId).sort((a, b) => a.dayNumber - b.dayNumber),
    [store.db.checkins, challengeId, store.db.meId]
  );

  if (!view) {
    return (
      <EmptyState
        icon="warning"
        title="Challenge not found"
        description="It may have been deleted by its creator."
        action={<PrimaryButton onClick={() => navigate('explore')}>Browse challenges</PrimaryButton>}
      />
    );
  }

  const part = view.participation;
  const creator = store.getUser(view.creatorId);
  const isMine = view.creatorId === store.db.meId;
  const checkedToday = part?.lastCheckinDate === isoDay(0);
  const similar = store.db.challenges
    .filter((c) => c.categoryId === view.categoryId && c.id !== view.id)
    .slice(0, 4)
    .map((c) => store.getView(c));

  const messageCreator = async () => {
    const threadId = await store.openThreadWith(view.creatorId);
    if (threadId) navigate('messages', threadId);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 fade-in">
      {/* Back */}
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors">
        <Icon name="back" size={16} /> Back
      </button>

      {/* Hero */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl overflow-hidden">
        <div className="relative h-48 sm:h-60">
          <Cover coverUrl={view.coverUrl} category={view.category} title={view.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge>{view.category?.emoji} {view.category?.name}</Badge>
              <DifficultyBadge level={view.difficulty} />
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand)] text-black text-xs font-bold display">{view.durationDays} Days</span>
            </div>
            <h1 className="display text-2xl sm:text-3xl text-white">{view.title}</h1>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
            <Stat label="Challengers" value={compactCount(view.participantCount)} icon="people" />
            <Stat label="Likes" value={compactCount(view.likeCount)} icon="heart" />
            <Stat label="Saves" value={compactCount(view.saveCount)} icon="bookmark" />
            <Stat label="Finished" value={compactCount(view.completionCount)} icon="trophy" />
            <Stat label="Comments" value={compactCount(view.commentCount)} icon="comment" />
            <Stat label="Views" value={compactCount(view.viewCount)} icon="eye" />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {!part ? (
              <PrimaryButton onClick={() => store.joinChallenge(view.id)} className="flex-1 sm:flex-none">
                <Icon name="swords" size={16} /> Join challenge
              </PrimaryButton>
            ) : part.status === 'active' ? (
              <>
                <PrimaryButton onClick={() => setCheckinOpen(true)} disabled={checkedToday} className="flex-1 sm:flex-none">
                  <Icon name="check" size={16} strokeWidth={3} />
                  {checkedToday ? 'Checked in today' : `Check in — day ${part.completedDays + 1}`}
                </PrimaryButton>
                {!isMine && (
                  <GhostButton onClick={() => store.leaveChallenge(view.id)}>
                    <Icon name="logout" size={15} /> Leave
                  </GhostButton>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] font-bold text-sm">
                <Icon name="trophy" size={16} /> Completed {part.completedAt ? fullDate(part.completedAt) : ''}
              </div>
            )}

            <GhostButton onClick={() => store.toggleLike(view.id)} className={view.liked ? '!text-[var(--brand)] !border-[var(--brand)]/40' : ''}>
              <Icon name="heart" size={15} filled={view.liked} /> {compactCount(view.likeCount)}
            </GhostButton>
            <GhostButton onClick={() => store.toggleSave(view.id)} className={view.saved ? '!text-[var(--brand)] !border-[var(--brand)]/40' : ''}>
              <Icon name="bookmark" size={15} filled={view.saved} /> {view.saved ? 'Saved' : 'Save'}
            </GhostButton>
            <GhostButton onClick={() => store.shareChallenge(view.id)}>
              <Icon name="share" size={15} /> Share
            </GhostButton>

            <div className="relative ml-auto">
              <button onClick={() => setMenuOpen((v) => !v)} className="p-2.5 rounded-xl hover:bg-[var(--card-2)] text-[var(--muted)]" aria-label="More options">
                <Icon name="dots" size={18} />
              </button>
              {menuOpen && (
                <div className="pop-in absolute right-0 top-full mt-1 w-52 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-20 overflow-hidden">
                  {!isMine && (
                    <button onClick={() => { setMenuOpen(false); void messageCreator(); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2">
                      <Icon name="chat" size={15} className="text-[var(--muted)]" /> Message creator
                    </button>
                  )}
                  {isMine && (
                    <button onClick={() => { setMenuOpen(false); navigate('create', view.id); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2">
                      <Icon name="edit" size={15} className="text-[var(--muted)]" /> Edit challenge
                    </button>
                  )}
                  {isMine ? (
                    <button onClick={() => { setMenuOpen(false); void store.deleteChallenge(view.id).then((ok) => ok && navigate('challenges')); }} className="w-full text-left px-4 py-2.5 text-sm text-[var(--danger)] hover:bg-[var(--danger-soft)] flex items-center gap-2">
                      <Icon name="trash" size={15} /> Delete challenge
                    </button>
                  ) : (
                    <button onClick={() => { setMenuOpen(false); store.notInterested(view.id); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2">
                      <Icon name="eyeOff" size={15} className="text-[var(--muted)]" /> Not interested
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* My progress */}
          {part && (
            <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span className="flex items-center gap-1.5 font-bold text-[var(--brand)]">
                  <Icon name="flame" size={16} className={part.currentStreak > 0 ? 'flame-live' : ''} /> {part.currentStreak}-day streak
                </span>
                <span className="text-[var(--muted)]">Longest: <b className="text-[var(--text)]">{part.longestStreak}</b></span>
                <span className="text-[var(--muted)]">Logged: <b className="text-[var(--text)]">{part.completedDays}/{view.durationDays}</b></span>
                <span className="text-[var(--muted)]">Joined: <b className="text-[var(--text)]">{fullDate(part.joinedAt)}</b></span>
              </div>
              <ProgressBar value={part.completedDays} max={view.durationDays} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Array.from({ length: view.durationDays }, (_, i) => i + 1).slice(0, 120).map((day) => {
                  const done = myCheckins.some((c) => c.dayNumber === day);
                  const isToday = day === part.completedDays + 1 && part.status === 'active';
                  return (
                    <span
                      key={day}
                      title={`Day ${day}${done ? ' ✓' : ''}`}
                      className={`w-4 h-4 rounded-[5px] text-[8px] flex items-center justify-center font-bold ${
                        done ? 'bg-[var(--brand)] text-black' : isToday ? 'border-2 border-[var(--brand)] text-[var(--brand)]' : 'bg-[var(--border)] text-transparent'
                      }`}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{view.description}</p>
            <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-4 flex gap-3">
              <Icon name="target" size={18} className="text-[var(--brand)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1">Daily task</p>
                <p className="text-sm text-[var(--text)]">{view.dailyTask}</p>
              </div>
            </div>
            {view.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {view.tags.map((t) => (
                  <button key={t} onClick={() => navigate('explore', t)} className="px-2.5 py-1 rounded-full bg-[var(--card-2)] text-[var(--muted)] text-xs hover:text-[var(--brand)] transition-colors">
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Creator */}
          <div className="flex items-center gap-3 border-t border-[var(--border)] pt-4">
            <Avatar user={creator} size={44} onClick={() => navigate('profile', view.creatorId)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text)] flex items-center gap-1.5">
                {creator.name} {creator.verified && <Icon name="badge" size={14} className="text-[var(--brand)]" />}
              </p>
              <p className="text-xs text-[var(--muted)] truncate">@{creator.username} · created {fullDate(view.createdAt)}</p>
            </div>
            {!isMine && (
              <GhostButton onClick={() => void messageCreator()}>
                <Icon name="chat" size={15} /> Message
              </GhostButton>
            )}
          </div>
        </div>
      </div>

      {/* Check-in log */}
      {part && myCheckins.length > 0 && (
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="display text-sm text-[var(--text)] mb-4 flex items-center gap-2">
            <Icon name="chart" size={16} className="text-[var(--brand)]" /> Your check-in log
          </h3>
          <ul className="space-y-2.5">
            {myCheckins.slice().reverse().map((c) => (
              <li key={c.id} className="flex gap-3 text-sm">
                <span className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] font-bold flex items-center justify-center flex-shrink-0 text-xs">
                  D{c.dayNumber}
                </span>
                <div className="min-w-0">
                  <p className="text-[var(--text)]">{c.note || 'Checked in.'}</p>
                  <p className="text-[11px] text-[var(--muted)]">{fullDate(c.date)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CommentsPanel challengeId={view.id} />

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

      <CheckinModal view={view} open={checkinOpen} onClose={() => setCheckinOpen(false)} />
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
