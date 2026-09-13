'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, EmptyState, FeedSkeleton, PrimaryButton } from '@/components/ui/Primitives';
import PostCard from '@/components/post/PostCard';
import type { Post } from '@/lib/types';
import { ME_ID, TOPICS } from '@/lib/data/sample';
import { PROBLEMS } from '@/lib/recsys/problems';

const PROBLEM_CHIPS = PROBLEMS.slice(0, 8);

type HomeTab = 'for-you' | 'following' | 'photo' | 'video' | 'moment';

const TABS: { id: HomeTab; label: string; icon?: string }[] = [
  { id: 'for-you', label: 'For You' },
  { id: 'following', label: 'Supporting' },
  { id: 'photo', label: 'Photo', icon: 'image' },
  { id: 'video', label: 'Video', icon: 'video' },
  { id: 'moment', label: 'Moment', icon: 'pen' },
];

export default function HomeView({
  onCreate,
  focusPostId,
}: {
  onCreate: (tab?: 'photo' | 'video' | 'moment') => void;
  focusPostId?: string;
}) {
  const store = useStore();
  const { posts, following, getUser, rankedFeed, feedReasons } = store;
  const { navigate } = useNav();
  const me = store.me;
  const [tab, setTab] = useState<HomeTab>('for-you');
  const [topic, setTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // loading state until the store has hydrated (sample data or Supabase)
  useEffect(() => {
    if (store.hydrated) {
      const t = window.setTimeout(() => setLoading(false), 350);
      return () => window.clearTimeout(t);
    }
  }, [store.hydrated]);

  const switchTab = (next: HomeTab) => {
    if (next === tab) return;
    setTab(next);
    setTopic(null);
    setLoading(true);
    window.setTimeout(() => setLoading(false), 350);
  };

  const refresh = async () => {
    setRefreshing(true);
    if (store.dataMode === 'supabase') {
      await store.refreshPosts();
      setRefreshing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.setTimeout(() => {
        setRefreshing(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 800);
    }
  };

  const filtered = useMemo(() => {
    let list: Post[];
    switch (tab) {
      case 'following':
        list = posts.filter((p) => p.userId === ME_ID || following.includes(p.userId));
        break;
      case 'photo':
        list = posts.filter((p) => !!p.image);
        break;
      case 'video':
        list = posts.filter((p) => !!p.video);
        break;
      case 'moment':
        list = posts.filter((p) => !p.image && !p.video);
        break;
      default:
        // "For You" — Ruhiz's deterministic recommendation engine:
        // interest + interaction history + recency + content preferences
        // + controlled exploration (more discovery for new members).
        list = rankedFeed.map((r) => r.post);
    }
    if (topic) list = list.filter((p) => p.topics.includes(topic) || p.problems.some((pr) => pr.id === topic));
    return [...list].sort((a, b) =>
      tab === 'for-you' ? 0 : +new Date(b.createdAt) - +new Date(a.createdAt)
    );
  }, [posts, following, tab, topic, rankedFeed]);

  return (
    <div className="max-w-[640px] mx-auto">
      {/* Welcome banner */}
      <div
        className="relative h-[190px] sm:h-[220px] rounded-3xl overflow-hidden mb-5"
        style={{ backgroundImage: 'url(/images/banner.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B3D2E]/85 via-[#0B3D2E]/55 to-transparent" />
        <div className="relative h-full flex items-center px-7 sm:px-10">
          <div className="flex-1">
            <p className="text-white/75 text-[11px] font-semibold tracking-[0.2em] uppercase mb-2">Good to see you here</p>
            <h1 className="text-white text-3xl sm:text-4xl mb-2">Welcome back, {me.name.split(' ')[0]}!</h1>
            <p className="text-white/85 text-sm mb-3">A safe space to share, ask, and grow together.</p>
            <div className="w-14 h-1 bg-[#8FC9A8] rounded-full" />
          </div>
          <div className="hidden sm:block text-right text-white/70 italic text-sm">
            <p className="mb-1">Different people.</p>
            <p>Different stories.</p>
          </div>
        </div>
      </div>

      {/* Composer trigger */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <Avatar user={me} size={44} onClick={() => navigate('profile')} />
          <button
            onClick={() => onCreate()}
            className="flex-1 px-5 py-3 bg-[var(--card-2)] hover:bg-[var(--brand-soft)] rounded-full text-left text-sm text-[var(--muted)] transition-colors"
          >
            What’s on your mind, {me.name.split(' ')[0]}?
          </button>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ComposerBtn icon="image" label="Photo" onClick={() => onCreate('photo')} />
          <ComposerBtn icon="video" label="Video" onClick={() => onCreate('video')} />
          <ComposerBtn icon="pen" label="Moment" onClick={() => onCreate('moment')} />
          <button
            onClick={() => onCreate()}
            className="ml-auto px-5 py-2 bg-[var(--brand)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--brand-dark)] transition-colors"
          >
            Post
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[64px] z-20 bg-[var(--bg)]/95 backdrop-blur-sm pt-1 pb-3 -mx-1 px-1">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                tab === t.id
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'bg-[var(--card)] text-[var(--muted)] border border-[var(--border)] hover:border-[var(--brand)]'
              }`}
            >
              {t.icon && <Icon name={t.icon} size={15} />}
              {t.label}
            </button>
          ))}
          <button
            onClick={() => void refresh()}
            className="ml-auto flex-shrink-0 p-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--brand)] transition-colors"
            aria-label="Refresh feed"
            title="Refresh feed"
          >
            <Icon name="refresh" size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Topic chips on For You */}
        {tab === 'for-you' && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mt-2.5">
            <button
              onClick={() => setTopic(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                topic === null ? 'bg-[var(--text)] text-[var(--bg)]' : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              All topics
            </button>
            {PROBLEM_CHIPS.map((p) => (
              <button
                key={p.id}
                onClick={() => setTopic(topic === p.id ? null : p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  topic === p.id ? 'bg-[var(--text)] text-[var(--bg)]' : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--brand)]'
                }`}
              >
                <span aria-hidden className="mr-1">{p.emoji}</span>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feed */}
      <div className="mt-2">
        {loading ? (
          <FeedSkeleton count={3} />
        ) : filtered.length === 0 ? (
          <EmptyByTab tab={tab} hasTopic={!!topic} onExplore={() => navigate('explore')} onConnections={() => navigate('connections')} onCreate={() => onCreate()} />
        ) : (
          <div className="space-y-5">
            {filtered.map((p) => (
              <PostCard key={p.id} post={p} highlight={p.id === focusPostId} reason={tab === 'for-you' ? feedReasons[p.id] : undefined} />
            ))}
            <div className="text-center py-6">
              <p className="text-sm text-[var(--muted)]">You’re all caught up 🌿 Check back soon for new moments.</p>
            </div>
          </div>
        )}
      </div>
      <span className="sr-only">{getUser(ME_ID).name}</span>
    </div>
  );
}

function useStoreScrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function ComposerBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl hover:bg-[var(--card-2)] transition-colors group"
    >
      <Icon name={icon} size={18} className="text-[var(--muted)] group-hover:text-[var(--brand)]" />
      <span className="text-xs sm:text-sm font-medium text-[var(--muted)] group-hover:text-[var(--brand)]">{label}</span>
    </button>
  );
}

function EmptyByTab({
  tab,
  hasTopic,
  onExplore,
  onConnections,
  onCreate,
}: {
  tab: HomeTab;
  hasTopic: boolean;
  onExplore: () => void;
  onConnections: () => void;
  onCreate: () => void;
}) {
  if (tab === 'following') {
    return (
      <EmptyState
        icon="people"
        title="Your Following feed is quiet"
        description="Follow a few kind humans and their moments will show up here."
        action={
          <PrimaryButton onClick={onConnections}>
            <Icon name="people" size={16} /> Find people to follow
          </PrimaryButton>
        }
      />
    );
  }
  if (hasTopic) {
    return (
      <EmptyState
        icon="explore"
        title="No moments in this topic yet"
        description="Try another topic, or be the first to share something about it."
        action={
          <PrimaryButton onClick={onCreate}>
            <Icon name="pen" size={16} /> Share the first moment
          </PrimaryButton>
        }
      />
    );
  }
  const map: Record<string, { icon: string; title: string; desc: string; cta: string }> = {
    photo: {
      icon: 'image',
      title: 'No photos yet',
      desc: 'Share a photo and it will appear here for everyone to enjoy.',
      cta: 'Share a photo',
    },
    video: {
      icon: 'video',
      title: 'No videos yet',
      desc: 'Upload a short video and it will play right here in the feed.',
      cta: 'Share a video',
    },
    moment: {
      icon: 'pen',
      title: 'No written moments yet',
      desc: 'Words matter. Write what’s on your mind and share it here.',
      cta: 'Write a moment',
    },
    'for-you': {
      icon: 'spark',
      title: 'Nothing here yet',
      desc: 'Be the first to share something with the community.',
      cta: 'Create a post',
    },
  };
  const m = map[tab] ?? map['for-you'];
  return (
    <EmptyState
      icon={m.icon}
      title={m.title}
      description={m.desc}
      action={
        <PrimaryButton onClick={tab === 'for-you' ? onExplore : onCreate}>
          <Icon name={m.icon} size={16} /> {m.cta}
        </PrimaryButton>
      }
    />
  );
}
