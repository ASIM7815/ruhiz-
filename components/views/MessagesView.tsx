'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, EmptyState } from '@/components/ui/Primitives';
import { clockTime, timeAgo } from '@/lib/format';

export default function MessagesView({ initialThread }: { initialThread?: string }) {
  const store = useStore();
  const { navigate } = useNav();
  const { threads, typing } = store;
  const [activeId, setActiveId] = useState<string | null>(initialThread ?? null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(!!initialThread);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () =>
      [...threads].sort((a, b) => {
        const la = a.messages.at(-1)?.at ?? '0';
        const lb = b.messages.at(-1)?.at ?? '0';
        return lb.localeCompare(la);
      }),
    [threads]
  );

  const filteredThreads = query.trim()
    ? sorted.filter((t) => store.getUser(t.userId).name.toLowerCase().includes(query.toLowerCase()))
    : sorted;

  const active = threads.find((t) => t.id === activeId) ?? null;
  const activeUser = active ? store.getUser(active.userId) : null;

  useEffect(() => {
    if (initialThread) {
      setActiveId(initialThread);
      setMobileChatOpen(true);
    }
  }, [initialThread]);

  useEffect(() => {
    if (activeId) store.markThreadRead(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, active?.messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length, activeId, typing]);

  const openThread = (id: string) => {
    setActiveId(id);
    setMobileChatOpen(true);
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !activeId) return;
    store.sendMessage(activeId, text);
    setDraft('');
  };

  const isTyping = active ? typing[active.id] : false;

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden flex h-[calc(100dvh-180px)] md:h-[calc(100dvh-140px)]">
        {/* Thread list */}
        <div className={`w-full md:w-[300px] lg:w-[330px] border-r border-[var(--border)] flex-col flex-shrink-0 ${mobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--text)] mb-3">Messages</h2>
            <div className="relative">
              <Icon name="search" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-9 pr-3 py-2 bg-[var(--card-2)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 placeholder:text-[var(--muted)]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredThreads.length === 0 && (
              <p className="text-sm text-[var(--muted)] text-center py-8 px-4">No conversations found. Say hello to someone from Connections!</p>
            )}
            {filteredThreads.map((t) => {
              const u = store.getUser(t.userId);
              const last = t.messages.at(-1);
              return (
                <button
                  key={t.id}
                  onClick={() => openThread(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                    activeId === t.id ? 'bg-[var(--brand-soft)]' : 'hover:bg-[var(--card-2)]'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar user={u} size={46} />
                    {t.online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-[var(--card)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${t.unread ? 'font-bold text-[var(--text)]' : 'font-semibold text-[var(--text)]'}`}>{u.name}</p>
                      {last && <span className="text-[10px] text-[var(--muted)] flex-shrink-0">{timeAgo(last.at)}</span>}
                    </div>
                    <p className={`text-xs truncate ${t.unread ? 'text-[var(--text)] font-semibold' : 'text-[var(--muted)]'}`}>
                      {typing[t.id] ? 'typing…' : last ? `${last.fromMe ? 'You: ' : ''}${last.text}` : 'Start the conversation 👋'}
                    </p>
                  </div>
                  {t.unread > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--brand)] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                      {t.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat pane */}
        <div className={`flex-1 flex-col min-w-0 ${mobileChatOpen ? 'flex' : 'hidden md:flex'}`}>
          {!active || !activeUser ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <EmptyState icon="chat" title="Your messages" description="Pick a conversation or start a new one from Connections." />
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                <button onClick={() => setMobileChatOpen(false)} className="md:hidden p-1.5 rounded-full hover:bg-[var(--card-2)] text-[var(--muted)]" aria-label="Back to chats">
                  <Icon name="back" size={18} />
                </button>
                <Avatar user={activeUser} size={40} onClick={() => navigate('profile', activeUser.id)} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{activeUser.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {isTyping ? 'typing…' : active.online ? 'Active now' : `Active ${timeAgo(active.messages.at(-1)?.at ?? new Date().toISOString())} ago`}
                  </p>
                </div>
                <button onClick={() => navigate('profile', activeUser.id)} className="p-2 rounded-full hover:bg-[var(--card-2)] text-[var(--muted)]" aria-label="View profile">
                  <Icon name="user" size={18} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {active.messages.length === 0 && (
                  <div className="text-center py-10">
                    <Avatar user={activeUser} size={64} className="mx-auto mb-3" />
                    <p className="font-semibold text-[var(--text)]">{activeUser.name}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">This is the beginning of your conversation. Be kind 💚</p>
                  </div>
                )}
                {active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'} fade-in`}>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        m.fromMe
                          ? 'bg-[var(--brand)] text-white rounded-br-lg'
                          : 'bg-[var(--card-2)] text-[var(--text)] rounded-bl-lg'
                      }`}
                    >
                      {m.text}
                      <div className={`text-[10px] mt-1 ${m.fromMe ? 'text-white/70 text-right' : 'text-[var(--muted)]'}`}>{clockTime(m.at)}</div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-[var(--card-2)] rounded-3xl rounded-bl-lg px-4 py-3 flex gap-1.5 items-center">
                      <span className="typing-dot w-2 h-2 rounded-full bg-[var(--muted)] inline-block" />
                      <span className="typing-dot w-2 h-2 rounded-full bg-[var(--muted)] inline-block" />
                      <span className="typing-dot w-2 h-2 rounded-full bg-[var(--muted)] inline-block" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div className="p-3 border-t border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder={`Message ${activeUser.name.split(' ')[0]}…`}
                    className="flex-1 px-4 py-2.5 bg-[var(--card-2)] rounded-full text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 placeholder:text-[var(--muted)]"
                  />
                  <button
                    onClick={send}
                    disabled={!draft.trim()}
                    className="p-2.5 rounded-full bg-[var(--brand)] text-white disabled:opacity-40 hover:bg-[var(--brand-dark)] transition-colors"
                    aria-label="Send message"
                  >
                    <Icon name="send" size={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
