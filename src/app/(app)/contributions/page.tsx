"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { FileText, HandHelping, Lightbulb, MessagesSquare, PenLine, RotateCcw, Target } from "lucide-react";
import type { Contribution, HelpOffer, Post, Solution } from "@/lib/types";
import { useStore } from "@/store/store";
import { EmptyState, Tabs } from "@/components/ui/Primitives";
import { PostCard, PostSkeleton } from "@/components/feed/PostCard";
import { SolutionCard } from "@/components/solution/SolutionCard";
import { ContributionList } from "@/components/profile/ContributionList";
import { HelpOfferRow } from "@/components/problem/HelpPanel";

type Tab = "problems" | "solutions" | "discussions" | "help" | "posts";
type Activity = { problems: Post[]; posts: Post[]; solutions: Solution[]; contributions: Contribution[]; help: HelpOffer[] };

export default function ContributionsPage() {
  const { actions } = useStore();
  const [tab, setTab] = useState<Tab>("discussions");
  const { data, error, isLoading, mutate } = useSWR<Activity>("/api/me/activity");

  const stats = data
    ? [
        { label: "Problems raised", value: data.problems.length, icon: Target, cls: "text-rose-300" },
        { label: "Solutions contributed", value: data.solutions.length, icon: Lightbulb, cls: "text-brand-ink" },
        { label: "Discussion contributions", value: data.contributions.length, icon: MessagesSquare, cls: "text-amber-300" },
        { label: "Offers of help", value: data.help.length, icon: HandHelping, cls: "text-violet-300" },
        { label: "Marked helpful", value: data.contributions.reduce((n, c) => n + c.helpful, 0), icon: FileText, cls: "text-emerald-300" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[860px] space-y-4">
      <div>
        <h1 className="section-title text-[1.5rem]">My Contributions</h1>
        <p className="mt-1 text-[0.9rem] text-muted">Everything you've brought to RUHIZ: problems, solutions, discussion and help.</p>
      </div>

      {isLoading ? (
        <PostSkeleton />
      ) : error || !data ? (
        <EmptyState icon={RotateCcw} title="Couldn't load your activity" text={error?.message ?? ""} action={<button onClick={() => mutate()} className="btn btn-blue">Try again</button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {stats.map(({ label, value, icon: Icon, cls }) => (
              <div key={label} className="card p-3.5">
                <Icon className={`size-4.5 ${cls}`} />
                <p className="mt-2 text-[1.4rem] font-bold tabular-nums text-ink">{value}</p>
                <p className="text-[0.74rem] leading-tight text-muted">{label}</p>
              </div>
            ))}
          </div>

          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "discussions", label: "Discussions", count: data.contributions.length },
              { id: "solutions", label: "Solutions", count: data.solutions.length },
              { id: "help", label: "Help offered", count: data.help.length },
              { id: "problems", label: "Problems", count: data.problems.length },
              { id: "posts", label: "Posts", count: data.posts.length },
            ]}
          />

          <div className="space-y-3">
            {tab === "discussions" && <ContributionList items={data.contributions} empty="You haven't joined a discussion yet. Open any problem and share an experience, evidence or a question." />}
            {tab === "solutions" &&
              (data.solutions.length ? (
                data.solutions.map((s) => <SolutionCard key={s.id} solution={s} compact />)
              ) : (
                <EmptyState icon={Lightbulb} title="No solutions yet" text="Propose a Solution Card on a problem you understand, or join a role on someone else's." action={<Link href="/explore" className="btn btn-blue">Find problems</Link>} />
              ))}
            {tab === "help" &&
              (data.help.length ? (
                data.help.map((h) => (
                  <div key={h.id} className="card p-2">
                    <Link href={`/post/${h.postId}#help`} className="block px-2.5 pt-1.5 text-[0.8rem] text-muted hover:text-ink-2">
                      On: <span className="font-medium text-ink-2">{h.postTitle}</span>
                    </Link>
                    <HelpOfferRow offer={h} onWithdrawn={() => mutate()} />
                  </div>
                ))
              ) : (
                <EmptyState icon={HandHelping} title="You haven't offered help yet" text="Open any problem and choose I Can Help." action={<Link href="/home?filter=unsolved" className="btn btn-blue">See unsolved problems</Link>} />
              ))}
            {tab === "problems" &&
              (data.problems.length ? (
                data.problems.map((p) => <PostCard key={p.id} post={p} onRemoved={() => mutate()} />)
              ) : (
                <EmptyState
                  icon={Target}
                  title="No problems raised"
                  text="Facing something real? Bring it to people who can help."
                  action={
                    <button onClick={() => actions.openModal({ type: "composer", kind: "thought" })} className="btn btn-red">
                      <PenLine className="size-4" /> Raise a problem
                    </button>
                  }
                />
              ))}
            {tab === "posts" &&
              (data.posts.length ? (
                data.posts.map((p) => <PostCard key={p.id} post={p} onRemoved={() => mutate()} />)
              ) : (
                <EmptyState icon={PenLine} title="No posts yet" text="Share a photo, video or thought." action={<button onClick={() => actions.openModal({ type: "composer", kind: "photo" })} className="btn btn-red">Create a post</button>} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
