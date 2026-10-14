"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Ellipsis, Flag, Lightbulb, Loader2, MessageCircle, Search, Send, Smile, SquarePen, UserRound } from "lucide-react";
import type { ConversationSummary, IdentityMode, Member, Message } from "@/lib/types";
import { api, revalidate } from "@/lib/api";
import { clock, cn, dayLabel, normalizeCode, timeAgo } from "@/lib/utils";
import { useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";
import { UserCode } from "@/components/ui/UserCode";
import { IdentityBadge } from "@/components/ui/Badges";
import { EmptyState, Menu, MenuItem } from "@/components/ui/Primitives";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const EMOJI = ["🙂", "🙏", "💙", "👍", "💪", "❤️"];
type Thread = { id: string; context: string | null; with: (Member & { identity: IdentityMode }) | null; messages: Message[] };

function ThreadView({ id, isMd }: { id: string; isMd: boolean }) {
  const router = useRouter();
  const { actions } = useStore();
  const { data, error, isLoading, mutate } = useSWR<Thread>(`/api/conversations/${id}`, { refreshInterval: 5000 });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data?.messages.length]);
  useEffect(() => {
    if (data) revalidate("/api/me/counts", "/api/conversations");
  }, [data?.messages.length, data]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const r = await api<{ messages: Message[] }>(`/api/conversations/${id}`, { body: { text: t } });
      mutate((d) => (d ? { ...d, messages: r.messages } : d), { revalidate: false });
      setText("");
      setEmoji(false);
      revalidate("/api/conversations");
      input.current?.focus();
    } catch (e) {
      actions.toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  };

  if (isLoading)
    return (
      <div className="grid flex-1 place-items-center text-muted">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  if (error || !data || !data.with)
    return (
      <div className="grid flex-1 place-items-center p-6 text-center text-[0.88rem] text-muted">
        <span>
          This conversation isn't available.{" "}
          <button onClick={() => router.push("/messages")} className="font-semibold text-brand-ink">
            Back to messages
          </button>
        </span>
      </div>
    );

  const other = data.with;
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-4">
        {!isMd && (
          <button onClick={() => router.push("/messages")} className="btn btn-ghost btn-icon btn-sm" aria-label="Back to conversations">
            <ArrowLeft className="size-4.5" />
          </button>
        )}
        <Avatar code={other.code} src={other.avatarUrl} size="md" link online={other.online} />
        <div className="min-w-0 flex-1">
          <UserCode code={other.code} size="md" verified={other.verifiedProfessional} />
          <p className="truncate text-[0.74rem] text-muted">
            {other.online ? "Online" : "Offline"}
            {data.context && ` · ${data.context}`}
          </p>
        </div>
        <Menu
          label="Conversation options"
          trigger={({ toggle }) => (
            <button onClick={toggle} className="btn btn-ghost btn-icon" aria-label="Conversation options">
              <Ellipsis className="size-5" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={UserRound} href={`/profile/${other.code}`} onClick={close}>
                View profile
              </MenuItem>
              <MenuItem icon={Flag} danger onClick={() => (close(), actions.openModal({ type: "report", target: { target: "user", id: other.code, label: `#${other.code}` } }))}>
                Report #{other.code}
              </MenuItem>
            </>
          )}
        </Menu>
      </header>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4 sm:px-5">
        <div className="mx-auto mb-4 max-w-sm text-center">
          <Avatar code={other.code} src={other.avatarUrl} size="xl" className="mx-auto" />
          <p className="code-font mt-2 font-bold text-ink">#{other.code}</p>
          <div className="mt-1 flex justify-center">
            <IdentityBadge mode={other.revealed ? "revealer" : "saver"} revealed={other.revealed ?? undefined} />
          </div>
          <p className="mt-2 text-[0.74rem] text-faint">Messages on RUHIZ show only codes unless someone chooses Identity Revealer.</p>
        </div>
        {data.messages.length === 0 && <p className="text-center text-[0.84rem] text-muted">No messages yet. Say hello.</p>}
        {data.messages.map((m, i) => {
          const prev = data.messages[i - 1];
          const next = data.messages[i + 1];
          const newDay = !prev || dayLabel(prev.at) !== dayLabel(m.at);
          const grouped = prev && prev.fromMe === m.fromMe && !newDay && m.at - prev.at < 5 * 60_000;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">{dayLabel(m.at)}</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <div className={cn("anim-fade flex items-end gap-2", m.fromMe ? "justify-end" : "justify-start", !grouped && "mt-3")}>
                {!m.fromMe && <span className="w-7">{!next || next.fromMe ? <Avatar code={other.code} src={other.avatarUrl} size="xs" className="!size-7" /> : null}</span>}
                <div className="max-w-[78%] sm:max-w-[65%]">
                  <div className={cn("whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[0.9rem] leading-relaxed", m.fromMe ? "rounded-br-md bg-gradient-to-b from-[#3a86ff] to-[#1e5ef0] text-white shadow-[0_6px_16px_-8px_rgba(47,123,255,.8)]" : "rounded-bl-md border border-line bg-elev text-ink")}>
                    {m.text}
                    {m.attachment && (
                      <Link href={`/${m.attachment.kind}/${m.attachment.id}`} className={cn("mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[0.8rem] font-medium", m.fromMe ? "bg-white/15 hover:bg-white/20" : "bg-black/20 hover:bg-black/30")}>
                        <Lightbulb className="size-4 shrink-0" /> <span className="line-clamp-2">{m.attachment.title}</span>
                      </Link>
                    )}
                  </div>
                  <p className={cn("mt-0.5 px-1 text-[0.66rem] text-faint", m.fromMe ? "text-right" : "text-left")}>{clock(m.at)}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <div className="border-t border-line p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="relative flex items-end gap-2"
        >
          <div className="relative">
            <button type="button" onClick={() => setEmoji((v) => !v)} className="btn btn-ghost btn-icon shrink-0" aria-label="Emoji">
              <Smile className="size-4.5" />
            </button>
            {emoji && (
              <div className="anim-scale absolute bottom-full left-0 mb-2 flex gap-1 rounded-xl border border-line-strong bg-[var(--card-solid)] p-1.5 shadow-xl">
                {EMOJI.map((e) => (
                  <button key={e} type="button" onClick={() => (setText((t) => t + e), setEmoji(false), input.current?.focus())} className="grid size-8 place-items-center rounded-lg text-lg hover:bg-white/10">
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 4000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`Message #${other.code}`}
            className="input max-h-32 min-h-10 flex-1 resize-none py-2"
            aria-label="Message"
          />
          <button type="submit" disabled={!text.trim() || sending} className="btn btn-red btn-icon size-10 shrink-0 rounded-full" aria-label="Send">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </section>
  );
}

function Messages() {
  const { actions } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const isMd = useMediaQuery("(min-width: 900px)");
  const { data, error, isLoading } = useSWR<ConversationSummary[]>("/api/conversations", { refreshInterval: 15000 });
  const [q, setQ] = useState("");
  const paramC = params.get("c");
  const paramTo = params.get("to");
  const handledTo = useRef<string | null>(null);

  // ?to=CODE opens (or creates) a conversation with that person.
  useEffect(() => {
    if (!paramTo || handledTo.current === paramTo) return;
    handledTo.current = paramTo;
    api<{ id: string }>("/api/conversations", { body: { code: paramTo } })
      .then(({ id }) => {
        revalidate("/api/conversations");
        router.replace(`/messages?c=${id}`);
      })
      .catch((e) => {
        actions.toast((e as Error).message, "error");
        router.replace("/messages");
      });
  }, [paramTo, router, actions]);

  const list = useMemo(() => {
    const code = normalizeCode(q);
    return (data ?? []).filter((c) => !code || c.with.code.includes(code));
  }, [data, q]);
  const activeId = paramC ?? (isMd ? data?.[0]?.id : null) ?? null;
  const showList = isMd || !activeId;
  const showThread = isMd || !!activeId;

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="card flex h-[calc(100dvh-8.5rem)] min-h-[480px] overflow-hidden md:h-[calc(100dvh-7.5rem)]">
        {showList && (
          <aside className={cn("flex flex-col border-line", isMd ? "w-[340px] shrink-0 border-r" : "w-full")}>
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h1 className="section-title text-[1.2rem]">Messages</h1>
              <button onClick={() => actions.openModal({ type: "newMessage" })} className="btn btn-ghost btn-icon" aria-label="New message">
                <SquarePen className="size-4.5" />
              </button>
            </div>
            <div className="relative px-4 pb-3">
              <Search className="pointer-events-none absolute left-7 top-[1.1rem] size-4 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} className="input code-font h-9 pl-9 text-[0.84rem]" placeholder="Search by code" aria-label="Search conversations by code" />
            </div>
            <ul className="flex-1 overflow-y-auto px-2 pb-2">
              {isLoading && <li className="px-4 py-10 text-center text-[0.84rem] text-muted">Loading…</li>}
              {error && <li className="px-4 py-10 text-center text-[0.84rem] text-rose-300">{error.message}</li>}
              {data && list.length === 0 && <li className="px-4 py-10 text-center text-[0.84rem] text-muted">{q ? "No conversations match that code." : "No conversations yet."}</li>}
              {list.map((c) => {
                const on = c.id === activeId;
                return (
                  <li key={c.id}>
                    <button onClick={() => router.push(`/messages?c=${c.id}`)} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors", on ? "bg-brand/[.14]" : "hover:bg-white/[.04]")}>
                      <Avatar code={c.with.code} src={c.with.avatarUrl} size="lg" online={c.with.online} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("code-font text-[0.9rem] text-ink", c.unread ? "font-bold" : "font-semibold")}>#{c.with.code}</span>
                          <span className="ml-auto shrink-0 text-[0.7rem] text-faint">{c.lastMessage ? timeAgo(c.lastMessage.at) : "new"}</span>
                        </span>
                        {c.context && <span className="block truncate text-[0.7rem] font-medium text-brand-ink/90">{c.context}</span>}
                        <span className="flex items-center gap-2">
                          <span className={cn("block flex-1 truncate text-[0.8rem]", c.unread ? "font-medium text-ink-2" : "text-muted")}>
                            {c.lastMessage ? `${c.lastMessage.fromMe ? "You: " : ""}${c.lastMessage.text}` : "Say hello"}
                          </span>
                          {c.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[0.68rem] font-bold leading-5 text-white">{c.unread}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {showThread &&
          (activeId ? (
            <ThreadView key={activeId} id={activeId} isMd={isMd} />
          ) : (
            <div className="grid flex-1 place-items-center p-6">
              <EmptyState
                icon={MessageCircle}
                title="Your conversations"
                text="Start a conversation using someone's code, or reach out from a profile, an offer of help or the Emotional Support page."
                action={
                  <button onClick={() => actions.openModal({ type: "newMessage" })} className="btn btn-blue">
                    New message
                  </button>
                }
                className="border-0 bg-none shadow-none"
              />
            </div>
          ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Messages />
    </Suspense>
  );
}
