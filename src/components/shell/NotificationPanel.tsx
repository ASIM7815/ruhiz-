"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Bell, BellOff, CheckCheck, HandHelping, HeartHandshake, Lightbulb, Loader2, MessageCircle, MessagesSquare, Milestone, UserPlus, type LucideIcon } from "lucide-react";
import type { AppNotification, NotificationType } from "@/lib/types";
import { api, revalidate } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { useCounts } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";

const ICON: Record<NotificationType, { icon: LucideIcon; cls: string }> = {
  support: { icon: HeartHandshake, cls: "bg-brand text-white" },
  response: { icon: MessagesSquare, cls: "bg-amber-500 text-white" },
  solution: { icon: Lightbulb, cls: "bg-sky-500 text-white" },
  message: { icon: MessageCircle, cls: "bg-accent text-white" },
  help: { icon: HandHelping, cls: "bg-violet-500 text-white" },
  status: { icon: Milestone, cls: "bg-emerald-500 text-white" },
  supporter: { icon: UserPlus, cls: "bg-brand text-white" },
};

export function NotificationButton() {
  const router = useRouter();
  const counts = useCounts();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const ref = useRef<HTMLDivElement>(null);
  const { data, error, isLoading, mutate } = useSWR<AppNotification[]>(open ? "/api/notifications" : null);
  const unread = counts.notifications;
  const list = (data ?? []).filter((n) => tab === "all" || !n.read);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAll = async () => {
    mutate((d) => d?.map((n) => ({ ...n, read: true })), { revalidate: false });
    await api("/api/notifications", { body: { all: true } }).catch(() => {});
    revalidate("/api/me/counts");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("relative grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-white/[.06] hover:text-white", open && "bg-white/[.06] text-white")}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="size-[1.3rem]" strokeWidth={1.9} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-[1.05rem] place-items-center rounded-full bg-accent px-1 text-[0.6rem] font-bold leading-[1.05rem] text-white shadow-[0_0_10px_rgba(255,46,85,.7)] ring-2 ring-bg">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-scale fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-line-strong bg-[var(--card-solid)] shadow-[0_30px_70px_-20px_rgba(0,0,0,.95)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[400px]">
          <div className="flex items-center justify-between px-4 pt-3.5">
            <h3 className="section-title">Notifications</h3>
            <button onClick={markAll} disabled={!unread} className="btn btn-ghost btn-sm text-brand-ink disabled:opacity-40">
              <CheckCheck className="size-4" /> Mark all read
            </button>
          </div>
          <div className="mt-2 flex gap-1 border-b border-line px-3">
            {(["all", "unread"] as const).map((t) => (
              <button key={t} data-on={tab === t} onClick={() => setTab(t)} className={cn("tab-underline h-9 px-3 text-[0.82rem] font-semibold capitalize", tab === t ? "text-ink" : "text-muted hover:text-ink-2")}>
                {t}
                {t === "unread" && unread > 0 && <span className="ml-1.5 rounded bg-accent/15 px-1.5 text-[0.7rem] text-rose-200">{unread}</span>}
              </button>
            ))}
          </div>
          <ul className="max-h-[min(70vh,480px)] overflow-y-auto p-1.5">
            {isLoading && (
              <li className="flex items-center justify-center gap-2 px-6 py-10 text-[0.85rem] text-muted">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </li>
            )}
            {error && <li className="px-6 py-10 text-center text-[0.85rem] text-rose-300">Couldn't load notifications. {error.message}</li>}
            {data && list.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-6 py-10 text-center text-[0.85rem] text-muted">
                <BellOff className="size-6 text-faint" />
                {tab === "unread" ? "You're all caught up." : "No notifications yet. They'll appear when people respond to, support or help with what you share."}
              </li>
            )}
            {list.map((n) => {
              const meta = ICON[n.type];
              const Icon = meta.icon;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      if (!n.read) api("/api/notifications", { body: { ids: [n.id] } }).then(() => revalidate("/api/me/counts")).catch(() => {});
                      setOpen(false);
                      router.push(n.href);
                    }}
                    className={cn("flex w-full gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/[.04]", !n.read && "bg-brand/[.07]")}
                  >
                    <span className="relative shrink-0">
                      <Avatar code={n.actor.code} src={n.actor.avatarUrl} size="md" />
                      <span className={cn("absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-[var(--card-solid)]", meta.cls)}>
                        <Icon className="size-3" />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 text-[0.84rem] leading-snug text-ink-2">
                      <span className="code-font font-semibold text-ink">#{n.actor.code}</span> {n.text}
                      <span className="mt-1 block text-[0.74rem] text-faint">{timeAgo(n.at)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent shadow-[0_0_8px_rgba(255,46,85,.8)]" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
