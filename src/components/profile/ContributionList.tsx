"use client";

import Link from "next/link";
import { ThumbsUp } from "lucide-react";
import type { Contribution } from "@/lib/types";
import { CONTRIBUTION_TYPES } from "@/lib/meta";
import { cn, timeAgo } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/Badges";

/** A member's discussion contributions, each linked back to the problem or solution. */
export function ContributionList({ items, empty = "No contributions yet." }: { items: Contribution[]; empty?: string }) {
  if (!items.length) return <p className="card p-8 text-center text-[0.86rem] text-muted">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((c) => {
        const href = c.target ? `/${c.target.kind === "post" ? "post" : "solution"}/${c.target.id}#discussion` : "#";
        return (
          <li key={c.id}>
            <Link href={href} className={cn("card card-hover block border-l-[3px] p-4", CONTRIBUTION_TYPES[c.type].tone.bar)}>
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={c.type} />
                <span className="text-[0.74rem] text-faint">{timeAgo(c.createdAt)}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-[0.74rem] text-muted">
                  <ThumbsUp className="size-3.5" /> {c.helpful} found helpful
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-[0.88rem] leading-relaxed text-ink-2">{c.text}</p>
              {c.target && (
                <p className="mt-2 truncate text-[0.76rem] text-muted">
                  on {c.target.kind}: <span className="text-ink-2">{c.target.title}</span>
                </p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
