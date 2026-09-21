'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, EmptyState, Modal, ModalHeader, PrimaryButton, Spinner } from '@/components/ui/Primitives';
import { R2Image, R2Video } from '@/components/ui/Media';
import { uploadMedia, validateUpload } from '@/lib/upload';
import { clockTime, timeAgo } from '@/lib/format';

/**
 * MESSAGES — real conversations between challengers (Postgres + RLS).
 *
 * Inbox / Message Requests tabs, conversation list with previews and unread
 * badges, online status from real last_seen_at, the shared-challenge context
 * card ("You both are participating in …"), photo/video messages and read
 * receipts. Requests appear when the recipient restricts messages — they are
 * accepted or declined from the tab, and accepting creates the conversation
 * server-side.
 */

type Tab = 'inbox' | 'requests';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function presenceLabel(lastSeenAt?: string | null): { label: string; online: boolean } {
  if (!lastSeenAt) return { label: 'Offline', online: false };
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_WINDOW_MS) return { label: 'Online', online: true };
  const h = Math.floor(diff / 3600_000);
  if (h < 1) return { label: 'Active just now', online: false };
  if (h < 24) return { label: `Active ${h}h ago`, online: false };
  return { label: `Active ${Math.floor(h / 24)}d ago`, online: false };
}

export default function MessagesView({ initialThread }: { initialThread?: string }) {
  const store = useStore();
  const { navigate } = useNav();
  const [tab, setTab] = useState<Tab>('inbox');
  const [activeId, setActiveId] = useState<string | null>(initialThread ?? null);
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialThread) setActiveId(initialThread);
  }, [initialThread]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const threads = useMemo(
    () =>
      store.threads
        .slice()
        .filter((t) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          const other = store.getUser(t.userId);
          return other.name.toLowerCase().includes(q) || other.username.toLowerCase().includes(q);
        })
        .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')),
    [store.threads, query, store]
  );

  const incomingRequests = useMemo(
    () => store.db.messageRequests.filter((r) => r.status === 'pending' && r.toId === store.db.meId),
    [store.db.messageRequests, store.db.meId]
  );
  const sentRequests = useMemo(
    () => store.db.messageRequests.filter((r) => r.fromId === store.db.meId),
    [store.db.messageRequests, store.db.meId]
  );

  const active = store.threads.find((t) => t.id === activeId) ?? null;
  const other = active ? store.getUser(active.userId) : null;

  // mark read when a thread is open (also live when new messages arrive)
  useEffect(() => {
    if (active) store.markThreadRead(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.messages.length]);

  // shared challenge context (real co-participation)
  const sharedChallenge = useMemo(() => {
    if (!active) return null;
    const otherId = active.userId;
    for (const p of store.db.participants) {
      if (p.userId !== store.db.meId) continue;
      const ch = store.db.challenges.find((c) => c.id === p.challengeId);
      if (!ch) continue;
      const otherPart = store.db.participants.find((x) => x.challengeId === p.challengeId && x.userId === otherId);
      if (otherPart) {
        const myPart = p;
        return { challenge: ch, myPart, otherPart };
      }
    }
    return null;
  }, [active, store.db.participants, store.db.challenges, store.db.meId]);

  const startWith = async (userId: string) => {
    setNewOpen(false);
    const id = await store.openThreadWith(userId);
    if (id) {
      setTab('inbox');
      setActiveId(id);
    }
  };

  const acceptRequest = async (requestId: string) => {
    const convoId = await store.acceptMessageRequest(requestId);
    if (convoId) {
      setTab('inbox');
      setActiveId(convoId);
    }
  };

  return (
    <div className="max-w-6xl mx-auto fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-[var(--text)]">Messages</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Connect. Support. Grow together.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-10 h-10 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] flex items-center justify-center"
              aria-label="Message options"
            >
              <Icon name="dots" size={18} />
            </button>
            {menuOpen && (
              <div className="pop-in absolute right-0 top-full mt-1 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-30 overflow-hidden">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    store.markAllNotificationsRead();
                    store.toast('All caught up.', 'info');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2"
                >
                  <Icon name="check" size={15} className="text-[var(--muted)]" /> Mark all as read
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('settings');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2"
                >
                  <Icon name="settings" size={15} className="text-[var(--muted)]" /> Message privacy settings
                </button>
              </div>
            )}
          </div>
          <PrimaryButton onClick={() => setNewOpen(true)}>
            <Icon name="plus" size={15} /> New Message
          </PrimaryButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] mb-4">
        <TabBtn active={tab === 'inbox'} onClick={() => setTab('inbox')} label="Inbox" count={store.unreadMessages} />
        <TabBtn active={tab === 'requests'} onClick={() => setTab('requests')} label="Message Requests" count={store.unreadRequests} />
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* ------------------------------ list pane ------------------------------ */}
        <div className={`w-full lg:w-[340px] flex-shrink-0 ${active ? 'hidden lg:block' : 'block'}`}>
          {tab === 'inbox' ? (
            <>
              {/* Search */}
              <div className="relative mb-3">
                <Icon name="search" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search conversations…"
                  aria-label="Search conversations"
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50"
                />
              </div>

              {threads.length === 0 ? (
                <EmptyState
                  icon="chat"
                  title={query ? 'No matching conversations' : 'No conversations yet'}
                  description={query ? 'Try a different name.' : 'Open a challenge and message its creator, or start from any profile.'}
                  action={!query ? (
                    <PrimaryButton onClick={() => setNewOpen(true)}>
                      <Icon name="plus" size={14} /> New Message
                    </PrimaryButton>
                  ) : undefined}
                />
              ) : (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
                  {threads.map((t) => {
                    const u = store.getUser(t.userId);
                    const last = t.messages.at(-1);
                    const presence = presenceLabel(u.lastSeenAt);
                    const preview = last
                      ? last.media
                        ? `${last.fromMe ? 'You: ' : ''}${last.mediaType === 'video' ? '🎬 Video' : '📷 Photo'}`
                        : `${last.fromMe ? 'You: ' : ''}${last.text}`
                      : 'Say hello 👋';
                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveId(t.id)}
                        className={`w-full flex items-center gap-3 p-3.5 text-left hover:bg-[var(--card-2)] transition-colors ${activeId === t.id ? 'bg-[var(--card-2)]' : ''}`}
                      >
                        <span className="relative flex-shrink-0">
                          <Avatar user={u} size={46} />
                          {presence.online && (
                            <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-[var(--brand)] border-2 border-[var(--card)]" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-[var(--text)] truncate">{u.name}</span>
                            {last && <span className="text-[10px] text-[var(--muted)] flex-shrink-0">{timeAgo(last.at)}</span>}
                          </span>
                          <span className={`block text-xs truncate mt-0.5 ${t.unread > 0 ? 'text-[var(--text)] font-semibold' : 'text-[var(--muted)]'}`}>
                            {preview}
                          </span>
                        </span>
                        {t.unread > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--brand)] text-black text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                            {t.unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* quick start */}
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Start a conversation</p>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {Object.values(store.db.profiles)
                    .filter((p) => p.id !== store.db.meId && !store.threads.some((t) => t.userId === p.id))
                    .slice(0, 10)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => void startWith(p.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:border-[var(--brand)]/50 transition-colors flex-shrink-0"
                      >
                        <Avatar user={p} size={20} /> {p.name}
                      </button>
                    ))}
                </div>
              </div>
            </>
          ) : (
            /* ------------------------- Message Requests tab ------------------------- */
            <div className="space-y-3">
              {incomingRequests.length === 0 && sentRequests.length === 0 ? (
                <EmptyState
                  icon="lock"
                  title="No message requests"
                  description="When someone messages you but your privacy settings restrict them, the request lands here so you can accept or decline."
                  action={
                    <button
                      onClick={() => navigate('settings')}
                      className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--card-2)] transition-colors"
                    >
                      Message privacy settings
                    </button>
                  }
                />
              ) : (
                <>
                  {incomingRequests.length > 0 && (
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
                      {incomingRequests.map((r) => {
                        const u = store.getUser(r.fromId);
                        return (
                          <div key={r.id} className="p-3.5 flex items-center gap-3">
                            <Avatar user={u} size={42} onClick={() => navigate('profile', u.id)} />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-[var(--text)] truncate">{u.name}</p>
                              <p className="text-xs text-[var(--muted)]">
                                @{u.username} wants to message you · {timeAgo(r.createdAt)}
                              </p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => void acceptRequest(r.id)}
                                className="px-3 py-1.5 rounded-lg bg-[var(--brand)] text-black text-xs font-bold hover:bg-[var(--brand-dark)] transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => void store.declineMessageRequest(r.id)}
                                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {sentRequests.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Sent by you</p>
                      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
                        {sentRequests.map((r) => {
                          const u = store.getUser(r.toId);
                          return (
                            <div key={r.id} className="p-3.5 flex items-center gap-3">
                              <Avatar user={u} size={42} onClick={() => navigate('profile', u.id)} />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-[var(--text)] truncate">{u.name}</p>
                                <p className="text-xs text-[var(--muted)]">@{u.username}</p>
                              </div>
                              <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0 ${
                                  r.status === 'pending'
                                    ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                                    : r.status === 'accepted'
                                      ? 'bg-emerald-500/15 text-emerald-400'
                                      : 'bg-[var(--card-2)] text-[var(--muted)]'
                                }`}
                              >
                                {r.status === 'pending' ? 'Pending' : r.status === 'accepted' ? 'Accepted' : 'Declined'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ------------------------------ chat pane ------------------------------ */}
        <div className={`flex-1 min-w-0 w-full ${active ? 'block' : 'hidden lg:block'}`}>
          {active && other ? (
            <ChatPane
              key={active.id}
              thread={active}
              otherId={other.id}
              onBack={() => setActiveId(null)}
              shared={sharedChallenge}
            />
          ) : (
            <div className="w-full h-[420px] bg-[var(--card)] border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center text-center p-8">
              <Icon name="chat" size={34} className="text-[var(--muted)] mb-3" />
              <p className="font-bold text-[var(--text)]">Your messages</p>
              <p className="text-sm text-[var(--muted)] mt-1 max-w-xs">
                Pick a conversation or start a new one. Shared challenges show up right here in the chat.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New message modal */}
      {newOpen && <NewMessageModal onClose={() => setNewOpen(false)} onStart={(id) => void startWith(id)} />}
    </div>
  );
}

/* ------------------------------ tab button ------------------------------ */

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
        active ? 'border-[var(--brand)] text-[var(--text)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${active ? 'bg-[var(--brand)] text-black' : 'bg-[var(--card-2)] text-[var(--muted)]'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/* -------------------------------- chat pane ------------------------------- */

function ChatPane({
  thread,
  otherId,
  onBack,
  shared,
}: {
  thread: ReturnType<typeof useStore>['threads'][number];
  otherId: string;
  onBack: () => void;
  shared: { challenge: { id: string; title: string; durationDays: number }; myPart: { completedDays: number; status: string } } | null;
}) {
  const store = useStore();
  const { navigate } = useNav();
  const other = store.getUser(otherId);
  const presence = presenceLabel(other.lastSeenAt);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const isBlocked = store.settings.blocked.includes(otherId);
  const otherLastRead = thread.otherLastReadAt;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    const ok = await store.sendMessage(thread.id, text);
    if (ok) setDraft('');
  };

  const attach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachError(null);
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setAttachError('Send a photo (JPG, PNG, WebP) or video (MP4, MOV, WebM).');
      return;
    }
    const kind = isVideo ? 'post-video' : 'chat-image';
    const err = validateUpload(file, kind);
    if (err) {
      setAttachError(err);
      return;
    }
    setAttaching(true);
    setUploadPct(0);
    try {
      const res = await uploadMedia(file, kind, (pct) => setUploadPct(pct));
      const ok = await store.sendMessage(thread.id, '', res.key, isVideo ? 'video' : 'image');
      if (ok) setAttachError(null);
    } catch (err2: any) {
      setAttachError(err2?.message ?? 'Upload failed. Please try again.');
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col h-[560px] lg:h-[calc(100vh-260px)] lg:min-h-[480px]">
      {/* header */}
      <div className="flex items-center gap-3 p-3.5 border-b border-[var(--border)]">
        <button onClick={onBack} className="lg:hidden p-2 rounded-lg hover:bg-[var(--card-2)] text-[var(--muted)]" aria-label="Back to conversations">
          <Icon name="back" size={17} />
        </button>
        <span className="relative flex-shrink-0">
          <Avatar user={other} size={42} onClick={() => navigate('profile', otherId)} />
          {presence.online && (
            <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-[var(--brand)] border-2 border-[var(--card)]" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[var(--text)] truncate">{other.name}</p>
          <p className={`text-[11px] ${presence.online ? 'text-[var(--brand)] font-semibold' : 'text-[var(--muted)]'}`}>
            {presence.online && '● '}
            {presence.label} · @{other.username}
          </p>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--card-2)]"
            aria-label="Conversation menu"
          >
            <Icon name="dots" size={17} />
          </button>
          {menuOpen && (
            <div className="pop-in absolute right-0 top-full mt-1 w-52 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-30 overflow-hidden">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('profile', otherId);
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2"
              >
                <Icon name="user" size={15} className="text-[var(--muted)]" /> View profile
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (isBlocked) store.unblockUser(otherId);
                  else {
                    if (window.confirm(`Block ${other.name}? They won't be able to start conversations with you.`)) store.blockUser(otherId);
                  }
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 ${isBlocked ? 'text-[var(--text)] hover:bg-[var(--card-2)]' : 'text-[var(--danger)] hover:bg-[var(--danger-soft)]'}`}
              >
                <Icon name="lock" size={15} /> {isBlocked ? 'Unblock user' : 'Block user'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* shared challenge context */}
      {shared && (
        <div className="mx-3.5 mt-3.5 p-3.5 rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[var(--brand)]/20 text-[var(--brand)] flex items-center justify-center flex-shrink-0">
            <Icon name="flame" size={19} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[var(--muted)]">You both are participating in</p>
            <p className="text-sm font-bold text-[var(--text)] truncate">{shared.challenge.title}</p>
            <p className="text-[11px] text-[var(--brand)] font-semibold">
              {shared.myPart.status === 'completed' ? '🏆 Completed' : `Day ${shared.myPart.completedDays} of ${shared.challenge.durationDays}`}
            </p>
          </div>
          <button
            onClick={() => navigate('challenge', shared.challenge.id)}
            className="px-3 py-2 rounded-xl bg-[var(--brand)] text-black text-xs font-bold hover:bg-[var(--brand-dark)] transition-colors flex items-center gap-1 flex-shrink-0"
          >
            View Challenge <Icon name="arrowRight" size={12} />
          </button>
        </div>
      )}

      {/* messages */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-1">
        {thread.messages.length === 0 && (
          <p className="text-center text-sm text-[var(--muted)] py-10">No messages yet — start the duel talk.</p>
        )}
        {thread.messages.map((m, i) => {
          const prev = thread.messages[i - 1];
          const showDay = !prev || dayKey(prev.at) !== dayKey(m.at);
          return (
            <React.Fragment key={m.id}>
              {showDay && (
                <div className="flex items-center gap-3 my-3">
                  <span className="h-px bg-[var(--border)] flex-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{dayLabel(m.at)}</span>
                  <span className="h-px bg-[var(--border)] flex-1" />
                </div>
              )}
              <div className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                {!m.fromMe && <Avatar user={other} size={26} />}
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl ${
                    m.fromMe ? 'bg-[var(--brand)] text-black rounded-br-md' : 'bg-[var(--card-2)] text-[var(--text)] rounded-bl-md'
                  } overflow-hidden`}
                >
                  {m.media && (
                    <div className={`rounded-xl overflow-hidden mb-1.5 ${m.fromMe ? '' : 'bg-black'}`}>
                      {m.mediaType === 'video' ? (
                        <R2Video mediaKey={m.media} controls className="w-full max-h-64 object-contain" />
                      ) : (
                        <R2Image mediaKey={m.media} alt="Chat media" className="w-full max-h-64 object-contain" />
                      )}
                    </div>
                  )}
                  {m.text && <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{m.text}</p>}
                  <p className={`text-[10px] mt-1 flex items-center gap-1 ${m.fromMe ? 'text-black/60' : 'text-[var(--muted)]'}`}>
                    {clockTime(m.at)}
                    {m.fromMe && (
                      <span title={otherLastRead && new Date(otherLastRead) >= new Date(m.at) ? 'Read' : 'Sent'}>
                        {otherLastRead && new Date(otherLastRead) >= new Date(m.at) ? '✓✓' : '✓'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="p-3 border-t border-[var(--border)] space-y-2">
        {attachError && (
          <p className="text-[11px] text-[var(--danger)] px-1">{attachError}</p>
        )}
        {attaching && (
          <div className="px-1 flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <Spinner size={13} /> Uploading… {uploadPct}%
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/x-m4v" className="hidden" onChange={attach} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={attaching}
            className="p-2.5 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"
            aria-label="Attach photo or video"
            title="Attach photo or video"
          >
            <Icon name="camera" size={17} />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Write a message…"
            aria-label="Message text"
            className="flex-1 bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60 resize-none max-h-32"
          />
          <div className="relative">
            <button
              onClick={() => setEmojiOpen((v) => !v)}
              className="p-2.5 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
              aria-label="Quick emoji"
            >
              <span className="text-base leading-none">😊</span>
            </button>
            {emojiOpen && (
              <div className="pop-in absolute bottom-full right-0 mb-2 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl p-2 grid grid-cols-6 gap-1 z-30">
                {['🔥', '💪', '🏃', '🎯', '❤️', '👏', '😄', '🙏', '👀', '💯', '🥇', '⚡'].map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setDraft((d) => (d + e).slice(0, 2000));
                      setEmojiOpen(false);
                    }}
                    className="text-lg p-1.5 rounded-lg hover:bg-[var(--card-2)]"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => void send()}
            disabled={!draft.trim() || attaching}
            className="p-3 rounded-xl bg-[var(--brand)] text-black hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-40"
            aria-label="Send message"
          >
            <Icon name="send" size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- new message modal ---------------------------- */

function NewMessageModal({ onClose, onStart }: { onClose: () => void; onStart: (userId: string) => void }) {
  const store = useStore();
  const [q, setQ] = useState('');

  const people = useMemo(() => {
    const query = q.trim().toLowerCase();
    return Object.values(store.db.profiles)
      .filter((p) => p.id !== store.db.meId)
      .filter((p) => !query || p.name.toLowerCase().includes(query) || p.username.toLowerCase().includes(query))
      .slice(0, 30);
  }, [store.db.profiles, store.db.meId, q]);

  return (
    <Modal open={true} onClose={onClose} labelledBy="new-message" maxWidth="max-w-md">
      <ModalHeader title="New Message" subtitle="Start a conversation with a real challenger" onClose={onClose} />
      <div className="p-4 space-y-3">
        <div className="relative">
          <Icon name="search" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search members…"
            aria-label="Search members"
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-2)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50"
          />
        </div>
        {people.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-8">No members found{q ? ` for “${q.trim()}”` : ' yet'}.</p>
        ) : (
          <div className="max-h-[46vh] overflow-y-auto space-y-1">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => onStart(p.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--card-2)] transition-colors text-left"
              >
                <Avatar user={p} size={40} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text)] truncate">{p.name}</span>
                  <span className="block text-xs text-[var(--muted)] truncate">@{p.username}</span>
                </span>
                <Icon name="arrowRight" size={14} className="ml-auto text-[var(--muted)]" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------ date helpers ------------------------------ */

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
