'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { EmptyState, FeedSkeleton, Segmented } from '@/components/ui/Primitives';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import { SectionHeader } from './HomeView';
import { durationBucket, type DurationBucket } from '@/lib/duel/types';

type SortKey = 'recommended' | 'popular' | 'newest';

export default function ExploreView({ initialQuery = '' }: { initialQuery?: string }) {
  const store = useStore();
  const { navigate } = useNav();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(null);
  const [bucket, setBucket] = useState<DurationBucket | 'any'>('any');
  const [sort, setSort] = useState<SortKey>('recommended');
  const [searched, setSearched] = useState(initialQuery);
  const recordedRef = useRef<string>('');

  useEffect(() => {
    setQuery(initialQuery);
    setSearched(initialQuery);
  }, [initialQuery]);

  // record the search as a recommendation signal (debounced)
  useEffect(() => {
    if (!searched.trim()) return;
    if (recordedRef.current === searched) return;
    const t = window.setTimeout(() => {
      recordedRef.current = searched;
      store.recordSearch(searched);
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched]);

  const results = useMemo(() => {
    let list = store.db.challenges.filter((c) => c.status === 'open');
    if (searched.trim()) {
      const r = store.searchAll(searched);
      list = r.challenges.map((v) => store.db.challenges.find((c) => c.id === v.id)!).filter(Boolean);
    }
    if (category) list = list.filter((c) => c.categoryId === category);
    if (bucket !== 'any') list = list.filter((c) => durationBucket(c.durationDays) === bucket);
    const views = list.map((c) => store.getView(c));
    if (sort === 'popular') views.sort((a, b) => b.participantCount - a.participantCount);
    else if (sort === 'newest') views.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else views.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.participantCount - a.participantCount);
    return views;
  }, [store.db.challenges, searched, category, bucket, sort, store]);

  const recommendedOrder = useMemo(() => new Map(store.recommended.map((r, i) => [r.id, i])), [store.recommended]);
  const ordered = useMemo(() => {
    if (sort !== 'recommended') return results;
    return results.slice().sort((a, b) => (recommendedOrder.get(a.id) ?? 999) - (recommendedOrder.get(b.id) ?? 999));
  }, [results, sort, recommendedOrder]);

  if (!store.hydrated) return <FeedSkeleton count={6} />;

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-[var(--text)]">Explore</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Discover your next duel across {store.categories.length} categories.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearched(e.target.value);
          }}
          placeholder="Search challenges, tags, categories or creators…"
          aria-label="Search challenges"
          className="w-full pl-11 pr-10 py-3.5 bg-[var(--card)] border border-[var(--border)] rounded-2xl text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setSearched(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[var(--muted)] hover:bg-[var(--card-2)]"
            aria-label="Clear search"
          >
            <Icon name="close" size={15} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            All categories
          </Chip>
          {store.categories.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}>
              <span className="mr-1">{c.emoji}</span>
              {c.name}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            options={[
              { value: 'any' as const, label: 'Any length' },
              { value: 'sprint' as const, label: '≤7d' },
              { value: 'short' as const, label: '8–14d' },
              { value: 'classic' as const, label: '15–30d' },
              { value: 'marathon' as const, label: '30d+' },
            ]}
            value={bucket}
            onChange={setBucket}
          />
          <div className="ml-auto">
            <Segmented
              options={[
                { value: 'recommended' as SortKey, label: 'For you' },
                { value: 'popular' as SortKey, label: 'Popular' },
                { value: 'newest' as SortKey, label: 'New' },
              ]}
              value={sort}
              onChange={setSort}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {ordered.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nothing matches yet"
          description="Try a different keyword or clear the filters — or create the challenge you were looking for."
          action={
            <button onClick={() => navigate('create')} className="px-5 py-2.5 rounded-xl bg-[var(--brand)] text-black text-sm font-bold hover:bg-[var(--brand-dark)] transition-colors">
              Create it
            </button>
          }
        />
      ) : (
        <>
          <p className="text-xs text-[var(--muted)]">
            {ordered.length} challenge{ordered.length === 1 ? '' : 's'}
            {searched ? ` for “${searched}”` : ''}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((v) => (
              <ChallengeCard key={v.id} view={v} />
            ))}
          </div>
        </>
      )}

      {/* Category directory */}
      {!searched && !category && (
        <section className="pt-4">
          <SectionHeader title="Browse by category" icon="grid" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {store.categories.map((c) => {
              const count = store.db.challenges.filter((ch) => ch.categoryId === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => { setCategory(c.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 text-left hover:border-[var(--brand)]/40 transition-colors"
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <p className="font-bold text-sm text-[var(--text)] mt-2 leading-snug">{c.name}</p>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">{count} challenges</p>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
        active ? 'bg-[var(--brand)] text-black border-[var(--brand)]' : 'bg-[var(--card)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  );
}
