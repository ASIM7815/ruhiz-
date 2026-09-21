'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { EmptyState, PrimaryButton, ProgressBar } from '@/components/ui/Primitives';
import { isoDay } from '@/lib/duel/seed';

export default function ProgressView() {
  const store = useStore();
  const { navigate } = useNav();
  const { db, myActive, myCompleted } = store;

  const myCheckins = useMemo(() => db.posts.filter((c) => c.userId === db.meId), [db.posts, db.meId]);

  const stats = useMemo(() => {
    const bestCurrent = myActive.reduce((m, p) => Math.max(m, p.currentStreak), 0);
    const bestEver = [...myActive, ...myCompleted].reduce((m, p) => Math.max(m, p.longestStreak), 0);
    const totalDays = myCheckins.length;
    const completions = myCompleted.length;
    return { bestCurrent, bestEver, totalDays, completions };
  }, [myActive, myCompleted, myCheckins]);

  /** last 14 days activity bars */
  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const date = isoDay(i - 13);
      const count = myCheckins.filter((c) => c.date === date).length;
      return { date, count };
    });
  }, [myCheckins]);
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const badges = useMemo(() => {
    const list: { id: string; name: string; desc: string; icon: string; earned: boolean }[] = [
      { id: 'first', name: 'First Blood', desc: 'Log your first check-in', icon: 'bolt', earned: stats.totalDays >= 1 },
      { id: 'week', name: 'Week Warrior', desc: 'Hold a 7-day streak', icon: 'flame', earned: stats.bestEver >= 7 },
      { id: 'month', name: 'Iron Month', desc: 'Hold a 30-day streak', icon: 'shield', earned: stats.bestEver >= 30 },
      { id: 'winner', name: 'Duel Winner', desc: 'Complete a challenge', icon: 'trophy', earned: stats.completions >= 1 },
      { id: 'triple', name: 'Hat Trick', desc: 'Complete 3 challenges', icon: 'medal', earned: stats.completions >= 3 },
      { id: 'creator', name: 'Architect', desc: 'Create a challenge', icon: 'swords', earned: store.createdViews.length >= 1 },
      { id: 'social', name: 'Team Player', desc: 'Comment on a challenge', icon: 'comment', earned: db.comments.some((c) => c.userId === db.meId) },
      { id: 'collector', name: 'Collector', desc: 'Save 5 challenges', icon: 'bookmark', earned: db.saves.filter((s) => s.userId === db.meId).length >= 5 },
    ];
    return list;
  }, [stats, store.createdViews.length, db.comments, db.saves, db.meId]);

  if (!store.hydrated) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-[var(--text)]">Progress</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Your record: streaks, check-ins and trophies.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="flame" value={stats.bestCurrent} label="Current streak" accent />
        <StatCard icon="chart" value={stats.totalDays} label="Check-ins logged" />
        <StatCard icon="trophy" value={stats.completions} label="Challenges won" />
        <StatCard icon="medal" value={stats.bestEver} label="Best streak" />
      </div>

      {/* 14-day activity */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
        <h2 className="display text-sm text-[var(--text)] mb-4 flex items-center gap-2">
          <Icon name="chart" size={16} className="text-[var(--brand)]" /> Last 14 days
        </h2>
        <div className="flex items-end gap-2 h-28">
          {days.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5" title={`${d.date}: ${d.count} check-in(s)`}>
              <div className="w-full rounded-t-lg bg-[var(--card-2)] relative overflow-hidden" style={{ height: '100%' }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-500"
                  style={{ height: `${(d.count / maxDay) * 100}%`, background: d.count ? 'linear-gradient(180deg, var(--brand), var(--brand-dark))' : 'transparent' }}
                />
              </div>
              <span className="text-[9px] text-[var(--muted)]">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Active duel progress */}
      <section className="space-y-3">
        <h2 className="display text-sm text-[var(--text)] flex items-center gap-2">
          <Icon name="swords" size={16} className="text-[var(--brand)]" /> Active duels
        </h2>
        {myActive.length === 0 && (
          <EmptyState
            icon="swords"
            title="No active duels"
            description="Join a challenge to start tracking daily progress and streaks."
            action={<PrimaryButton onClick={() => navigate('explore')}>Browse challenges</PrimaryButton>}
          />
        )}
        {myActive.map((p) => {
          const ch = db.challenges.find((c) => c.id === p.challengeId);
          if (!ch) return null;
          const due = p.lastCheckinDate !== isoDay(0);
          return (
            <div key={p.challengeId} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <button onClick={() => navigate('challenge', ch.id)} className="font-bold text-[var(--text)] text-sm hover:text-[var(--brand)] transition-colors text-left">
                  {ch.title}
                </button>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-[var(--muted)]">
                  <span className="flex items-center gap-1 text-[var(--brand)] font-bold">
                    <Icon name="flame" size={12} className={p.currentStreak > 0 ? 'flame-live' : ''} /> {p.currentStreak}
                  </span>
                  <span>Day {p.completedDays}/{ch.durationDays}</span>
                  <span>{Math.round((p.completedDays / ch.durationDays) * 100)}%</span>
                </div>
                <ProgressBar value={p.completedDays} max={ch.durationDays} className="mt-2" />
              </div>
              <PrimaryButton onClick={() => navigate('challenge', ch.id)} disabled={!due} className="flex-shrink-0">
                {due ? 'Check in' : 'Done today ✓'}
              </PrimaryButton>
            </div>
          );
        })}
      </section>

      {/* Completed */}
      {myCompleted.length > 0 && (
        <section className="space-y-3">
          <h2 className="display text-sm text-[var(--text)] flex items-center gap-2">
            <Icon name="trophy" size={16} className="text-[var(--brand)]" /> Won duels
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {myCompleted.map((p) => {
              const ch = db.challenges.find((c) => c.id === p.challengeId);
              if (!ch) return null;
              return (
                <button key={p.challengeId} onClick={() => navigate('challenge', ch.id)} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3 text-left hover:border-[var(--brand)]/40 transition-colors">
                  <span className="w-11 h-11 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center flex-shrink-0">
                    <Icon name="trophy" size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold text-sm text-[var(--text)] truncate">{ch.title}</span>
                    <span className="block text-xs text-[var(--muted)]">{ch.durationDays} days · best streak {p.longestStreak}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Badges */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
        <h2 className="display text-sm text-[var(--text)] mb-4 flex items-center gap-2">
          <Icon name="medal" size={16} className="text-[var(--brand)]" /> Achievements
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`rounded-2xl border p-4 text-center transition-all ${
                b.earned ? 'border-[var(--brand)]/50 bg-[var(--brand-soft)]' : 'border-[var(--border)] bg-[var(--card-2)] opacity-60'
              }`}
              title={b.desc}
            >
              <Icon name={b.icon} size={22} className={`mx-auto mb-2 ${b.earned ? 'text-[var(--brand)]' : 'text-[var(--muted)]'}`} />
              <p className="text-xs font-bold text-[var(--text)]">{b.name}</p>
              <p className="text-[10px] text-[var(--muted)] mt-0.5 leading-snug">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, value, label, accent = false }: { icon: string; value: number; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 text-center ${accent ? 'border-[var(--brand)]/50 bg-[var(--brand-soft)]' : 'border-[var(--border)] bg-[var(--card)]'}`}>
      <Icon name={icon} size={18} className={`mx-auto mb-1.5 ${accent ? 'text-[var(--brand)]' : 'text-[var(--muted)]'}`} />
      <p className="display text-2xl text-[var(--text)]">{value}</p>
      <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
