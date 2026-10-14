"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
  xl: "size-16",
  "2xl": "size-24",
  "3xl": "size-32",
} as const;

const DOT = { xs: "size-2", sm: "size-2.5", md: "size-3", lg: "size-3", xl: "size-3.5", "2xl": "size-4", "3xl": "size-5" } as const;

const TEXT = { xs: "text-[0.55rem]", sm: "text-[0.65rem]", md: "text-[0.78rem]", lg: "text-[0.9rem]", xl: "text-lg", "2xl": "text-2xl", "3xl": "text-4xl" } as const;

export type AvatarSize = keyof typeof SIZES;

interface Props {
  /** Null for an anonymous (masked) author: a neutral avatar with no link. */
  code: string | null;
  src?: string | null;
  size?: AvatarSize;
  online?: boolean;
  ring?: boolean;
  link?: boolean;
  className?: string;
}

/** Profile picture for a RUHIZ member. Falls back to their code's initials (no stock photos). */
export function Avatar({ code, src, size = "md", online, ring, link, className }: Props) {
  const [failed, setFailed] = useState(false);
  if (!code)
    return (
      <span
        role="img"
        aria-label="Anonymous member"
        className={cn("relative grid shrink-0 place-items-center rounded-full border border-line bg-elev-2 text-slate-300", SIZES[size], ring && "ring-2 ring-brand/50 ring-offset-2 ring-offset-bg", className)}
      >
        <ShieldCheck className="size-1/2" aria-hidden />
      </span>
    );
  const body = (
    <span className={cn("relative inline-block shrink-0", SIZES[size], className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Profile picture of #${code}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn("size-full rounded-full bg-elev object-cover", ring && "ring-2 ring-brand/50 ring-offset-2 ring-offset-bg")}
        />
      ) : (
        <span
          role="img"
          aria-label={`#${code}`}
          className={cn(
            "code-font grid size-full place-items-center rounded-full bg-gradient-to-br from-brand-2 to-elev-2 font-bold leading-none text-white",
            TEXT[size],
            ring && "ring-2 ring-brand/50 ring-offset-2 ring-offset-bg",
          )}
        >
          {code.slice(0, 2)}
        </span>
      )}
      {online && <span className={cn("absolute bottom-0 right-0 rounded-full bg-emerald-400 ring-2 ring-bg online-pulse", DOT[size])} aria-label="Online" />}
    </span>
  );
  if (!link) return body;
  return (
    <Link href={`/profile/${code}`} aria-label={`Open profile #${code}`} className="shrink-0 rounded-full">
      {body}
    </Link>
  );
}

/** Overlapping stack of avatars. */
export function AvatarStack({ people, max = 4, size = "sm", total }: { people: { code: string | null; avatarUrl: string | null }[]; max?: number; size?: AvatarSize; total?: number }) {
  const shown = people.slice(0, max);
  const extra = (total ?? people.length) - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.code ?? `anon-${i}`} className={cn("rounded-full ring-2 ring-[var(--card-solid)]", i > 0 && "-ml-2")}>
          <Avatar code={p.code} src={p.avatarUrl} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span className={cn("-ml-2 grid place-items-center rounded-full bg-elev-2 text-[0.7rem] font-semibold text-ink-2 ring-2 ring-[var(--card-solid)]", SIZES[size])}>+{extra}</span>
      )}
    </div>
  );
}
