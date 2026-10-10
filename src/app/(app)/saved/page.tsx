"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Bookmark, RotateCcw } from "lucide-react";
import type { Post, Solution } from "@/lib/types";
import { EmptyState, Tabs } from "@/components/ui/Primitives";
import { PostCard, PostSkeleton } from "@/components/feed/PostCard";
import { SolutionCard } from "@/components/solution/SolutionCard";

type Tab = "all" | "problem" | "post" | "solution";
type Item = { kind: "problem" | "post"; post: Post } | { kind: "solution"; solution: Solution };

export default function SavedPage() {
  const [tab, setTab] = useState<Tab>("all");
  const { data, error, isLoading, mutate } = useSWR<Item[]>("/api/saved");
  const items = data ?? [];
  const count = (k: string) => items.filter((i) => i.kind === k).length;
  const shown = items.filter((i) => tab === "all" || i.kind === tab);

  return (
    <div className="mx-auto max-w-[760px] space-y-4">
      <div>
        <h1 className="section-title text-[1.5rem]">Saved</h1>
        <p className="mt-1 text-[0.9rem] text-muted">Problems to follow up on, posts that helped, and solutions you want to back. Only you can see this.</p>
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "all", label: "All", count: items.length },
          { id: "problem", label: "Problems", count: count("problem") },
          { id: "post", label: "Posts", count: count("post") },
          { id: "solution", label: "Solutions", count: count("solution") },
        ]}
      />
      {isLoading ? (
        <PostSkeleton />
      ) : error ? (
        <EmptyState icon={RotateCcw} title="Couldn't load saved items" text={error.message} action={<button onClick={() => mutate()} className="btn btn-blue">Try again</button>} />
      ) : shown.length ? (
        <div className="space-y-4">{shown.map((i) => (i.kind === "solution" ? <SolutionCard key={`s-${i.solution.id}`} solution={i.solution} /> : <PostCard key={`p-${i.post.id}`} post={i.post} onRemoved={() => mutate()} />))}</div>
      ) : (
        <EmptyState icon={Bookmark} title="Nothing saved here" text="Tap the bookmark on any post, problem or Solution Card to keep it here." action={<Link href="/home" className="btn btn-blue">Go to Home</Link>} />
      )}
    </div>
  );
}
