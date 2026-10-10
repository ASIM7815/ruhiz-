"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, FileQuestion, Lightbulb, PenLine, Plus } from "lucide-react";
import type { Contribution, HelpOffer, Post, Solution } from "@/lib/types";
import { useStore } from "@/store/store";
import { PostCard, PostSkeleton } from "@/components/feed/PostCard";
import { LifecycleTracker } from "@/components/problem/Lifecycle";
import { HelpPanel } from "@/components/problem/HelpPanel";
import { contributionsKey, Discussion } from "@/components/problem/Discussion";
import { LoopStrip } from "@/components/problem/LoopStrip";
import { SolutionCard } from "@/components/solution/SolutionCard";
import { EmptyState } from "@/components/ui/Primitives";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actions } = useStore();
  const { data: post, error, isLoading } = useSWR<Post>(`/api/posts/${id}`);
  const isProblem = post?.intent === "problem" && !!post.status;
  const { data: contributions = [] } = useSWR<Contribution[]>(post ? contributionsKey({ kind: "post", id }) : null);
  const { data: solutions = [] } = useSWR<Solution[]>(isProblem ? `/api/solutions?problem=${id}` : null);
  const { data: offers = [] } = useSWR<HelpOffer[]>(isProblem ? `/api/posts/${id}/help` : null);
  const { data: responses = [] } = useSWR<Post[]>(isProblem ? `/api/posts/${id}/responses` : null);

  useEffect(() => {
    if (post && window.location.hash) {
      const el = document.querySelector(window.location.hash);
      window.setTimeout(() => el?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    }
  }, [post]);

  if (isLoading)
    return (
      <div className="mx-auto max-w-[800px]">
        <PostSkeleton />
      </div>
    );

  if (error || !post)
    return (
      <div className="mx-auto max-w-[760px]">
        <EmptyState
          icon={FileQuestion}
          title="This post isn't available"
          text={error?.status === 404 || !error ? "It may have been deleted, or the link is incorrect." : error.message}
          action={
            <Link href="/home" className="btn btn-blue">
              Back to Home
            </Link>
          }
        />
      </div>
    );

  const propose = () => actions.openModal({ type: "propose", problem: post });

  return (
    <div className="mx-auto max-w-[800px] space-y-4">
      <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))} className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="size-4" /> Back
      </button>

      <PostCard post={post} detail />

      {isProblem && (
        <>
          <LoopStrip post={post} contributions={contributions} solutions={solutions} offers={offers.length} />
          <LifecycleTracker post={post} />
          <HelpPanel post={post} />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 className="section-title flex items-center gap-2 text-[1rem]">
                <Lightbulb className="size-4.5 text-brand-ink" /> Proposed solutions
                <span className="rounded-md bg-white/5 px-1.5 text-[0.76rem] font-semibold text-muted">{solutions.length}</span>
              </h2>
              {post.status !== "solved" && (
                <div className="flex gap-2">
                  <button onClick={() => actions.openModal({ type: "composer", kind: "photo", addresses: { id: post.id, title: post.title ?? post.text.slice(0, 80) } })} className="btn btn-outline btn-sm">
                    <PenLine className="size-4" /> Post a response
                  </button>
                  <button onClick={propose} className="btn btn-blue btn-sm">
                    <Plus className="size-4" /> Propose Solution
                  </button>
                </div>
              )}
            </div>
            {solutions.length ? (
              solutions.map((s) => <SolutionCard key={s.id} solution={s} showProblem={false} />)
            ) : (
              <div className="card p-6 text-center text-[0.86rem] text-muted">No Solution Cards yet. Turn the best ideas from the discussion into a concrete plan with resources, funding, people and time.</div>
            )}
          </section>

          {responses.length > 0 && (
            <section className="space-y-3">
              <h2 className="section-title px-1 text-[1rem]">Responses from the community</h2>
              {responses.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </section>
          )}
        </>
      )}

      <Discussion target={{ kind: "post", id: post.id }} onProposeCard={isProblem ? propose : undefined} />
    </div>
  );
}
