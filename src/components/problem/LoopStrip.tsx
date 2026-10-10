"use client";

import { ChevronRight } from "lucide-react";
import type { Contribution, Post, Solution } from "@/lib/types";
import { cn } from "@/lib/utils";

/** PROBLEM → EXPERIENCE → EVIDENCE → DISCUSSION → DEBATE → SOLUTION → CONTRIBUTION → ACTION → OUTCOME, computed from real data. */
export function LoopStrip({ post, contributions, solutions, offers }: { post: Post; contributions: Contribution[]; solutions: Solution[]; offers: number }) {
  const n = (t: string) => contributions.filter((c) => c.type === t).length;
  const acting = solutions.some((s) => s.stage === "implementing" || s.stage === "completed") || post.status === "implementation" || post.status === "solved";

  const steps = [
    { label: "Problem", value: "Raised", on: true },
    { label: "Experience", value: n("experience"), on: n("experience") > 0 },
    { label: "Evidence", value: n("evidence"), on: n("evidence") > 0 },
    { label: "Discussion", value: n("opinion") + n("question") + n("support"), on: contributions.length > 0 },
    { label: "Debate", value: n("counter"), on: n("counter") > 0 },
    { label: "Solution", value: solutions.length + n("solution"), on: solutions.length + n("solution") > 0 },
    { label: "Contribution", value: offers, on: offers > 0 },
    { label: "Action", value: acting ? "Live" : "—", on: acting },
    { label: "Outcome", value: post.status === "solved" ? "Reached" : "—", on: post.status === "solved" },
  ];

  return (
    <div className="card overflow-hidden p-1">
      <ol className="no-scrollbar flex items-stretch overflow-x-auto">
        {steps.map((s, i) => (
          <li key={s.label} className="flex shrink-0 items-center">
            <div className={cn("rounded-[10px] px-3 py-2 text-center", s.on && "bg-brand/[.1]")}>
              <p className={cn("text-[0.64rem] font-bold uppercase tracking-[0.1em]", s.on ? "text-brand-ink" : "text-faint")}>{s.label}</p>
              <p className={cn("mt-0.5 text-[0.88rem] font-bold tabular-nums", s.on ? (s.label === "Outcome" ? "text-emerald-300" : "text-ink") : "text-faint")}>{s.value}</p>
            </div>
            {i < steps.length - 1 && <ChevronRight className={cn("size-3.5 shrink-0", steps[i + 1].on ? "text-accent" : "text-faint/60")} />}
          </li>
        ))}
      </ol>
    </div>
  );
}
