'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, EmptyState, FollowButton } from '@/components/ui/Primitives';
import { ME_ID } from '@/lib/data/sample';
import type { UserProfile } from '@/lib/types';

type Tab = 'suggestions' | 'supporters' | 'supporting';

export default function ConnectionsView() {
  const store = useStore();
  const { navigate } = useNav();
  const [tab, setTab] = useState<Tab>('suggestions');
  const [query, setQuery] = useState('');

  const { users, following, followers, settings } = store;

  const all = useMemo(() => Object.values(users).filter((u) => u.id !== ME_ID && !settings.blocked.includes(u.id)), [users, settings.blocked]);

  const suggestions = useMemo(
    () => all.filter((u) => !following.includes(u.id)),
    [all, following]
  );
  const supporters = useMemo(() => all.filter((u) => followers.includes(u.id)), [all, followers]);
  const supporting = useMemo(() => all.filter((u) => following.includes(u.id)), [all, following]);

  const lists: Record<Tab, UserProfile[]> = { suggestions, supporters, supporting };
  const filtered = query.trim()
    ? lists[tab].filter((u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()))
    : lists[tab];

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'suggestions', label: 'Suggestions', count: suggestions.length },
    { id: 'supporters', label: 'Supporters', count: supporters.length },
    { id: 'supporting', label: 'Supporting', count: supporting.length },
  ];

  const message = async (u: UserProfile) => {
    const threadId = await store.openThreadWith(u.id);
    navigate('messages', threadId);
  };

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[var(--text)] mb-1">Connections</h1>
        <p className="text-sm text-[var(--muted)]">The kind humans walking alongside you.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-[var(--card)] border border-[var(--border)] rounded-2xl p-1.5 gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--card-2)]'
            }`}
          >
            {t.label} <span className="opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Icon name="search" size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${tab}…`}
          className="w-full pl-11 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 placeholder:text-[var(--muted)]"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="people"
          title={
            tab === 'suggestions'
              ? 'No suggestions right now'
              : tab === 'supporters'
              ? 'No supporters yet'
              : 'You aren’t supporting anyone yet'
          }
          description={
            tab === 'supporting'
              ? 'Explore the community and support people whose stories speak to you.'
              : 'When people find your moments meaningful, they’ll show up here.'
          }
          action={
            tab !== 'suggestions' ? undefined : (
              <button onClick={() => navigate('explore')} className="px-5 py-2.5 bg-[var(--brand)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--brand-dark)]">
                Explore people
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => {
            const mutual = followers.includes(u.id) && following.includes(u.id);
            return (
              <div key={u.id} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3 fade-in">
                <Avatar user={u} size={52} onClick={() => navigate('profile', u.id)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => navigate('profile', u.id)} className="font-semibold text-[var(--text)] hover:underline truncate">
                      {u.name}
                    </button>
                    {u.verified && <Icon name="badge" size={15} className="text-[var(--brand)]" />}
                    {mutual && (
                      <span className="text-[10px] font-semibold bg-[var(--brand-soft)] text-[var(--brand)] px-2 py-0.5 rounded-full">Mutual</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] truncate">@{u.username} · {u.bio}</p>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5 flex items-center gap-1">
                    <Icon name="location" size={11} /> {u.location}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => message(u)}
                    className="p-2.5 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-[var(--brand)] hover:border-[var(--brand)] transition-colors"
                    title={`Message ${u.name}`}
                  >
                    <Icon name="chat" size={17} />
                  </button>
                  {tab === 'supporters' && !store.isFollowing(u.id) ? (
                    <FollowButton
                      following={false}
                      small
                      onToggle={() => {
                        store.toggleFollow(u.id);
                        store.toast(`You're now supporting ${u.name} 💚`);
                      }}
                    />
                  ) : tab === 'supporters' ? (
                    <button
                      onClick={() => {
                        store.removeFollower(u.id);
                        store.toast(`${u.name} removed from your supporters`, 'info');
                      }}
                      className="px-3.5 py-1.5 text-xs rounded-xl font-semibold bg-[var(--card-2)] text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors"
                    >
                      Remove
                    </button>
                  ) : (
                    <FollowButton
                      following={store.isFollowing(u.id)}
                      small
                      onToggle={() => {
                        store.toggleFollow(u.id);
                        store.toast(store.isFollowing(u.id) ? `Stopped supporting ${u.name}` : `You're now supporting ${u.name} 💚`);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
