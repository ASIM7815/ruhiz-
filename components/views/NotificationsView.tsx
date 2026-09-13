'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, EmptyState } from '@/components/ui/Primitives';
import { timeAgo } from '@/lib/format';
import type { AppNotification, NotificationKind } from '@/lib/types';

const KIND_META: Record<NotificationKind, { icon: string; color: string; label: string }> = {
  support: { icon: 'support', color: 'bg-emerald-500/15 text-emerald-600', label: 'Support' },
  comment: { icon: 'comment', color: 'bg-sky-500/15 text-sky-600', label: 'Comments' },
  person_support: { icon: 'people', color: 'bg-violet-500/15 text-violet-600', label: 'New supporters' },
  message: { icon: 'chat', color: 'bg-sky-500/15 text-sky-500', label: 'Messages' },
  mention: { icon: 'spark', color: 'bg-amber-500/15 text-amber-600', label: 'Mentions' },
};

export default function NotificationsView() {
  const store = useStore();
  const { navigate } = useNav();
  const [filter, setFilter] = useState<'all' | NotificationKind>('all');

  const list = useMemo(() => {
    const sorted = [...store.notifications].sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return filter === 'all' ? sorted : sorted.filter((n) => n.kind === filter);
  }, [store.notifications, filter]);

  const unread = store.notifications.filter((n) => !n.read).length;

  const open = (n: AppNotification) => {
    store.markNotificationRead(n.id);
    if (n.kind === 'person_support') {
      navigate('profile', n.actorId);
    } else if (n.postId) {
      navigate('home', `post-${n.postId}`);
    } else {
      navigate('profile', n.actorId);
    }
  };

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)] mb-1">Notifications</h1>
          <p className="text-sm text-[var(--muted)]">
            {unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'You’re all caught up 🌿'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => {
              store.markAllNotificationsRead();
              store.toast('All notifications marked as read');
            }}
            className="text-sm font-semibold text-[var(--brand)] hover:underline flex-shrink-0"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 pb-1">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
        {(Object.keys(KIND_META) as NotificationKind[]).map((k) => (
          <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} label={KIND_META[k].label} icon={KIND_META[k].icon} />
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Nothing here yet"
          description={filter === 'all' ? 'When people react to your moments, you’ll see it here.' : `No ${KIND_META[filter as NotificationKind].label.toLowerCase()} yet.`}
        />
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
          {list.map((n) => {
            const actor = store.getUser(n.actorId);
            const meta = KIND_META[n.kind];
            const post = n.postId ? store.posts.find((p) => p.id === n.postId) : undefined;
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-[var(--card-2)] ${
                  n.read ? '' : 'bg-[var(--brand-soft)]/40'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar user={actor} size={44} />
                  <span className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-[var(--card)] ${meta.color}`}>
                    <Icon name={meta.icon} size={12} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)] leading-snug">
                    <span className="font-semibold">{actor.name}</span>{' '}
                    {textFor(n)}
                  </p>
                  {n.text && n.kind !== 'comment' && <p className="text-xs text-[var(--muted)] mt-0.5 italic">“{n.text}”</p>}
                  {post && (
                    <p className="text-xs text-[var(--muted)] mt-1 truncate border-l-2 border-[var(--border)] pl-2">
                      {post.text.slice(0, 80)}
                      {post.text.length > 80 ? '…' : ''}
                    </p>
                  )}
                  <p className="text-[11px] text-[var(--muted)] mt-1">{timeAgo(n.at)}</p>
                </div>
                {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand)] flex-shrink-0 mt-1.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function textFor(n: AppNotification): string {
  switch (n.kind) {
    case 'support':
      return 'supported your moment 💚';
    case 'message':
      return `sent a message: “${n.text ?? ''}”`;
    case 'comment':
      return `commented: “${n.text ?? ''}”`;
    case 'person_support':
      return 'started supporting you 🎉';
    case 'mention':
      return 'mentioned you in a moment';
    default:
      return 'sent you a message';
  }
}

function FilterChip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-[var(--brand)] text-white' : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--brand)]'
      }`}
    >
      {icon && <Icon name={icon} size={14} />}
      {label}
    </button>
  );
}
