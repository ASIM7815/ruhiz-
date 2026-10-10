"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Check, Inbox, Loader2, MapPin, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import type { CategoryId, FeedTab, Post } from "@/lib/types";
import { CATEGORIES } from "@/lib/meta";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";
import { ComposerBar } from "@/components/feed/ComposerBar";
import { PostCard, PostSkeleton } from "@/components/feed/PostCard";
import { EmptyState, Menu } from "@/components/ui/Primitives";

const FILTERS: { id: FeedTab; label: string; hint: string }[] = [
  { id: "for-you", label: "For You", hint: "Ranked by your topics, the people you support, healthy discussion and problems that need help." },
  { id: "latest", label: "Latest", hint: "Everything, newest first. No ranking." },
  { id: "trending", label: "Trending", hint: "The most actively discussed problems and posts right now." },
  { id: "nearby", label: "Nearby", hint: "Problems and posts tagged in your area." },
  { id: "unsolved", label: "Unsolved", hint: "Open problems, most neglected first: fewer offers of help and longer without progress." },
];

type FeedPage = { items: Post[]; hasMore: boolean; needsLocation: boolean };

function Home() {
  const { state, actions } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const filter = (FILTERS.find((f) => f.id === params.get("filter"))?.id ?? "for-you") as FeedTab;
  const [cats, setCats] = useState<CategoryId[]>([]);
  const key = ["feed", filter, cats.join(",")] as const;
  const { data, error, isLoading, mutate } = useSWR<FeedPage>(key, () => api<FeedPage>("/api/feed", { body: { tab: filter, categories: cats, exclude: [] } }), {
    revalidateOnFocus: false,
  });
  const [more, setMore] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);

  useEffect(() => {
    setMore([]);
    setHasMore(Boolean(data?.hasMore));
  }, [data]);

  const posts = [...(data?.items ?? []), ...more].filter((p) => !removed.includes(p.id));
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await api<FeedPage>("/api/feed", { body: { tab: filter, categories: cats, exclude: posts.map((p) => p.id).slice(0, 200) } });
      setMore((m) => [...m, ...page.items]);
      setHasMore(page.hasMore && posts.length + page.items.length < 200);
    } catch (e) {
      actions.toast((e as Error).message, "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const setFilter = (f: FeedTab) => router.replace(f === "for-you" ? "/home" : `/home?filter=${f}`, { scroll: false });
  const hint = FILTERS.find((f) => f.id === filter)!.hint;
  const freed = Number(state.ui.leftCollapsed) + Number(state.ui.rightCollapsed);
  const maxW = ["max-w-[760px]", "max-w-[840px]", "max-w-[920px]"][freed];

  return (
    <div className={cn("mx-auto space-y-4 transition-[max-width] duration-300", maxW)}>
      <ComposerBar />

      <div className="flex items-center gap-2 border-b border-line">
        <div role="tablist" aria-label="Feed filters" className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              data-on={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn("tab-underline h-11 shrink-0 px-3.5 text-[0.88rem] font-semibold transition-colors", filter === f.id ? "text-white" : "text-ink-2/80 hover:text-white")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Menu
          label="Filter by category"
          className="w-64"
          trigger={({ toggle, open }) => (
            <button onClick={toggle} aria-expanded={open} className={cn("btn btn-ghost btn-icon relative", cats.length > 0 && "text-brand-ink")} aria-label="Filter by category">
              <SlidersHorizontal className="size-[1.15rem]" />
              {cats.length > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-accent" />}
            </button>
          )}
        >
          {(close) => (
            <div className="p-1">
              <div className="mb-1.5 flex items-center justify-between px-1.5">
                <span className="eyebrow">Categories</span>
                {cats.length > 0 && (
                  <button onClick={() => setCats([])} className="text-[0.76rem] font-semibold text-brand-ink">
                    Clear
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {(Object.keys(CATEGORIES) as CategoryId[]).map((id) => {
                  const c = CATEGORIES[id];
                  const on = cats.includes(id);
                  const Icon = c.icon;
                  return (
                    <button key={id} onClick={() => setCats((x) => (on ? x.filter((y) => y !== id) : [...x, id]))} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[0.84rem] text-ink-2 hover:bg-white/5">
                      <Icon className={cn("size-4", c.tone.text)} />
                      <span className="flex-1">{c.label}</span>
                      {on && <Check className="size-4 text-brand-ink" />}
                    </button>
                  );
                })}
              </div>
              <button onClick={close} className="btn btn-blue btn-sm mt-2 w-full">
                Done
              </button>
            </div>
          )}
        </Menu>
      </div>

      <p className="flex items-center gap-2 px-1 text-[0.8rem] text-muted">
        <Sparkles className="size-3.5 shrink-0 text-brand-ink" /> {hint}
        {cats.length > 0 && <span className="text-ink-2">· {cats.map((c) => CATEGORIES[c].label).join(", ")}</span>}
      </p>

      {isLoading ? (
        <div className="space-y-4">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : error ? (
        <EmptyState
          icon={RotateCcw}
          title="Couldn't load your feed"
          text={error.message}
          action={
            <button onClick={() => mutate()} className="btn btn-blue">
              Try again
            </button>
          }
        />
      ) : data?.needsLocation ? (
        <EmptyState
          icon={MapPin}
          title="Set your area to see Nearby"
          text="Nearby shows problems and posts tagged in your area. Add your city or neighbourhood to your profile."
          action={
            <button onClick={() => actions.openModal({ type: "editProfile" })} className="btn btn-blue">
              Add my area
            </button>
          }
        />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={cats.length ? "Nothing in these categories yet" : filter === "unsolved" ? "No open problems right now" : "No posts yet"}
          text={
            cats.length
              ? "No posts match these categories. Try others, or be the first to share something here."
              : "RUHIZ is new, and the feed fills up as members share problems, experiences and solutions. Start with something you know or something you're facing."
          }
          action={
            <>
              {cats.length > 0 && (
                <button onClick={() => setCats([])} className="btn btn-outline">
                  Clear filters
                </button>
              )}
              <button onClick={() => actions.openModal({ type: "composer", kind: "thought" })} className="btn btn-red">
                Share something
              </button>
            </>
          }
        />
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onRemoved={(id) => setRemoved((r) => [...r, id])} />
          ))}
          {hasMore ? (
            <div className="flex justify-center py-2">
              <button onClick={loadMore} disabled={loadingMore} className="btn btn-outline">
                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : "Load more"}
              </button>
            </div>
          ) : (
            <p className="py-6 text-center text-[0.8rem] text-faint">You're up to date. RUHIZ doesn't do infinite scroll. Maybe help with one of the problems above.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
