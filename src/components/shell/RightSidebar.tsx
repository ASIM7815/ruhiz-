"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChartNoAxesColumn, Check, ChevronRight, ChevronsLeft, ChevronsRight, Flame, HandHelping, MapPin, UserPlus, Users, type LucideIcon } from "lucide-react";
import type { Member, ProblemStatus } from "@/lib/types";
import { api, revalidate } from "@/lib/api";
import { cn, formatCount } from "@/lib/utils";
import { CATEGORIES } from "@/lib/meta";
import { useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";
import { CardTitle } from "@/components/ui/Primitives";
import { StatusPill } from "@/components/ui/Badges";

interface SidebarData {
  topics: { id: keyof typeof CATEGORIES; label: string; activity: number; posts: number }[];
  suggested: Member[];
  popular: { id: string; title: string; authorCode: string | null; supports: number; discussions: number; thumbUrl: string | null }[];
  nearby: { id: string; title: string; status: ProblemStatus }[];
  location: string;
}

const RANK = [
  "bg-gradient-to-b from-[#7a1328] to-[#4a0a18] text-rose-100 ring-rose-500/40",
  "bg-gradient-to-b from-[#2a9bff] to-[#1560e0] text-white ring-sky-300/30",
  "bg-gradient-to-b from-[#ffad8a] to-[#f07b55] text-[#3a1206] ring-orange-200/40",
  "bg-gradient-to-b from-[#2f7bff] to-[#1b4fd0] text-white ring-blue-300/30",
  "bg-gradient-to-b from-[#2f7bff] to-[#1b4fd0] text-white ring-blue-300/30",
];

function useSidebar() {
  return useSWR<SidebarData>("/api/sidebar", { refreshInterval: 120_000 });
}

function SeeAll({ href, onClick, label = "See All" }: { href?: string; onClick?: () => void; label?: string }) {
  const cls = "text-[0.8rem] font-semibold text-brand-ink transition-colors hover:text-white";
  return href ? (
    <Link href={href} className={cls}>
      {label}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {label}
    </button>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 px-4 pb-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="skeleton size-9 rounded-full" />
          <span className="flex-1 space-y-1.5">
            <span className="skeleton block h-3 w-2/3 rounded" />
            <span className="skeleton block h-2.5 w-1/3 rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-4 pb-4 text-[0.8rem] leading-relaxed text-muted">{children}</p>;

export function TrendingTopics() {
  const { data, error } = useSidebar();
  return (
    <section className="card overflow-hidden">
      <CardTitle icon={Flame} title="Trending Topics" action={<SeeAll href="/explore" />} />
      {!data && !error ? (
        <Skeleton rows={5} />
      ) : error ? (
        <Empty>Couldn't load topics.</Empty>
      ) : (
        <ul className="px-2 pb-2">
          {data!.topics.map((t, i) => (
            <li key={t.id}>
              <Link href={`/explore?category=${t.id}`} className="group flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-white/[.04]">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-[0.82rem] font-bold ring-1", RANK[i])}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.88rem] font-semibold text-ink">{CATEGORIES[t.id]?.label ?? t.label}</span>
                  <span className="block text-[0.74rem] text-muted">
                    {formatCount(t.posts)} {t.posts === 1 ? "post" : "posts"}
                  </span>
                </span>
                <ChevronRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink-2" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SuggestedSupporters() {
  const { actions } = useStore();
  const { data, error } = useSidebar();
  const [all, setAll] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const list = (data?.suggested ?? []).slice(0, all ? 7 : 3);

  const toggle = async (code: string) => {
    const next = !on[code];
    setOn((s) => ({ ...s, [code]: next }));
    try {
      await api(`/api/users/${code}/support`, { method: next ? "POST" : "DELETE" });
      actions.toast(next ? `You're now supporting #${code}` : `You stopped supporting #${code}`, next ? "success" : "info");
      revalidate("/api/me", "/api/users");
    } catch (e) {
      setOn((s) => ({ ...s, [code]: !next }));
      actions.toast((e as Error).message, "error");
    }
  };

  return (
    <section className="card overflow-hidden">
      <CardTitle icon={Users} title="Suggested Supporters" action={(data?.suggested.length ?? 0) > 3 ? <SeeAll onClick={() => setAll((a) => !a)} label={all ? "Show less" : "See All"} /> : undefined} />
      {!data && !error ? (
        <Skeleton />
      ) : error ? (
        <Empty>Couldn't load suggestions.</Empty>
      ) : list.length === 0 ? (
        <Empty>No suggestions yet. As more people join and share, people with similar interests will appear here.</Empty>
      ) : (
        <ul className="space-y-0.5 px-2 pb-2.5">
          {list.map((u) => (
            <li key={u.code} className="anim-fade flex items-center gap-3 rounded-[10px] px-2 py-1.5">
              <Avatar code={u.code} src={u.avatarUrl} size="md" link online={u.online} />
              <Link href={`/profile/${u.code}`} className="min-w-0 flex-1">
                <span className="code-font block text-[0.86rem] font-semibold text-ink hover:underline">#{u.code}</span>
                <span className="block truncate text-[0.74rem] text-muted">{u.headline || "RUHIZ member"}</span>
              </Link>
              <button onClick={() => toggle(u.code)} data-on={!!on[u.code]} className="btn btn-support btn-sm min-w-[5.6rem] shrink-0" aria-pressed={!!on[u.code]}>
                {on[u.code] ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
                {on[u.code] ? "Supporting" : "Support"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PopularPosts() {
  const { data, error } = useSidebar();
  return (
    <section className="card overflow-hidden">
      <CardTitle icon={ChartNoAxesColumn} iconClass="text-brand" title="Popular Posts" action={<SeeAll href="/home?filter=trending" />} />
      {!data && !error ? (
        <Skeleton />
      ) : error ? (
        <Empty>Couldn't load posts.</Empty>
      ) : data!.popular.length === 0 ? (
        <Empty>Nothing popular yet. Posts that people support and discuss will show up here.</Empty>
      ) : (
        <ul className="px-2 pb-2.5">
          {data!.popular.map((p) => (
            <li key={p.id}>
              <Link href={`/post/${p.id}`} className="group flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-white/[.04]">
                {p.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10" loading="lazy" />
                ) : (
                  <Avatar code={p.authorCode} size="lg" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.86rem] font-semibold text-ink group-hover:text-white">{p.title}</span>
                  <span className="block truncate text-[0.74rem] text-muted">
                    <span className="code-font">{p.authorCode ? `#${p.authorCode}` : "Anonymous"}</span> • {formatCount(p.supports)} supports • {p.discussions} comments
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function UnsolvedNearby() {
  const { actions } = useStore();
  const { data } = useSidebar();
  if (!data) return null;
  return (
    <section className="card overflow-hidden">
      <CardTitle icon={MapPin} title="Problems near you" action={data.location ? <SeeAll href="/home?filter=nearby" label="View" /> : undefined} />
      {!data.location ? (
        <Empty>
          Add your area in{" "}
          <button onClick={() => actions.openModal({ type: "editProfile" })} className="font-semibold text-brand-ink hover:text-white">
            your profile
          </button>{" "}
          to see open problems near you.
        </Empty>
      ) : data.nearby.length === 0 ? (
        <Empty>No open problems tagged in {data.location} yet.</Empty>
      ) : (
        <ul className="space-y-2 px-3 pb-3">
          {data.nearby.map((p) => (
            <li key={p.id} className="rounded-[10px] border border-line bg-black/15 p-2.5">
              <Link href={`/post/${p.id}`} className="line-clamp-2 text-[0.84rem] font-semibold leading-snug text-ink hover:text-white">
                {p.title}
              </Link>
              <div className="mt-2 flex items-center justify-between gap-2">
                <StatusPill status={p.status} />
                <button onClick={() => actions.openModal({ type: "help", post: { id: p.id, title: p.title, text: "" } })} className="inline-flex items-center gap-1 text-[0.76rem] font-semibold text-rose-300 hover:text-rose-200">
                  <HandHelping className="size-3.5" /> I Can Help
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RightPanelContent() {
  return (
    <div className="space-y-4">
      <TrendingTopics />
      <SuggestedSupporters />
      <PopularPosts />
      <UnsolvedNearby />
      <p className="px-2 pb-4 text-[0.72rem] leading-relaxed text-faint">RUHIZ is designed to move conversations toward outcomes, not to maximise scrolling.</p>
    </div>
  );
}

const RAIL: { icon: LucideIcon; label: string; cls: string }[] = [
  { icon: Flame, label: "Trending Topics", cls: "text-accent" },
  { icon: Users, label: "Suggested Supporters", cls: "text-accent" },
  { icon: ChartNoAxesColumn, label: "Popular Posts", cls: "text-brand" },
  { icon: MapPin, label: "Problems near you", cls: "text-accent" },
];

export function RightSidebar({ collapsed }: { collapsed: boolean }) {
  const { actions } = useStore();
  return (
    <aside
      aria-label="Trending and suggestions"
      className={cn("fixed bottom-0 right-0 top-16 z-20 transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]", collapsed ? "overflow-visible" : "overflow-hidden")}
      style={{ width: "var(--rw)" }}
    >
      {collapsed ? (
        <div className="flex h-full flex-col items-center gap-2 border-l border-line bg-[var(--panel)]/60 pt-4">
          <button onClick={actions.toggleRight} className="has-tip relative mb-2 grid size-9 place-items-center rounded-full border border-line-strong text-ink-2 hover:bg-white/5 hover:text-white" aria-label="Show panel">
            <ChevronsLeft className="size-4.5" />
            <span className="tooltip right-full top-1.5 mr-2">Show panel</span>
          </button>
          {RAIL.map(({ icon: Icon, label, cls }) => (
            <button key={label} onClick={actions.toggleRight} className="has-tip relative grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-white/5" aria-label={label}>
              <Icon className={cn("size-5", cls)} />
              <span className="tooltip right-full top-2 mr-2">{label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="no-scrollbar h-full w-[330px] overflow-y-auto py-5 pl-1 pr-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="eyebrow">For you</span>
            <button onClick={actions.toggleRight} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.76rem] font-semibold text-muted hover:bg-white/5 hover:text-ink" aria-label="Collapse panel">
              Hide <ChevronsRight className="size-3.5" />
            </button>
          </div>
          <RightPanelContent />
        </div>
      )}
    </aside>
  );
}
