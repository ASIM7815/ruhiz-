"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWRInfinite from "swr/infinite";
import { Check, Image as ImageIcon, LayoutGrid, Lightbulb, Loader2, PenLine, RotateCcw, Shuffle, Video, type LucideIcon } from "lucide-react";
import type { CategoryId, ExplorePage, ExploreType } from "@/lib/types";
import { CATEGORIES } from "@/lib/meta";
import { cn, formatCount } from "@/lib/utils";
import { useStore } from "@/store/store";
import { PostCard, PostSkeleton } from "@/components/feed/PostCard";
import { EmptyState } from "@/components/ui/Primitives";

const TYPES: { id: ExploreType; label: string; icon: LucideIcon; noun: string }[] = [
  { id: "all", label: "All", icon: LayoutGrid, noun: "posts" },
  { id: "video", label: "Videos", icon: Video, noun: "videos" },
  { id: "photo", label: "Photos", icon: ImageIcon, noun: "photos" },
  { id: "thought", label: "Thoughts", icon: PenLine, noun: "thoughts" },
];
const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

/** A fresh random seed per visit, so a refresh shows a different mix. */
const newSeed = () => (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0) || 1;

function Explore() {
  const { actions } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const rawCat = params.get("category");
  const category = rawCat && rawCat in CATEGORIES ? (rawCat as CategoryId) : null;
  const rawType = params.get("type");
  const type: ExploreType = TYPES.some((t) => t.id === rawType) ? (rawType as ExploreType) : "all";
  const [seed, setSeed] = useState(newSeed);
  const [removed, setRemoved] = useState<string[]>([]);

  const base = `/api/explore?type=${type}&seed=${seed}${category ? `&category=${category}` : ""}`;
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<ExplorePage>(
    (i, prev: ExplorePage | null) => (i === 0 ? base : prev?.nextCursor ? `${base}&cursor=${encodeURIComponent(prev.nextCursor)}` : null),
    { revalidateFirstPage: false, revalidateOnFocus: false },
  );

  const posts = useMemo(() => {
    const seen = new Set<string>();
    return (data ?? []).flatMap((p) => p.posts).filter((p) => !removed.includes(p.id) && !seen.has(p.id) && (seen.add(p.id), true));
  }, [data, removed]);
  const counts = data?.[0]?.categories;
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);
  const loadingMore = isValidating && size > (data?.length ?? 0);
  const typeMeta = TYPES.find((t) => t.id === type)!;

  const setParam = (k: "category" | "type", v: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    sp.delete("tab"); // old Explore tabs no longer exist
    router.replace(`/explore${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };
  const total = (counts ?? []).reduce((a, c) => a + c.posts, 0);

  return (
    <div className="mx-auto max-w-[980px] space-y-5">
      <section className="card relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <p className="eyebrow !text-brand-ink">Explore</p>
          <h1 className="section-title mt-1.5 text-[1.6rem] leading-tight sm:text-[2rem]">Discover by topic</h1>
          <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-ink-2">Pick a category, choose what you want to see, and get a fresh, random mix of what members have shared. Shuffle any time for something new.</p>
        </div>
      </section>

      <section aria-label="Content type" className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Content type" className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-black/20 p-1">
          {TYPES.map((t) => {
            const on = t.id === type;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setParam("type", t.id === "all" ? null : t.id)}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.86rem] font-semibold transition-colors", on ? "bg-brand text-white shadow" : "text-ink-2 hover:bg-white/[.06] hover:text-ink")}
              >
                <Icon className="size-4" aria-hidden /> {t.label}
              </button>
            );
          })}
        </div>
        <button onClick={() => (setSeed(newSeed()), setRemoved([]))} className="btn btn-outline btn-sm ml-auto" aria-label="Shuffle results">
          <Shuffle className="size-4" /> Shuffle
        </button>
      </section>

      <section aria-label="Categories">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-4">
          <button
            onClick={() => setParam("category", null)}
            aria-pressed={!category}
            className={cn("card card-hover flex shrink-0 items-center gap-3 p-3 text-left", !category && "!border-brand/60 !bg-brand/[.12]")}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white/[.04]">
              <LayoutGrid className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[0.86rem] font-semibold text-ink">All categories {!category && <Check className="size-3.5 text-brand-ink" />}</span>
              {counts && <span className="block text-[0.72rem] text-muted">{formatCount(total)} {typeMeta.noun}</span>}
            </span>
          </button>
          {CATEGORY_IDS.map((id) => {
            const c = CATEGORIES[id];
            const Icon = c.icon;
            const on = category === id;
            const n = counts?.find((x) => x.id === id)?.posts;
            return (
              <button
                key={id}
                onClick={() => setParam("category", on ? null : id)}
                aria-pressed={on}
                className={cn("card card-hover flex shrink-0 items-center gap-3 p-3 text-left", on && "!border-brand/60 !bg-brand/[.12]")}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border", c.tone.pill)}>
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 whitespace-nowrap text-[0.86rem] font-semibold text-ink">
                    {c.label} {on && <Check className="size-3.5 text-brand-ink" />}
                  </span>
                  <span className="block whitespace-nowrap text-[0.72rem] text-muted">{n === undefined ? c.blurb : `${formatCount(n)} ${n === 1 ? typeMeta.noun.replace(/s$/, "") : typeMeta.noun}`}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="space-y-4" aria-live="polite" aria-busy={isLoading}>
        <h2 className="section-title px-1 text-[1rem]">
          {category ? CATEGORIES[category].label : "All categories"} · {typeMeta.label}
        </h2>
        {isLoading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : error && !posts.length ? (
          <EmptyState icon={RotateCcw} title="Couldn't load Explore" text={(error as Error).message} action={<button onClick={() => mutate()} className="btn btn-blue">Try again</button>} />
        ) : !posts.length ? (
          <EmptyState
            icon={Lightbulb}
            title={`No ${typeMeta.noun} ${category ? `in ${CATEGORIES[category].label}` : ""} yet`}
            text="Nothing matches these filters yet. Try another category or content type, or share the first one."
            action={
              <button onClick={() => actions.openModal({ type: "composer", kind: type === "all" ? "thought" : type })} className="btn btn-red">
                Create a post
              </button>
            }
          />
        ) : (
          <>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onRemoved={(id) => setRemoved((r) => [...r, id])} />
            ))}
            {hasMore ? (
              <div className="flex justify-center">
                <button onClick={() => setSize(size + 1)} disabled={loadingMore} className="btn btn-outline">
                  {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null} {loadingMore ? "Loading…" : "Show more"}
                </button>
              </div>
            ) : (
              <p className="py-2 text-center text-[0.8rem] text-faint">You've seen everything here. Shuffle for a new order.</p>
            )}
            {error && <p className="text-center text-[0.8rem] text-rose-300">Couldn't load more: {(error as Error).message}</p>}
          </>
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
