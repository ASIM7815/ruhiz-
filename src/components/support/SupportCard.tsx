"use client";

import { BadgeCheck, Clock, HeartHandshake } from "lucide-react";
import type { SupportListing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";
import { UserCode } from "@/components/ui/UserCode";

const AV = {
  available: { label: "Available now", cls: "text-emerald-300", dot: "bg-emerald-400 online-pulse" },
  busy: { label: "Limited availability", cls: "text-amber-300", dot: "bg-amber-400" },
  away: { label: "Away", cls: "text-slate-400", dot: "bg-slate-500" },
};

export function Availability({ a }: { a: SupportListing["availability"] }) {
  const m = AV[a];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.74rem] font-semibold", m.cls)}>
      <span className={cn("size-2 rounded-full", m.dot)} /> {m.label}
    </span>
  );
}

export function EmotionalSupportCard({ p }: { p: SupportListing }) {
  const { actions } = useStore();
  return (
    <article className="card card-hover flex flex-col p-4">
      <button onClick={() => actions.openModal({ type: "supportProfile", listing: p })} className="flex items-start gap-3 text-left">
        <Avatar code={p.user.code} src={p.user.avatarUrl} size="xl" online={p.availability === "available"} />
        <div className="min-w-0 flex-1">
          <UserCode code={p.user.code} link={false} size="md" verified={p.professional} />
          <div className="mt-0.5">
            <Availability a={p.availability} />
          </div>
          {p.professional ? (
            <span className="badge mt-1.5 border-amber-400/30 bg-amber-500/10 text-amber-200">
              <BadgeCheck className="size-3" /> Verified professional
            </span>
          ) : (
            <span className="mt-1.5 inline-block text-[0.72rem] font-medium text-sky-300/90">Community peer supporter</span>
          )}
        </div>
      </button>
      <p className="mt-3 line-clamp-3 flex-1 text-[0.85rem] leading-relaxed text-ink-2">{p.description || "Available to listen."}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.areas.map((a) => (
          <span key={a} className="rounded-md border border-pink-400/20 bg-pink-500/[.08] px-2 py-0.5 text-[0.72rem] font-medium text-pink-200">
            {a}
          </span>
        ))}
      </div>
      {p.hours && (
        <p className="mt-3 inline-flex items-center gap-1 text-[0.74rem] text-muted">
          <Clock className="size-3.5" /> {p.hours}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button onClick={() => actions.openModal({ type: "supportProfile", listing: p })} className="btn btn-outline btn-sm flex-1">
          View profile
        </button>
        {!p.isMe && (
          <button onClick={() => actions.openModal({ type: "requestSupport", listing: p })} disabled={p.availability === "away"} className="btn btn-support btn-sm flex-1">
            <HeartHandshake className="size-4" /> Support
          </button>
        )}
      </div>
    </article>
  );
}
