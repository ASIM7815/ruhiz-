"use client";

import { Check, Milestone, PencilLine } from "lucide-react";
import type { Post, ProblemStatus } from "@/lib/types";
import { STATUS_META, STATUS_ORDER } from "@/lib/meta";
import { cn, timeAgo } from "@/lib/utils";
import { useStore } from "@/store/store";

/** Five-segment progress bar: Unsolved → Discussion → Solutions → Implementing → Solved. */
export function LifecycleMini({ status, className }: { status: ProblemStatus; className?: string }) {
  const idx = STATUS_ORDER.indexOf(status);
  const solved = status === "solved";
  return (
    <div className={cn("flex items-center gap-1", className)} aria-label={`Problem stage: ${STATUS_META[status].label}`}>
      {STATUS_ORDER.map((s, i) => (
        <span
          key={s}
          title={STATUS_META[s].label}
          className={cn("h-1 flex-1 rounded-full transition-colors", i <= idx ? (solved ? "bg-emerald-400" : i === idx ? "bg-accent shadow-[0_0_8px_rgba(255,46,85,.6)]" : "bg-brand") : "bg-white/10")}
        />
      ))}
    </div>
  );
}

/** Full journey tracker with the timeline of updates. */
export function LifecycleTracker({ post }: { post: Post }) {
  const { actions } = useStore();
  if (!post.status) return null;
  const idx = STATUS_ORDER.indexOf(post.status);
  const canEdit = post.viewer.isOwner || post.viewer.canModerate;

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="journey">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="journey" className="section-title flex items-center gap-2 text-[1rem]">
            <Milestone className="size-4.5 text-accent" /> Problem journey
          </h2>
          <p className="mt-0.5 text-[0.8rem] text-muted">{STATUS_META[post.status].desc}</p>
        </div>
        {canEdit && (
          <button onClick={() => actions.openModal({ type: "status", post })} className="btn btn-outline btn-sm">
            <PencilLine className="size-3.5" /> Update status
          </button>
        )}
      </div>

      <ol className="grid grid-cols-5 gap-1">
        {STATUS_ORDER.map((s, i) => {
          const m = STATUS_META[s];
          const Icon = m.icon;
          const done = i < idx || post.status === "solved";
          const current = i === idx;
          return (
            <li key={s} className="relative flex flex-col items-center text-center">
              {i > 0 && <span className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", i <= idx ? "bg-brand" : "bg-white/10")} aria-hidden />}
              <span
                className={cn(
                  "relative z-10 grid size-8 place-items-center rounded-full border text-white transition-all",
                  current && post.status !== "solved" && "border-accent bg-accent shadow-[0_0_16px_rgba(255,46,85,.55)]",
                  current && post.status === "solved" && "border-emerald-400 bg-emerald-500 shadow-[0_0_16px_rgba(52,211,153,.5)]",
                  !current && done && "border-brand bg-brand",
                  !current && !done && "border-line-strong bg-elev text-faint",
                )}
              >
                {done && !current ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
              </span>
              <span className={cn("mt-2 text-[0.7rem] font-semibold leading-tight sm:text-[0.76rem]", current ? "text-ink" : done ? "text-ink-2" : "text-faint")}>{m.label}</span>
            </li>
          );
        })}
      </ol>

      {post.outcome && (
        <div className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-500/[.08] p-3.5">
          <p className="eyebrow !text-emerald-300">Documented outcome</p>
          <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-2">{post.outcome}</p>
        </div>
      )}

      {post.updates?.length ? (
        <ol className="mt-5 space-y-3 border-l border-line pl-4">
          {[...post.updates].reverse().map((u, i) => (
            <li key={i} className="relative">
              <span className={cn("absolute -left-[1.32rem] top-1.5 size-2.5 rounded-full ring-4 ring-[var(--card-solid)]", STATUS_META[u.status].tone.dot)} />
              <p className="text-[0.84rem] leading-snug text-ink-2">
                <span className={cn("font-semibold", STATUS_META[u.status].tone.text)}>{STATUS_META[u.status].label}</span> · {u.text}
              </p>
              <p className="text-[0.72rem] text-faint">{timeAgo(u.at)}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
