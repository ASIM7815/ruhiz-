"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Check, ChevronRight, Clock, Flame, Lightbulb, MessagesSquare, RotateCcw, Users, X } from "lucide-react";
import type { CategoryId, Post, Solution } from "@/lib/types";
import { CATEGORIES } from "@/lib/meta";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import { useStore } from "@/store/store";
import { PostCard, PostSkeleton } from "@/components/feed/PostCard";
import { SolutionCard } from "@/components/solution/SolutionCard";
import { CategoryPill, StatusPill } from "@/components/ui/Badges";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, Tabs } from "@/components/ui/Primitives";
import { LifecycleMini } from "@/components/problem/Lifecycle";

type Tab = "trending" | "recent" | "solutions" | "discussions";
interface ExploreData {
  stats: { open_problems: number; solutions: number; help_offers: number; solved: number };
  categories: { id: CategoryId; posts: number; open: number }[];
  posts: Post[];
  solutions: Solution[];
  recentCounts: Record<string, number>;
}

const LOOP = ["Problem", "Experience", "Evidence", "Discussion", "Debate", "Solution", "Contribution", "Action", "Outcome"];

function ProblemRow({ p, rank }: { p: Post; rank?: number }) {
  const thumb = p.media.find((m) => m.type === "image");
  return (
    <Link href={`/post/${p.id}`} className="card card-hover group flex gap-4 p-4">
      {rank !== undefined && <span className="font-display text-2xl font-extrabold text-faint group-hover:text-accent">{String(rank).padStart(2, "0")}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPill id={p.category} link={false} />
          {p.status && <StatusPill status={p.status} />}
          <span className="text-[0.74rem] text-faint">{timeAgo(p.createdAt)}</span>
        </div>
        <h3 className="section-title mt-2 text-[0.98rem] leading-snug group-hover:text-white">{p.title ?? p.text.slice(0, 90)}</h3>
        <p className="mt-1 line-clamp-2 text-[0.84rem] text-muted">{p.text}</p>
        {p.status && <LifecycleMini status={p.status} className="mt-3 max-w-xs" />}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.76rem] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Avatar code={p.author.code} src={p.author.avatarUrl} size="xs" /> <span className="code-font">#{p.author.code}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <MessagesSquare className="size-3.5" /> {p.counts.discussions} contributions
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {p.counts.helpers} offers of help
          </span>
          <span>{formatCount(p.counts.supports)} supports</span>
        </div>
      </div>
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb.url} alt="" className="hidden size-24 shrink-0 rounded-xl object-cover ring-1 ring-white/10 sm:block" loading="lazy" />
      )}
    </Link>
  );
}

function Explore() {
  const { actions } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const category = params.get("category") as CategoryId | null;
  const tab = ((params.get("tab") as Tab) || "trending") as Tab;
  const { data, error, isLoading, mutate } = useSWR<ExploreData>(`/api/explore?tab=${tab}${category ? `&category=${category}` : ""}`);

  const setParam = (k: string, v: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`/explore${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };
  const catCount = (id: CategoryId) => data?.categories.find((c) => c.id === id);
  const empty = (
    <EmptyState
      icon={Lightbulb}
      title={category ? `Nothing in ${CATEGORIES[category].label} yet` : "Nothing here yet"}
      text="Problems, solutions and discussions appear here as members share them. Raise the first one."
      action={
        <button onClick={() => actions.openModal({ type: "composer", kind: "thought" })} className="btn btn-red">
          Raise a problem
        </button>
      }
    />
  );

  return (
    <div className="mx-auto max-w-[980px] space-y-5">
      <section className="card relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <p className="eyebrow !text-brand-ink">Explore</p>
          <h1 className="section-title mt-1.5 text-[1.6rem] leading-tight sm:text-[2rem]">Discover problems worth solving</h1>
          <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-ink-2">Every problem on RUHIZ moves through a journey. Find one you understand, bring what you know, and help it reach an outcome.</p>
          <ol className="no-scrollbar mt-5 flex items-center gap-1 overflow-x-auto pb-1">
            {LOOP.map((s, i) => (
              <li key={s} className="flex shrink-0 items-center gap-1">
                <span className={cn("rounded-md border px-2 py-1 text-[0.7rem] font-bold uppercase tracking-wider", i === 0 ? "border-accent/40 bg-accent/10 text-rose-200" : i === LOOP.length - 1 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-line bg-black/20 text-ink-2")}>{s}</span>
                {i < LOOP.length - 1 && <ChevronRight className="size-3.5 text-faint" />}
              </li>
            ))}
          </ol>
          {data && (
            <div className="mt-5 flex flex-wrap gap-6 text-[0.84rem]">
              <span>
                <b className="text-lg text-ink">{data.stats.open_problems}</b> <span className="text-muted">open problems</span>
              </span>
              <span>
                <b className="text-lg text-ink">{data.stats.solutions}</b> <span className="text-muted">Solution Cards</span>
              </span>
              <span>
                <b className="text-lg text-ink">{data.stats.help_offers}</b> <span className="text-muted">offers of help</span>
              </span>
              <span>
                <b className="text-lg text-emerald-300">{data.stats.solved}</b> <span className="text-muted">solved</span>
              </span>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="section-title text-[1rem]">Categories</h2>
          {category && (
            <button onClick={() => setParam("category", null)} className="btn btn-ghost btn-sm">
              <X className="size-3.5" /> Clear {CATEGORIES[category].label}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {(Object.keys(CATEGORIES) as CategoryId[]).map((id) => {
            const c = CATEGORIES[id];
            const Icon = c.icon;
            const on = category === id;
            const n = catCount(id);
            return (
              <button key={id} onClick={() => setParam("category", on ? null : id)} aria-pressed={on} className={cn("card card-hover flex items-start gap-3 p-3 text-left", on && "!border-brand/60 !bg-brand/[.12]")}>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border", c.tone.pill)}>
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[0.86rem] font-semibold text-ink">
                    {c.label} {on && <Check className="size-3.5 text-brand-ink" />}
                  </span>
                  <span className="block text-[0.72rem] text-muted">
                    {n ? `${formatCount(n.posts)} ${n.posts === 1 ? "post" : "posts"}${n.open ? ` · ${n.open} open` : ""}` : c.blurb}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <Tabs<Tab>
        value={tab}
        onChange={(t) => setParam("tab", t === "trending" ? null : t)}
        tabs={[
          { id: "trending", label: "Trending problems", icon: Flame },
          { id: "recent", label: "Recent problems", icon: Clock },
          { id: "solutions", label: "Popular solutions", icon: Lightbulb },
          { id: "discussions", label: "Active discussions", icon: MessagesSquare },
        ]}
      />

      <div className="space-y-3">
        {isLoading ? (
          <PostSkeleton />
        ) : error ? (
          <EmptyState icon={RotateCcw} title="Couldn't load" text={error.message} action={<button onClick={() => mutate()} className="btn btn-blue">Try again</button>} />
        ) : tab === "solutions" ? (
          data!.solutions.length ? data!.solutions.map((s) => <SolutionCard key={s.id} solution={s} />) : empty
        ) : !data!.posts.length ? (
          empty
        ) : tab === "discussions" ? (
          data!.posts.map((p) => (
            <div key={p.id} className="relative">
              <span className="badge absolute right-14 top-5 z-10 border-amber-400/30 bg-amber-500/10 text-amber-200">{data!.recentCounts[p.id]} new in 48h</span>
              <PostCard post={p} />
            </div>
          ))
        ) : (
          data!.posts.map((p, i) => <ProblemRow key={p.id} p={p} rank={tab === "trending" ? i + 1 : undefined} />)
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}
