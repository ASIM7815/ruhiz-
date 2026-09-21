'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { EmptyState, FeedSkeleton, PrimaryButton, Spinner } from '@/components/ui/Primitives';
import { PostCard, PostLightbox } from '@/components/challenge/PostCard';
import type { FeedMediaType, FeedPost, FeedSort } from '@/lib/duel/types';

const PAGE_SIZE = 18;

type MediaChip = FeedMediaType; // 'all' | 'video' | 'image'

export default function ExploreView({ initialQuery = '' }: { initialQuery?: string }) {
  const store = useStore();
  const { navigate } = useNav();

  const [mediaType, setMediaType] = useState<MediaChip>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<FeedSort>('for_you');
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openPost, setOpenPost] = useState<FeedPost | null>(null);

  const recordedRef = useRef<string>('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  /* debounce the search box */
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(input.trim()), 450);
    return () => window.clearTimeout(t);
  }, [input]);

  /* record searches so the interest engine learns (same signal as the web search) */
  useEffect(() => {
    if (!query.trim()) return;
    if (recordedRef.current === query) return;
    const t = window.setTimeout(() => {
      recordedRef.current = query;
      store.recordSearch(query);
    }, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const feedKey = `${sort}|${mediaType}|${categoryId ?? ''}|${query}`;

  /* first page whenever the filter set changes */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPosts([]);
    setPage(0);
    store
      .loadFeed({ mediaType, categoryId, query, sort, page: 0, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!alive) return;
        setPosts(res.posts);
        setHasMore(res.hasMore);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setPosts([]);
        setHasMore(false);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedKey, store.authed, store.hydrated]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      const res = await store.loadFeed({ mediaType, categoryId, query, sort, page: next, pageSize: PAGE_SIZE });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.posts.filter((p) => !seen.has(p.id))];
      });
      setPage(next);
      setHasMore(res.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [categoryId, hasMore, loadingMore, mediaType, page, query, sort, store]);

  /* infinite scroll */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loadingMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, loadMore]);

  if (!store.hydrated) return <FeedSkeleton count={6} />;

  const mediaChips: { value: MediaChip; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: 'spark' },
    { value: 'video', label: 'Videos', icon: 'play' },
    { value: 'image', label: 'Photos', icon: 'image' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5 fade-in pb-12">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-[var(--text)] font-bold flex items-center gap-2">
            Explore
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Real proof from the community — matched to your interests the more you train, like and watch.
          </p>
        </div>
        <div className="flex-shrink-0">
          <div className="inline-flex bg-[var(--card)] border border-[var(--border)] p-1 rounded-2xl">
            <SortButton active={sort === 'for_you'} onClick={() => setSort('for_you')} icon="spark" label="For you" />
            <SortButton active={sort === 'latest'} onClick={() => setSort('latest')} icon="timer" label="Latest" />
          </div>
        </div>
      </div>

      {/* search */}
      <div className="relative">
        <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search posts and challenges…"
          aria-label="Search posts"
          className="w-full pl-11 pr-10 py-3.5 bg-[var(--card)] border border-[var(--border)] rounded-2xl text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60"
        />
        {input && (
          <button
            onClick={() => setInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[var(--muted)] hover:bg-[var(--card-2)]"
            aria-label="Clear search"
          >
            <Icon name="close" size={15} />
          </button>
        )}
      </div>

      {/* filter chips */}
      <div className="space-y-2.5">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {mediaChips.map((m) => (
            <Chip key={m.value} active={mediaType === m.value} onClick={() => setMediaType(m.value)}>
              <Icon name={m.icon} size={13} className="mr-1.5 inline-block -mt-0.5" />
              {m.label}
            </Chip>
          ))}
          <span className="w-px bg-[var(--border)] mx-1 flex-shrink-0" aria-hidden />
          <Chip active={categoryId === null} onClick={() => setCategoryId(null)}>
            All categories
          </Chip>
          {store.categories.map((c) => (
            <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
              <span className="mr-1">{c.emoji}</span>
              {c.name}
            </Chip>
          ))}
        </div>
      </div>

      {/* grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[9/14] rounded-2xl bg-[var(--card)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon="explore"
          title={query || categoryId || mediaType !== 'all' ? 'Nothing matches these filters' : 'No posts yet'}
          description={
            query || categoryId || mediaType !== 'all'
              ? 'No proof has been posted with these filters yet. Try clearing them.'
              : 'When challengers post their daily proof — photos and videos — the discovery feed comes alive. Join a challenge and post Day 1.'
          }
          action={
            query || categoryId || mediaType !== 'all' ? (
              <PrimaryButton
                onClick={() => {
                  setInput('');
                  setMediaType('all');
                  setCategoryId(null);
                }}
              >
                Clear filters
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => navigate('challenges')}>Browse challenges</PrimaryButton>
            )
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onOpen={setOpenPost} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-4" aria-hidden />
          <div className="flex justify-center pt-2">
            {loadingMore ? (
              <Spinner />
            ) : hasMore ? (
              <PrimaryButton onClick={() => void loadMore()}>Load more</PrimaryButton>
            ) : (
              <p className="text-xs text-[var(--muted)]">You&apos;ve reached the end.</p>
            )}
          </div>
        </>
      )}

      {openPost && <PostLightbox post={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  );
}

/* ------------------------------- subcomponents ------------------------------ */

function SortButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
        active ? 'bg-[var(--brand)] text-black shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)]'
      }`}
    >
      <Icon name={icon} size={15} />
      {label}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
        active
          ? 'bg-[var(--brand)] text-black border-[var(--brand)]'
          : 'bg-[var(--card)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  );
}
