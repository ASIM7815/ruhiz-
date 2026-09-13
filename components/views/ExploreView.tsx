'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, EmptyState, FeedSkeleton, FollowButton } from '@/components/ui/Primitives';
import PostCard from '@/components/post/PostCard';
import { TRENDING, ME_ID } from '@/lib/data/sample';

export default function ExploreView({ initialQuery = '' }: { initialQuery?: string }) {
  const { posts, users, isFollowing, toggleFollow, toast, settings } = useStore();
  const { navigate } = useNav();
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<'all' | 'people' | 'posts'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const q = query.trim().toLowerCase();

  const people = useMemo(() => {
    let list = Object.values(users).filter((u) => u.id !== ME_ID);
    if (settings.blocked.length) list = list.filter((u) => !settings.blocked.includes(u.id));
    if (q) {
      list = list.filter(
        (u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.bio.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, q, settings.blocked]);

  const matchedPosts = useMemo(() => {
    let list = [...posts];
    if (settings.blocked.length) list = list.filter((p) => !settings.blocked.includes(p.userId));
    if (q) {
      list = list.filter(
        (p) =>
          p.text.toLowerCase().includes(q) ||
          p.topics.some((t) => t.toLowerCase().includes(q)) ||
          users[p.userId]?.name.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 30);
  }, [posts, q, users, settings.blocked]);

  const showPeople = scope !== 'posts' && (scope === 'people' || people.length > 0);
  const showPosts = scope !== 'people';

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[var(--text)] mb-1">Explore</h1>
        <p className="text-sm text-[var(--muted)]">Discover moments, topics and kind humans.</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, topics or moments…"
          className="w-full pl-11 pr-10 py-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 placeholder:text-[var(--muted)]"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-[var(--card-2)] text-[var(--muted)]" aria-label="Clear search">
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      {/* Scope tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'people', 'posts'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              scope === s ? 'bg-[var(--brand)] text-white' : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Trending (only without a search) */}
      {!q && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-[var(--text)] mb-3 flex items-center gap-2">
            <Icon name="trending" size={16} className="text-[var(--brand)]" /> Trending topics
          </h3>
          <div className="flex flex-wrap gap-2">
            {TRENDING.map((t) => (
              <button
                key={t.topic}
                onClick={() => setQuery(t.topic)}
                className="px-4 py-2 bg-[var(--card)] border border-[var(--border)] hover:border-[var(--brand)] rounded-xl text-left transition-colors"
              >
                <span className="block text-sm font-semibold text-[var(--text)]">{t.topic}</span>
                <span className="block text-xs text-[var(--muted)]">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <FeedSkeleton count={2} />
      ) : (
        <>
          {/* People */}
          {showPeople && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[var(--text)] mb-3">
                {q ? `People matching “${query.trim()}”` : 'People to follow'}
              </h3>
              {people.length === 0 ? (
                <p className="text-sm text-[var(--muted)] bg-[var(--card)] border border-[var(--border)] rounded-2xl px-4 py-6 text-center">
                  No people match your search.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {people.slice(0, scope === 'people' ? 20 : 4).map((u) => (
                    <div key={u.id} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3 fade-in">
                      <Avatar user={u} size={46} onClick={() => navigate('profile', u.id)} />
                      <div className="flex-1 min-w-0">
                        <button onClick={() => navigate('profile', u.id)} className="flex items-center gap-1 font-semibold text-sm text-[var(--text)] hover:underline">
                          <span className="truncate">{u.name}</span>
                          {u.verified && <Icon name="badge" size={14} className="text-[var(--brand)] flex-shrink-0" />}
                        </button>
                        <p className="text-xs text-[var(--muted)] truncate">@{u.username} · {u.bio.slice(0, 48)}</p>
                      </div>
                      <FollowButton
                        small
                        following={isFollowing(u.id)}
                        onToggle={() => {
                          toggleFollow(u.id);
                          toast(isFollowing(u.id) ? `Unfollowed ${u.name}` : `You're now supporting ${u.name} 💚`);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Posts */}
          {showPosts && (
            <div>
              <h3 className="text-sm font-bold text-[var(--text)] mb-3">{q ? `Moments matching “${query.trim()}”` : 'Fresh moments'}</h3>
              {matchedPosts.length === 0 ? (
                <EmptyState
                  icon="explore"
                  title="No moments found"
                  description={`Nothing matches “${query.trim()}” yet. Try different words or browse trending topics.`}
                />
              ) : (
                <div className="space-y-5">
                  {matchedPosts.map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
