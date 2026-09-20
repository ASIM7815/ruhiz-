'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Cover, EmptyState, FeedSkeleton, PrimaryButton, ProgressBar } from '@/components/ui/Primitives';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import { isoDay } from '@/lib/duel/seed';

export default function HomeView() {
  const store = useStore();
  const { navigate } = useNav();
  const { me, myActive, recommendedViews, db, hydrated } = store;

  const bestStreak = useMemo(() => myActive.reduce((m, p) => Math.max(m, p.currentStreak), 0), [myActive]);
  const checkedToday = myActive.some((p) => p.lastCheckinDate === isoDay(0));

  const trending = useMemo(
    () =>
      db.challenges
        .filter((c) => c.status === 'open' && !myActive.some((p) => p.challengeId === c.id))
        .sort((a, b) => b.participantCount + b.likeCount - (a.participantCount + a.likeCount))
        .slice(0, 4)
        .map((c) => store.getView(c)),
    [db.challenges, myActive, store]
  );

  if (!hydrated) return <FeedSkeleton count={4} />;

  return (
    <div className="max-w-5xl mx-auto space-y-8 fade-in">
      {/* Greeting / streak header */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[var(--brand)]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)] mb-2">Challenge a better you</p>
            <h1 className="display text-2xl sm:text-4xl text-[var(--text)] leading-tight">
              {greeting()}, {me?.name?.split(' ')[0]}
            </h1>
            <p className="text-sm text-[var(--muted)] mt-2 max-w-md">
              {myActive.length === 0
                ? 'You have no active duels. Pick one and start stacking days.'
                : checkedToday
                  ? `Checked in today. ${myActive.length} active duel${myActive.length > 1 ? 's' : ''} — see you tomorrow.`
                  : `${myActive.length} active duel${myActive.length > 1 ? 's' : ''} waiting on today’s check-in.`}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <PrimaryButton onClick={() => navigate('explore')}>
                <Icon name="explore" size={15} /> Find a challenge
              </PrimaryButton>
              <button
                onClick={() => navigate('create')}
                className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--card-2)] transition-colors flex items-center gap-2"
              >
                <Icon name="plus" size={15} /> Create
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:w-[280px] w-full">
            <HeroStat icon="flame" value={String(bestStreak)} label="Day streak" />
            <HeroStat icon="swords" value={String(myActive.length)} label="Active" />
            <HeroStat icon="trophy" value={String(store.myCompleted.length)} label="Won" />
          </div>
        </div>
      </section>

      {/* Continue your duels */}
      {myActive.length > 0 && (
        <section>
          <SectionHeader title="Continue your duels" icon="flame" action={{ label: 'My challenges', onClick: () => navigate('challenges') }} />
          <div className="grid gap-4 sm:grid-cols-2">
            {myActive.map((p) => {
              const ch = db.challenges.find((c) => c.id === p.challengeId);
              if (!ch) return null;
              const view = store.getView(ch);
              const dueToday = p.lastCheckinDate !== isoDay(0);
              return (
                <button
                  key={p.challengeId}
                  onClick={() => navigate('challenge', ch.id)}
                  className="text-left bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--brand)]/40 transition-colors"
                >
                  <div className="h-20 relative">
                    <Cover coverUrl={ch.coverUrl} category={view.category} title={ch.title} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <p className="absolute bottom-2 left-3 text-white font-bold text-sm display">{ch.title}</p>
                  </div>
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`flex items-center gap-1 font-bold ${p.currentStreak > 0 ? 'text-[var(--brand)]' : 'text-[var(--muted)]'}`}>
                        <Icon name="flame" size={13} className={p.currentStreak > 0 ? 'flame-live' : ''} /> {p.currentStreak}-day streak
                      </span>
                      <span className="text-[var(--muted)]">
                        {p.completedDays}/{ch.durationDays} days
                      </span>
                    </div>
                    <ProgressBar value={p.completedDays} max={ch.durationDays} />
                    <p className={`text-xs font-semibold ${dueToday ? 'text-[var(--brand)]' : 'text-[var(--muted)]'}`}>
                      {dueToday ? `Day ${p.completedDays + 1} is open — check in now` : 'Checked in today ✓'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Recommended */}
      <section>
        <SectionHeader title="Recommended for you" icon="spark" subtitle="Ranked from your joins, check-ins, saves and searches" />
        {recommendedViews.length === 0 ? (
          <EmptyState
            icon="target"
            title="No open challenges left to recommend"
            description="You have joined or completed everything matching your taste. Create the next one!"
            action={<PrimaryButton onClick={() => navigate('create')}>Create challenge</PrimaryButton>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedViews.map((v) => (
              <ChallengeCard key={v.id} view={v} />
            ))}
          </div>
        )}
      </section>

      {/* Trending */}
      <section>
        <SectionHeader title="Trending this week" icon="trending" action={{ label: 'Explore all', onClick: () => navigate('explore') }} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trending.map((v) => (
            <ChallengeCard key={v.id} view={v} />
          ))}
        </div>
      </section>

      {/* My recent check-ins */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
        <SectionHeader title="Latest check-ins" icon="chart" action={{ label: 'Progress', onClick: () => navigate('progress') }} />
        <ul className="space-y-2.5 mt-3">
          {db.checkins
            .filter((c) => c.userId === store.db.meId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)
            .map((c) => {
              const ch = db.challenges.find((x) => x.id === c.challengeId);
              return (
                <li key={c.id}>
                  <button onClick={() => navigate('challenge', c.challengeId)} className="w-full flex items-center gap-3 text-left p-2 rounded-xl hover:bg-[var(--card-2)] transition-colors">
                    <span className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] font-bold text-xs flex items-center justify-center flex-shrink-0">
                      D{c.dayNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--text)] truncate">{ch?.title ?? 'Challenge'}</span>
                      <span className="block text-xs text-[var(--muted)] truncate">{c.note || 'Checked in'}</span>
                    </span>
                    <Icon name="arrowRight" size={14} className="text-[var(--muted)]" />
                  </button>
                </li>
              );
            })}
          {db.checkins.filter((c) => c.userId === store.db.meId).length === 0 && (
            <li className="text-sm text-[var(--muted)] py-2">No check-ins yet — your first day starts when you join a challenge.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late night grind';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function HeroStat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-3 text-center">
      <Icon name={icon} size={16} className="text-[var(--brand)] mx-auto mb-1" />
      <p className="display text-xl text-[var(--text)]">{value}</p>
      <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider">{label}</p>
    </div>
  );
}

export function SectionHeader({
  title,
  icon,
  subtitle,
  action,
}: {
  title: string;
  icon?: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="display text-lg text-[var(--text)] flex items-center gap-2">
          {icon && <Icon name={icon} size={18} className="text-[var(--brand)]" />}
          {title}
        </h2>
        {subtitle && <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <button onClick={action.onClick} className="text-xs font-bold text-[var(--brand)] hover:underline flex-shrink-0">
          {action.label}
        </button>
      )}
    </div>
  );
}
