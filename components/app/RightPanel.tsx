'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useNav } from './nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, FollowButton } from '@/components/ui/Primitives';
import { THOUGHTS, TRENDING } from '@/lib/data/sample';
import { ME_ID } from '@/lib/data/sample';

export default function RightPanel() {
  const { users, following, followers, toggleFollow, isFollowing, toast } = useStore();
  const { navigate } = useNav();
  const [thoughtIndex] = useState(() => Math.floor(Math.random() * THOUGHTS.length));

  const suggestions = useMemo(() => {
    return Object.values(users).filter((u) => u.id !== ME_ID && !following.includes(u.id)).slice(0, 3);
  }, [users, following]);

  return (
    <aside className="hidden xl:block fixed right-0 top-[64px] bottom-0 w-[330px] overflow-y-auto scrollbar-hide p-5 space-y-5 z-30">
      {/* Today's thought */}
      <div className="bg-gradient-to-br from-[var(--brand-soft)] to-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="spark" size={18} className="text-[var(--brand)]" />
          <h3 className="font-bold text-[var(--text)] text-sm">Today’s Thought</h3>
        </div>
        <p className="text-sm text-[var(--text)] leading-relaxed italic mb-3">“{THOUGHTS[thoughtIndex]}”</p>
        <div className="w-10 h-1 bg-[var(--brand)] rounded-full" />
      </div>

      {/* Trending topics */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="trending" size={18} className="text-[var(--brand)]" />
            <h3 className="font-bold text-[var(--text)] text-sm">Trending Topics</h3>
          </div>
          <button onClick={() => navigate('explore')} className="text-xs font-semibold text-[var(--brand)] hover:underline">
            See all
          </button>
        </div>
        <div className="space-y-1">
          {TRENDING.map((t, i) => (
            <button
              key={t.topic}
              onClick={() => navigate('explore', t.topic)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--card-2)] transition-colors text-left"
            >
              <span className="w-6 h-6 flex items-center justify-center bg-[var(--brand-soft)] text-[var(--brand)] rounded-full text-xs font-bold flex-shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-[var(--text)] text-sm truncate">{t.topic}</span>
                <span className="block text-xs text-[var(--muted)]">{t.count}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* People to connect with */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="people" size={18} className="text-[var(--brand)]" />
            <h3 className="font-bold text-[var(--text)] text-sm">People to Connect With</h3>
          </div>
          <button onClick={() => navigate('connections')} className="text-xs font-semibold text-[var(--brand)] hover:underline">
            See all
          </button>
        </div>
        <div className="space-y-3.5">
          {suggestions.length === 0 && (
            <p className="text-xs text-[var(--muted)]">You’re connected with everyone we suggest — nice!</p>
          )}
          {suggestions.map((u) => (
            <div key={u.id} className="flex items-center gap-3">
              <Avatar user={u} size={40} onClick={() => navigate('profile', u.id)} />
              <div className="flex-1 min-w-0">
                <button onClick={() => navigate('profile', u.id)} className="block font-semibold text-sm text-[var(--text)] truncate hover:underline text-left">
                  {u.name}
                </button>
                <p className="text-xs text-[var(--muted)] truncate">{followers.includes(u.id) ? 'Supports you' : u.bio.slice(0, 40)}</p>
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
      </div>

      {/* Share your story */}
      <div className="relative bg-gradient-to-br from-[var(--brand-soft)] to-[var(--card)] border border-[var(--border)] rounded-2xl p-5 overflow-hidden">
        <h3 className="font-bold text-[var(--text)] text-sm mb-1.5">Share Your Story</h3>
        <p className="text-sm text-[var(--muted)] mb-3">A safer, kinder space for your thoughts.</p>
        <button
          onClick={() => navigate('home')}
          className="p-2 bg-[var(--brand)] text-white rounded-full hover:bg-[var(--brand-dark)] transition-colors"
          aria-label="Share your story"
        >
          <Icon name="pen" size={16} />
        </button>
      </div>
    </aside>
  );
}
