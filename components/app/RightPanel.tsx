'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from './nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, Cover } from '@/components/ui/Primitives';

export default function RightPanel() {
  const { db, categories, trending, recommendedViews, getUser } = useStore();
  const { navigate } = useNav();

  const spotlight = recommendedViews[0] ?? db.challenges[0];

  const leaders = useMemo(() => {
    const agg = new Map<string, { completions: number; streak: number }>();
    for (const p of db.participants) {
      const e = agg.get(p.userId) ?? { completions: 0, streak: 0 };
      if (p.status === 'completed') e.completions += 1;
      e.streak = Math.max(e.streak, p.longestStreak);
      agg.set(p.userId, e);
    }
    return [...agg.entries()]
      .filter(([id]) => db.profiles[id])
      .sort((a, b) => b[1].completions - a[1].completions || b[1].streak - a[1].streak)
      .slice(0, 4);
  }, [db.participants, db.profiles]);

  return (
    <aside className="hidden xl:block fixed right-0 top-[64px] bottom-0 w-[330px] overflow-y-auto scrollbar-hide p-5 space-y-5 z-30">
      {/* Spotlight */}
      {spotlight ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="h-28 relative">
            <Cover coverUrl={spotlight.coverUrl} category={spotlight.category} title={spotlight.title} />
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-[var(--brand)] text-[10px] font-bold uppercase tracking-wider">
              Featured Duel
            </span>
          </div>
          <div className="p-4">
            <h3 className="font-bold text-[var(--text)] text-sm leading-snug line-clamp-1">{spotlight.title}</h3>
            <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{spotlight.reason ?? spotlight.category?.tagline}</p>
            <button
              onClick={() => navigate('challenge', spotlight.id)}
              className="mt-3 w-full py-2 rounded-xl bg-[var(--brand)] text-black text-xs font-bold hover:bg-[var(--brand-dark)] transition-colors"
            >
              View challenge
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 text-center">
          <Icon name="swords" size={24} className="text-[var(--brand)] mx-auto mb-2" />
          <p className="font-bold text-sm text-[var(--text)]">No active challenges</p>
          <p className="text-xs text-[var(--muted)] mt-1 mb-3">Create the first duel to get the community started.</p>
          <button
            onClick={() => navigate('create')}
            className="w-full py-2 rounded-xl bg-[var(--brand)] text-black text-xs font-bold hover:bg-[var(--brand-dark)] transition-colors"
          >
            Create Challenge
          </button>
        </div>
      )}

      {/* Trending categories */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="trending" size={18} className="text-[var(--brand)]" />
            <h3 className="font-bold text-[var(--text)] text-sm">Categories</h3>
          </div>
          <button onClick={() => navigate('explore')} className="text-xs font-semibold text-[var(--brand)] hover:underline">
            See all
          </button>
        </div>
        <div className="space-y-1">
          {(trending.length > 0 ? trending : categories.slice(0, 5).map((c) => ({ categoryId: c.id, challengeCount: 0, participants: 0 }))).map((t, i) => {
            const cat = categories.find((c) => c.id === t.categoryId);
            if (!cat) return null;
            return (
              <button
                key={t.categoryId}
                onClick={() => navigate('explore', cat.name)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--card-2)] transition-colors text-left"
              >
                <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm flex-shrink-0" style={{ background: `${cat.color}22` }}>
                  {cat.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[var(--text)] text-sm truncate">{cat.name}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {t.participants} challenger{t.participants === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="text-[10px] font-bold text-[var(--muted)]">#{i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Challengers */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="trophy" size={18} className="text-[var(--brand)]" />
          <h3 className="font-bold text-[var(--text)] text-sm">Top Challengers</h3>
        </div>
        {leaders.length === 0 ? (
          <p className="text-xs text-[var(--muted)] py-2">
            No challengers recorded yet. Join a challenge and log daily check-ins to appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {leaders.map(([id, stats], i) => {
              const u = getUser(id);
              return (
                <button
                  key={id}
                  onClick={() => navigate('profile', id)}
                  className="w-full flex items-center gap-3 text-left hover:opacity-90 transition-opacity"
                >
                  <span className="text-xs font-bold text-[var(--muted)] w-4">{i + 1}</span>
                  <Avatar user={u} size={36} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-sm text-[var(--text)] truncate">{u.name}</span>
                    <span className="block text-xs text-[var(--muted)]">
                      {stats.completions} won · streak {stats.streak}d
                    </span>
                  </span>
                  <Icon name="medal" size={16} className="text-[var(--brand)]" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="relative bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-5 overflow-hidden">
        <h3 className="display text-[var(--text)] text-sm mb-1.5">Start your duel</h3>
        <p className="text-sm text-[var(--muted)] mb-3">Create a challenge and upload proof every day.</p>
        <button
          onClick={() => navigate('create')}
          className="px-4 py-2 bg-[var(--brand)] text-black rounded-xl text-xs font-bold hover:bg-[var(--brand-dark)] transition-colors"
        >
          Create Challenge
        </button>
        <Icon name="swords" size={56} className="absolute -bottom-3 -right-3 text-[var(--brand)] opacity-15" />
      </div>
    </aside>
  );
}
