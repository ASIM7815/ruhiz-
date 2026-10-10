"use client";

import Link from "next/link";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import type { CategoryId, ContributionType, IdentityMode, ProblemStatus, SolutionStage } from "@/lib/types";
import { CATEGORIES, CONTRIBUTION_TYPES, STAGE_META, STATUS_META } from "@/lib/meta";
import { cn } from "@/lib/utils";

export function CategoryPill({ id, link = true, className }: { id: CategoryId; link?: boolean; className?: string }) {
  const c = CATEGORIES[id];
  const Icon = c.icon;
  const body = (
    <span className={cn("badge", c.tone.pill, className)}>
      <Icon className="size-3" aria-hidden />
      {c.label}
    </span>
  );
  return link ? (
    <Link href={`/explore?category=${id}`} className="rounded-md hover:brightness-125">
      {body}
    </Link>
  ) : (
    body
  );
}

export function StatusPill({ status, className }: { status: ProblemStatus; className?: string }) {
  const s = STATUS_META[status];
  const Icon = s.icon;
  return (
    <span className={cn("badge", s.tone.pill, className)}>
      <Icon className="size-3" aria-hidden />
      {s.label}
    </span>
  );
}

export function StagePill({ stage, className }: { stage: SolutionStage; className?: string }) {
  const s = STAGE_META[stage];
  return (
    <span className={cn("badge", s.tone.pill, className)}>
      <span className={cn("size-1.5 rounded-full", s.tone.dot)} />
      {s.label}
    </span>
  );
}

export function TypeBadge({ type, className }: { type: ContributionType; className?: string }) {
  const t = CONTRIBUTION_TYPES[type];
  const Icon = t.icon;
  return (
    <span className={cn("badge", t.tone.pill, className)}>
      <Icon className="size-3" aria-hidden />
      {t.label}
    </span>
  );
}

/** Identity Saver / Identity Revealer indicator. */
export function IdentityBadge({
  mode,
  revealed,
  compact,
  className,
}: {
  mode: IdentityMode;
  revealed?: { name: string; role: string };
  compact?: boolean;
  className?: string;
}) {
  if (mode === "saver") {
    return (
      <span
        className={cn("has-tip relative inline-flex items-center gap-1 text-[0.72rem] font-medium text-slate-400", className)}
        aria-label="Identity Saver: real-world identity protected"
      >
        <ShieldCheck className="size-3.5 text-sky-400/80" aria-hidden />
        {!compact && <span>Identity Saver</span>}
        <span className="tooltip left-0 top-full mt-1.5">Identity Saver · real-world identity protected</span>
      </span>
    );
  }
  return (
    <span className={cn("has-tip relative inline-flex min-w-0 items-center gap-1 text-[0.72rem] font-medium text-ink-2", className)}>
      <BadgeCheck className="size-3.5 shrink-0 text-amber-300/90" aria-hidden />
      <span className="truncate">{compact || !revealed ? "Identity Revealer" : `${revealed.name} · ${revealed.role}`}</span>
      <span className="tooltip left-0 top-full mt-1.5">Identity Revealer · chose to connect their reputation</span>
    </span>
  );
}
