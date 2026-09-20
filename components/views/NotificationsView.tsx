'use client';

import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, EmptyState, GhostButton } from '@/components/ui/Primitives';
import { timeAgo } from '@/lib/format';
import type { AppNotification } from '@/lib/types';

const KIND_META: Record<string, { icon: string; color: string }> = {
  like: { icon: 'heart', color: '#f43f5e' },
  comment: { icon: 'comment', color: '#60a5fa' },
  join: { icon: 'swords', color: '#16e08a' },
  complete: { icon: 'trophy', color: '#facc15' },
  checkin: { icon: 'check', color: '#16e08a' },
  mention: { icon: 'spark', color: '#a78bfa' },
  message: { icon: 'chat', color: '#60a5fa' },
  streak: { icon: 'flame', color: '#f97316' },
  system: { icon: 'info', color: '#94a3b8' },
};

export default function NotificationsView() {
  const store = useStore();
  const { navigate } = useNav();
  const { notifications } = store;

  const open = (n: AppNotification) => {
    store.markNotificationRead(n.id);
    if (n.conversationId) navigate('messages', n.conversationId);
    else if (n.challengeId) navigate('challenge', n.challengeId);
    else if (n.actorId) navigate('profile', n.actorId);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 fade-in">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-[var(--text)]">Notifications</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {store.unreadNotifications > 0 ? `${store.unreadNotifications} unread` : 'You are all caught up.'}
          </p>
        </div>
        {store.unreadNotifications > 0 && (
          <GhostButton onClick={() => store.markAllNotificationsRead()}>
            <Icon name="check" size={15} /> Mark all read
          </GhostButton>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No notifications yet"
          description="When someone joins, likes or comments on your challenges — or your streak is on the line — it lands here."
        />
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
          {notifications.map((n) => {
            const meta = KIND_META[n.kind] ?? KIND_META.system;
            const actor = n.actorId ? store.getUser(n.actorId) : null;
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-[var(--card-2)] ${n.read ? '' : 'bg-[var(--brand-soft)]/40'}`}
              >
                <span className="relative flex-shrink-0">
                  {actor ? (
                    <Avatar user={actor} size={42} />
                  ) : (
                    <span className="w-[42px] h-[42px] rounded-full bg-[var(--card-2)] flex items-center justify-center">
                      <Icon name={meta.icon} size={18} style={{ color: meta.color }} />
                    </span>
                  )}
                  <span
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--card)]"
                    style={{ background: meta.color }}
                  >
                    <Icon name={meta.icon} size={10} className="text-black" strokeWidth={3} />
                  </span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm leading-snug ${n.read ? 'text-[var(--muted)]' : 'text-[var(--text)] font-semibold'}`}>
                    {n.text ?? defaultText(n)}
                  </span>
                  <span className="block text-[11px] text-[var(--muted)] mt-1">{timeAgo(n.at)}</span>
                </span>
                {!n.read && <span className="w-2 h-2 rounded-full bg-[var(--brand)] mt-2 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function defaultText(n: AppNotification): string {
  switch (n.kind) {
    case 'like': return 'Someone liked your challenge.';
    case 'comment': return 'New comment on your challenge.';
    case 'join': return 'Someone joined your challenge.';
    case 'complete': return 'A participant completed your challenge.';
    case 'streak': return 'Streak update.';
    case 'message': return 'New message.';
    default: return 'Notification.';
  }
}
