"use client";

import { BadgeCheck, ShieldCheck } from "lucide-react";
import type { IdentityMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMe } from "@/store/store";

/** Identity Saver / Identity Revealer selector, used by every composer. */
export function IdentityPicker({ value, onChange, compact }: { value: IdentityMode; onChange: (v: IdentityMode) => void; compact?: boolean }) {
  const me = useMe();
  // Revealer needs a consented account-level reveal first (Settings → Identity). The server enforces this too.
  const canReveal = me.identity === "revealer";
  const revealed = `“${me.revealedName}${me.revealedRole ? ` · ${me.revealedRole}` : ""}”`;
  const opts = [
    { id: "saver" as const, icon: ShieldCheck, title: "Identity Saver", desc: "Appear only as your code. Your real-world identity stays protected.", tone: "text-sky-300", disabled: false },
    {
      id: "revealer" as const,
      icon: BadgeCheck,
      title: "Identity Revealer",
      desc: canReveal ? `Show ${revealed} and connect your reputation.` : "Reveal your identity in Settings first to use this.",
      tone: "text-amber-300",
      disabled: !canReveal,
    },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Identity mode">
      {opts.map((o) => {
        const on = value === o.id;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={o.disabled}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all",
              on ? "border-brand/60 bg-brand/[.1] shadow-[inset_0_0_0_1px_rgba(47,123,255,.25)]" : "border-line hover:border-line-strong",
              o.disabled && "cursor-not-allowed opacity-55 hover:border-line",
            )}
          >
            <Icon className={cn("mt-0.5 size-4.5 shrink-0", o.tone)} />
            <span className="min-w-0">
              <span className="block text-[0.86rem] font-semibold text-ink">{o.title}</span>
              {!compact && <span className="mt-0.5 block text-[0.76rem] leading-snug text-muted">{o.desc}</span>}
            </span>
            <span className={cn("ml-auto mt-0.5 size-4 shrink-0 rounded-full border-2", on ? "border-brand bg-brand shadow-[inset_0_0_0_2px_var(--card-solid)]" : "border-line-strong")} />
          </button>
        );
      })}
    </div>
  );
}
