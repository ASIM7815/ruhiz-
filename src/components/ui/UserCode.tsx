"use client";

import Link from "next/link";
import { BadgeCheck, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";

interface Props {
  /** Null for an anonymous (masked) author. */
  code: string | null;
  link?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  copy?: boolean;
  /** Shows the verified-professional badge (credentials checked by an administrator). */
  verified?: boolean;
  className?: string;
}

const SIZE = {
  xs: "text-[0.72rem]",
  sm: "text-[0.82rem]",
  md: "text-[0.92rem]",
  lg: "text-lg",
  xl: "text-3xl tracking-tight",
};

/** The unique #CODE is the primary public identity on RUHIZ. */
export function UserCode({ code, link = true, size = "md", copy, verified, className }: Props) {
  const { actions } = useStore();
  if (!code)
    return (
      <span className={cn("inline-flex items-center font-semibold text-ink-2", SIZE[size], className)} title="Posted as Identity Saver">
        Anonymous member
      </span>
    );
  const inner = (
    <span className={cn("code-font inline-flex items-center gap-1 font-semibold text-ink", SIZE[size], className)}>
      <span className="text-brand-ink/80">#</span>
      {code}
    </span>
  );
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {link ? (
        <Link href={`/profile/${code}`} className="decoration-brand/60 underline-offset-4 hover:underline">
          {inner}
        </Link>
      ) : (
        inner
      )}
      {verified && <BadgeCheck className="size-[1.05em] shrink-0 text-amber-300" aria-label="Verified licensed professional" />}
      {copy && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(`#${code}`).catch(() => {});
            actions.toast(`Copied #${code}`, "info");
          }}
          className="ml-0.5 rounded-md p-1 text-muted hover:bg-white/5 hover:text-ink"
          aria-label={`Copy code #${code}`}
        >
          <Copy className="size-3.5" />
        </button>
      )}
    </span>
  );
}
