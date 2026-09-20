'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, EmptyState, Spinner } from '@/components/ui/Primitives';
import { clockTime, timeAgo } from '@/lib/format';

export default function MessagesView({ initialThread }: { initialThread?: string }) {
  const store = useStore();
  const { navigate } = useNav();
  const [activeId, setActiveId] = useState<string | null>(initialThread ?? null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const threads = useMemo(
    () => store.threads.slice().sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')),
    [store.threads]
  );
  const active = threads.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    if (initialThread) setActiveId(initialThread);
  }, [initialThread]);

  useEffect(() => {
    if (active) store.markThreadRead(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [active?.messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !active) return;
    setSending(true);
    const ok = await store.sendMessage(active.id, text);
    setSending(false);
    if (ok) setDraft('');
  };

  const startWith = async (userId: string) => {
    const id = await store.openThreadWith(userId);
    if (id) setActiveId(id);
  };

  /* ------------------------------ mobile: list ------------------------------ */
  const listPane = (
    <div className={`flex-1 min-w-0 ${active ? 'hidden md:flex' : 'flex'} flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="display text-2xl text-[var(--text)]">Messages</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Direct messages with other challengers.</p>
        </div>
      </div>
      {threads.length === 0 ? (
        <EmptyState
          icon="chat"
          title="No conversations yet"
          description="Open a challenge and message its creator, or start from any profile."
          action={
            <button onClick={() => navigate('explore')} className="px-5 py-2.5 rounded-xl bg-[var(--brand)] text-black text-sm font-bold hover:bg-[var(--brand-dark)] transition-colors">
              Find challengers
            </button>
          }
        />
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
          {threads.map((t) => {
            const other = store.getUser(t.userId);
            const last = t.messages.at(-1);
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--card-2)] transition-colors ${activeId === t.id ? 'bg-[var(--card-2)]' : ''}`}
              >
                <Avatar user={other} size={46} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[var(--text)] truncate">{other.name}</span>
                    {last && <span className="text-[10px] text-[var(--muted)] flex-shrink-0">{timeAgo(last.at)}</span>}
                  </span>
                  <span className={`block text-xs truncate mt-0.5 ${t.unread > 0 ? 'text-[var(--text)] font-semibold' : 'text-[var(--muted)]'}`}>
                    {last ? `${last.fromMe ? 'You: ' : ''}${last.text}` : 'Say hello 👋'}
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
            .filter((p) => p.id !== store.db.meId && !threads.some((t) => t.userId === p.id))
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
    </div>
  );

  /* ----------------------------- mobile: thread ----------------------------- */
  const threadPane = active && (
    <div className={`flex-1 min-w-0 ${active ? 'flex' : 'hidden md:flex'} flex-col bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden`}>
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => setActiveId(null)} className="md:hidden p-2 rounded-lg hover:bg-[var(--card-2)] text-[var(--muted)]" aria-label="Back to conversations">
          <Icon name="back" size={17} />
        </button>
        <Avatar user={store.getUser(active.userId)} size={40} onClick={() => navigate('profile', active.userId)} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-[var(--text)] truncate">{store.getUser(active.userId).name}</p>
          <p className="text-[11px] text-[var(--muted)]">@{store.getUser(active.userId).username}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[320px] max-h-[52vh] md:max-h-[calc(100vh-320px)]">
        {active.messages.length === 0 && (
          <p className="text-center text-sm text-[var(--muted)] py-8">No messages yet — start the duel talk.</p>
        )}
        {active.messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                m.fromMe ? 'bg-[var(--brand)] text-black rounded-br-md' : 'bg-[var(--card-2)] text-[var(--text)] rounded-bl-md'
              }`}
            >
              <p className="break-words">{m.text}</p>
              <p className={`text-[10px] mt-1 ${m.fromMe ? 'text-black/60' : 'text-[var(--muted)]'}`}>{clockTime(m.at)}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-[var(--border)] flex items-end gap-2">
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
        <button
          onClick={() => void send()}
          disabled={sending || !draft.trim()}
          className="p-3 rounded-xl bg-[var(--brand)] text-black hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-50"
          aria-label="Send message"
        >
          {sending ? <Spinner size={17} /> : <Icon name="send" size={17} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto fade-in">
      <div className="flex gap-5 items-start">
        {listPane}
        {threadPane}
      </div>
    </div>
  );
}
