'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { EmptyState, FeedSkeleton, PrimaryButton } from '@/components/ui/Primitives';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import PostCard from '@/components/posts/PostCard';
import PostLightbox from '@/components/posts/PostLightbox';
import { ACTION_WEIGHTS } from '@/lib/duel/recommend';
import type { ChallengePost } from '@/lib/duel/types';

/**
 * EXPLORE = SOCIAL MEDIA DISCOVERY.
 *
 * Not another challenge list: this is where members discover real public
 * media — photos, videos and progress posts — logged inside challenges.
 * Everything is a real database row; an empty database renders an honest
 * empty state, never placeholder content.
 *
 * Filters: All / Videos / Photos + real categories.
 * Ordering: Latest, Popular (real engagement), For you (your real behaviour).
 */
type MediaFilter = 'all' | 'videos' | 'photos' | `cat:${string}`;
type SortKey = 'latest' | 'popular' | 'foryou';

export default function ExploreView({ initialQuery = '' }: { initialQuery?: string }) {
  const store = useStore();
  const { navigate } = useNav();

  const [filter, setFilter] = useState<MediaFilter>('all');
  const [sort, setSort] = useState<SortKey>('latest');
  const [moreOpen, setMoreOpen] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);

  const recordedRef = useRef('');
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Record searches for recommendation learning (once per distinct query)
  useEffect(() => {
    const q = query.trim();
    if (!q || recordedRef.current === q) return;
    const t = window.setTimeout(() => {
      recordedRef.current = q;
      store.recordSearch(q);
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  /* ---------------------- real post collection ---------------------- */

  /** Every real public post whose challenge + author still resolve. */
  const allPosts = useMemo(() => {
    const list: { post: ChallengePost; challenge: { id: string; title: string; categoryId: string; durationDays: number } }[] = [];
    for (const post of store.db.posts) {
      const ch = store.db.challenges.find((c) => c.id === post.challengeId);
      if (!ch) continue;
      if (!store.hasProfile(post.userId) && post.userId !== store.db.meId) continue;
      list.push({ post, challenge: ch });
    }
    return list;
  }, [store.db.posts, store.db.challenges, store]);

  const q = query.trim().toLowerCase();

  const posts = useMemo(() => {
    let list = allPosts;
    if (q) {
      list = list.filter(({ post, challenge }) => {
        const author = store.getUser(post.userId);
        return (
          post.note.toLowerCase().includes(q) ||
          challenge.title.toLowerCase().includes(q) ||
          author.name.toLowerCase().includes(q) ||
          author.username.toLowerCase().includes(q)
        );
      });
    }
    if (filter === 'videos') list = list.filter((x) => x.post.mediaType === 'video' && x.post.mediaUrl);
    else if (filter === 'photos') list = list.filter((x) => x.post.mediaType === 'image' && x.post.mediaUrl);
    else if (filter.startsWith('cat:')) list = list.filter((x) => x.challenge.categoryId === filter.slice(4));

    if (sort === 'popular') {
      list = [...list].sort((a, b) => b.post.likeCount + b.post.commentCount * 2 - (a.post.likeCount + a.post.commentCount * 2));
    } else if (sort === 'foryou') {
      const scored = list.map((x) => ({ x, score: scorePost(x, store.db) }));
      scored.sort((a, b) => b.score - a.score);
      list = scored.map((s) => s.x);
    } else {
      list = [...list].sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPosts, filter, sort, q, store.db.activities]);

  /** Challenge matches when searching (challenges are discovered on Home). */
  const searchChallenges = useMemo(() => {
    if (!q) return [];
    return store.searchAll(query).challenges.slice(0, 6);
  }, [q, query, store]);

  /* ---------------------- category chips (real) ---------------------- */

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const ch of store.db.challenges) m.set(ch.categoryId, (m.get(ch.categoryId) ?? 0) + 1);
    return m;
  }, [store.db.challenges]);

  const orderedCategories = useMemo(() => {
    const cats = store.categories.slice();
    // Categories with the most challenges first, stable by sort order otherwise.
    cats.sort((a, b) => (categoryCounts.get(b.id) ?? 0) - (categoryCounts.get(a.id) ?? 0) || a.sort - b.sort);
    return cats;
  }, [store.categories, categoryCounts]);

  const visibleCats = orderedCategories.slice(0, 6);
  const moreCats = orderedCategories.slice(6);

  if (!store.hydrated) return <FeedSkeleton count={6} />;

  const openPost = openPostId ? store.findPost(openPostId) : undefined;
  const videoCount = allPosts.filter((x) => x.post.mediaType === 'video' && x.post.mediaUrl).length;
  const photoCount = allPosts.filter((x) => x.post.mediaType === 'image' && x.post.mediaUrl).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5 fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)] mb-1.5">Explore</p>
          <h1 className="display text-2xl sm:text-3xl text-[var(--text)] font-bold">Real People. Real Progress.</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Discover photos and videos from the DUEL community. Find inspiration, learn, and stay motivated.
          </p>
        </div>

        {/* Sort */}
        <div className="relative self-start sm:self-auto">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort posts"
            className="appearance-none bg-[var(--card)] border border-[var(--border)] rounded-xl pl-4 pr-9 py-2.5 text-sm font-semibold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60 cursor-pointer"
          >
            <option value="latest">Latest</option>
            <option value="popular">Popular</option>
            <option value="foryou">For you</option>
          </select>
          <Icon name="chevronDown" size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
        <Chip active={filter === 'videos'} onClick={() => setFilter('videos')} icon="play">
          Videos
        </Chip>
        <Chip active={filter === 'photos'} onClick={() => setFilter('photos')} icon="image">
          Photos
        </Chip>
        {visibleCats.map((c) => (
          <Chip key={c.id} active={filter === `cat:${c.id}`} onClick={() => setFilter(filter === `cat:${c.id}` ? 'all' : `cat:${c.id}`)}>
            <span className="mr-1">{c.emoji}</span>
            {shortName(c.name)}
          </Chip>
        ))}
        {moreCats.length > 0 && (
          <div className="relative flex-shrink-0" ref={moreRef}>
            <Chip active={filter.startsWith('cat:') && !visibleCats.some((c) => `cat:${c.id}` === filter)} onClick={() => setMoreOpen((v) => !v)}>
              More
              <Icon name="chevronDown" size={12} />
            </Chip>
            {moreOpen && (
              <div className="pop-in absolute left-0 top-full mt-2 w-52 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-20 overflow-hidden py-1">
                {moreCats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setFilter(filter === `cat:${c.id}` ? 'all' : `cat:${c.id}`);
                      setMoreOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-[var(--card-2)] ${filter === `cat:${c.id}` ? 'text-[var(--brand)] font-bold' : 'text-[var(--text)]'}`}
                  >
                    <span>{c.emoji}</span> {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search banner */}
      {q && (
        <div className="flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl px-4 py-3">
          <Icon name="search" size={15} className="text-[var(--muted)]" />
          <p className="text-sm text-[var(--text)] flex-1 min-w-0 truncate">
            Results for <span className="font-bold text-[var(--brand)]">“{query.trim()}”</span> — {posts.length} post{posts.length === 1 ? '' : 's'}
          </p>
          <button
            onClick={() => setQuery('')}
            className="text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1"
          >
            Clear <Icon name="close" size={13} />
          </button>
        </div>
      )}

      {/* Post grid */}
      {posts.length === 0 ? (
        <EmptyState
          icon={filter === 'videos' ? 'play' : filter === 'photos' ? 'image' : 'bolt'}
          title={q ? 'No posts match your search' : 'No public posts yet'}
          description={
            q
              ? 'Try a different keyword, or clear the search to see everything.'
              : 'When challengers log their daily proof — photos and videos — it appears here. Join a challenge and start the feed.'
          }
          action={
            !q ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <PrimaryButton onClick={() => navigate('home')}>Browse challenges</PrimaryButton>
                <button
                  onClick={() => navigate('create')}
                  className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--card-2)] transition-colors"
                >
                  Create a challenge
                </button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-xs text-[var(--muted)] px-1">
            {posts.length} real post{posts.length === 1 ? '' : 's'}
            {filter === 'videos' && ` · ${videoCount} videos total`}
            {filter === 'photos' && ` · ${photoCount} photos total`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {posts.map(({ post }) => (
              <PostCard key={post.id} post={post} onOpen={() => setOpenPostId(post.id)} />
            ))}
          </div>
        </>
      )}

      {/* Challenge matches while searching */}
      {q && searchChallenges.length > 0 && (
        <section className="space-y-3 pt-4">
          <h2 className="display text-base text-[var(--text)] flex items-center gap-2">
            <Icon name="swords" size={16} className="text-[var(--brand)]" /> Matching challenges
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {searchChallenges.map((v) => (
              <ChallengeCard key={v.id} view={v} />
            ))}
          </div>
        </section>
      )}

      {/* Post detail */}
      {openPost && <PostLightbox post={openPost} onClose={() => setOpenPostId(null)} />}
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function shortName(name: string): string {
  return name.split(' & ')[0].split(' & ')[0];
}

interface ScoreState {
  meId: string | null;
  challenges: { id: string; categoryId: string }[];
  activities: { userId: string; action: string; challengeId?: string }[];
}

/**
 * "For you" ordering — derived only from the member's real recorded
 * behaviour (joins, likes, check-ins, saves, searches): category affinity +
 * recent engagement + freshness, with a stable per-user jitter so the feed
 * feels discoverable without ever showing fake content.
 */
function scorePost({ post, challenge }: { post: ChallengePost; challenge: { id: string; categoryId: string } }, state: ScoreState): number {
  const meId = state.meId ?? '';
  const challengeByCat = new Map<string, string[]>();
  for (const c of state.challenges) {
    const list = challengeByCat.get(c.categoryId) ?? [];
    list.push(c.id);
    challengeByCat.set(c.categoryId, list);
  }
  const idsOfCat = new Set(challengeByCat.get(challenge.categoryId) ?? []);

  const affinityOf = (catId: string): number => {
    const ids = new Set(challengeByCat.get(catId) ?? []);
    let sum = 0;
    for (const a of state.activities) {
      if (a.userId !== meId) continue;
      if (a.challengeId && ids.has(a.challengeId)) sum += ACTION_WEIGHTS[a.action as keyof typeof ACTION_WEIGHTS] ?? 0;
    }
    return sum;
  };

  const affinity = affinityOf(challenge.categoryId);
  const maxAffinity = Math.max(0.0001, ...[...challengeByCat.keys()].map(affinityOf));

  const ageDays = (Date.now() - new Date(post.createdAt).getTime()) / 86400_000;
  const fresh = ageDays < 2 ? 5 : ageDays < 7 ? 3 : ageDays < 30 ? 1 : 0;
  const engagement = post.likeCount * 2 + post.commentCount * 2 + post.saveCount;

  // deterministic per-user jitter (0..2)
  let h = 0;
  const s = `${meId}:${post.id}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const jitter = (h % 1000) / 1000 * 2;

  return (affinity / maxAffinity) * 6 + fresh + Math.min(30, engagement * 0.5) + jitter;
}

function Chip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex-shrink-0 ${
        active
          ? 'bg-[var(--brand)] text-black border-[var(--brand)]'
          : 'bg-[var(--card)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
      }`}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </button>
  );
}
