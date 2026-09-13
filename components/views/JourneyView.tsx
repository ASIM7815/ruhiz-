'use client';

import { useMemo, useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Icon } from '@/components/ui/Icons';
import { EmptyState, FeedSkeleton, PrimaryButton } from '@/components/ui/Primitives';
import PostCard from '@/components/post/PostCard';
import { ME_ID } from '@/lib/data/sample';
import { compactCount, monthLabel } from '@/lib/format';

export default function JourneyView({ onCreate }: { onCreate: () => void }) {
  const { posts, following, followers } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(t);
  }, []);

  const mine = useMemo(
    () => posts.filter((p) => p.userId === ME_ID).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [posts]
  );

  const supportsReceived = mine.reduce((s, p) => s + p.supports, 0);
  const photos = mine.filter((p) => p.image).length;
  const videos = mine.filter((p) => p.video).length;
  const moments = mine.filter((p) => !p.image && !p.video).length;

  // streak: consecutive days with at least one post, counting back from today
  const streak = useMemo(() => {
    const days = new Set(mine.map((p) => new Date(p.createdAt).toDateString()));
    let count = 0;
    const cursor = new Date();
    // allow today to be empty and still count the streak ending yesterday
    if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
    while (days.has(cursor.toDateString())) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [mine]);

  const milestones = [
    { label: 'First moment shared', done: mine.length >= 1, icon: 'pen' },
    { label: '5 moments shared', done: mine.length >= 5, icon: 'spark' },
    { label: 'First photo posted', done: photos >= 1, icon: 'image' },
    { label: 'First video posted', done: videos >= 1, icon: 'video' },
    { label: '50 supports received', done: supportsReceived >= 50, icon: 'support' },
    { label: '10 supporters', done: followers.length >= 10, icon: 'people' },
  ];

  const byMonth = useMemo(() => {
    const map = new Map<string, typeof mine>();
    mine.forEach((p) => {
      const key = monthLabel(p.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries());
  }, [mine]);

  const stats = [
    { label: 'Moments', value: compactCount(mine.length), icon: 'pen' },
    { label: 'Supports received', value: compactCount(supportsReceived), icon: 'support' },
    { label: 'Supporters', value: compactCount(followers.length), icon: 'people' },
    { label: 'Supporting', value: compactCount(following.length), icon: 'user' },
    { label: 'Day streak', value: compactCount(streak), icon: 'trending' },
    { label: 'Photos', value: compactCount(photos), icon: 'image' },
  ];

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[var(--text)] mb-1">My Journey</h1>
        <p className="text-sm text-[var(--muted)]">Every step you’ve shared, all in one place. 🌱</p>
      </div>

      {loading ? (
        <FeedSkeleton count={2} />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
            {stats.map((s) => (
              <div key={s.label} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-3.5 text-center fade-in">
                <Icon name={s.icon} size={18} className="text-[var(--brand)] mx-auto mb-1.5" />
                <p className="text-lg font-bold text-[var(--text)] leading-none">{s.value}</p>
                <p className="text-[11px] text-[var(--muted)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Milestones */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 mb-6">
            <h3 className="text-sm font-bold text-[var(--text)] mb-3">Milestones</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {milestones.map((m) => (
                <div key={m.label} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${m.done ? 'bg-[var(--brand-soft)]' : 'bg-[var(--card-2)] opacity-60'}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.done ? 'bg-[var(--brand)] text-white' : 'bg-[var(--border)] text-[var(--muted)]'}`}>
                    <Icon name={m.done ? 'check' : m.icon} size={13} />
                  </span>
                  <span className={`text-sm font-medium ${m.done ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          {mine.length === 0 ? (
            <EmptyState
              icon="journey"
              title="Your journey hasn’t started yet"
              description="Share your first moment — a photo, a video or a few honest words — and it will appear here."
              action={
                <PrimaryButton onClick={onCreate}>
                  <Icon name="plus" size={16} /> Start your journey
                </PrimaryButton>
              }
            />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-[var(--border)] rounded" />
              {byMonth.map(([month, list]) => (
                <div key={month} className="mb-8">
                  <div className="relative mb-4">
                    <span className="absolute -left-6 top-1.5 w-[18px] h-[18px] rounded-full bg-[var(--brand)] ring-4 ring-[var(--brand-soft)]" />
                    <h3 className="text-base font-bold text-[var(--text)]">{month}</h3>
                    <p className="text-xs text-[var(--muted)]">
                      {list.length} moment{list.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="space-y-5">
                    {list.map((p) => (
                      <PostCard key={p.id} post={p} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
