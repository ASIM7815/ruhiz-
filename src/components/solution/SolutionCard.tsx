"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Clock, HandCoins, HeartHandshake, Lightbulb, MessagesSquare, Package, Target, Users } from "lucide-react";
import type { Solution } from "@/lib/types";
import { api, revalidate } from "@/lib/api";
import { cn, formatCount, formatINR } from "@/lib/utils";
import { useStore } from "@/store/store";
import { StagePill } from "@/components/ui/Badges";
import { Progress } from "@/components/ui/Primitives";
import { UserCode } from "@/components/ui/UserCode";

function Cell({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-line bg-black/15 p-3">
      <p className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-faint">
        <Icon className="size-3.5" /> {label}
      </p>
      <div className="mt-1.5 text-[0.84rem] leading-snug text-ink-2">{children}</div>
    </div>
  );
}

/** Hook for optimistic support/save toggles on a solution. */
export function useSolutionToggles(initial: Solution) {
  const { actions } = useStore();
  const [s, setS] = useState(initial);
  useEffect(() => setS(initial), [initial]);
  const toggle = async (action: "support" | "save") => {
    const key = action === "support" ? "supportedByMe" : "savedByMe";
    const on = !s[key];
    const before = s;
    setS((x) => ({ ...x, [key]: on, supports: action === "support" ? x.supports + (on ? 1 : -1) : x.supports }));
    try {
      const next = await api<Solution>(`/api/solutions/${s.id}/${action}`, { method: on ? "POST" : "DELETE" });
      setS(next);
      if (action === "save") {
        actions.toast(on ? "Saved to your collection" : "Removed from Saved", on ? "success" : "info");
        revalidate("/api/saved");
      }
    } catch (e) {
      setS(before);
      actions.toast((e as Error).message, "error");
    }
  };
  return { s, setS, toggle };
}

/** Solution Card: the structured unit that turns discussion into an actionable plan. */
export function SolutionCard({ solution, compact, showProblem = true }: { solution: Solution; compact?: boolean; showProblem?: boolean }) {
  const { s, toggle } = useSolutionToggles(solution);
  const pct = s.funding.needed ? (s.funding.raised / s.funding.needed) * 100 : 100;
  const filled = s.skills.reduce((n, k) => n + Math.min(k.filled, k.needed), 0);
  const needed = s.skills.reduce((n, k) => n + k.needed, 0);

  return (
    <article className="card card-hover relative overflow-hidden">
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand to-brand-2" aria-hidden />
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge border-blue-400/30 bg-blue-500/12 text-blue-200">
            <Lightbulb className="size-3" /> Solution Card
          </span>
          <StagePill stage={s.stage} />
          <span className="ml-auto flex items-center gap-1.5 text-[0.76rem] text-muted">
            by <UserCode code={s.author.code} size="xs" verified={s.author.verifiedProfessional} />
          </span>
        </div>

        {showProblem && s.problem && (
          <Link href={`/post/${s.problem.id}`} className="mt-3 flex items-center gap-1.5 text-[0.78rem] text-muted hover:text-ink-2">
            <Target className="size-3.5 shrink-0 text-accent" />
            <span className="truncate">
              Addresses: <span className="font-medium text-ink-2">{s.problem.title}</span>
            </span>
          </Link>
        )}

        <Link href={`/solution/${s.id}`}>
          <h3 className="section-title mt-2 text-[1.02rem] leading-snug hover:text-white">{s.title}</h3>
        </Link>
        <p className={cn("mt-1.5 text-[0.86rem] leading-relaxed text-ink-2", compact && "line-clamp-2")}>{s.summary}</p>

        {!compact && (
          <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
            <Cell icon={Package} label="Resources required">
              {s.resources.length ? (
                <>
                  {s.resources.slice(0, 3).join(" · ")}
                  {s.resources.length > 3 && <span className="text-faint"> +{s.resources.length - 3} more</span>}
                </>
              ) : (
                <span className="text-faint">None listed</span>
              )}
            </Cell>
            <Cell icon={HandCoins} label="Funding pledged">
              {s.funding.needed ? (
                <>
                  <span className="font-semibold text-ink">{formatINR(s.funding.raised)}</span> of {formatINR(s.funding.needed)}
                  <Progress value={pct} className="mt-2" tone={pct >= 100 ? "green" : "blue"} />
                </>
              ) : (
                "No funding needed"
              )}
            </Cell>
            <Cell icon={Users} label="People & skills">
              {needed ? (
                <>
                  <span className="font-semibold text-ink">{filled}</span> of {needed} roles filled · {s.skills.filter((k) => k.filled < k.needed).length} open
                </>
              ) : (
                <span className="text-faint">No roles listed</span>
              )}
            </Cell>
            <Cell icon={Clock} label="Estimated time">
              {s.timeline || <span className="text-faint">Not estimated</span>}
            </Cell>
            <div className="sm:col-span-2">
              <Cell icon={Target} label="Expected outcome">
                {s.outcome ?? s.expectedOutcome}
              </Cell>
            </div>
          </div>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button onClick={() => toggle("support")} data-on={s.supportedByMe} aria-pressed={s.supportedByMe} className="btn btn-support btn-sm">
            <HeartHandshake className="size-4" /> {s.supportedByMe ? "Supported" : "Support"} · {formatCount(s.supports)}
          </button>
          <Link href={`/solution/${s.id}#discussion`} className="btn btn-outline btn-sm">
            <MessagesSquare className="size-4" /> Discuss
          </Link>
          <button onClick={() => toggle("save")} aria-pressed={s.savedByMe} className={cn("btn btn-ghost btn-icon btn-sm", s.savedByMe && "text-brand-ink")} aria-label={s.savedByMe ? "Unsave" : "Save"}>
            <Bookmark className={cn("size-4", s.savedByMe && "fill-current")} />
          </button>
          <span className="ml-auto hidden text-[0.74rem] text-muted sm:block">{s.contributors.length} contributor{s.contributors.length === 1 ? "" : "s"}</span>
          <Link href={`/solution/${s.id}`} className="btn btn-blue btn-sm">
            View details <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
