"use client";

import Link from "next/link";
import useSWR from "swr";
import { HandHelping, MessageCircle, Undo2 } from "lucide-react";
import type { HelpOffer, HelpType, Post } from "@/lib/types";
import { HELP_TYPES } from "@/lib/meta";
import { api, revalidate } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";
import { UserCode } from "@/components/ui/UserCode";

export function HelpOfferRow({ offer, onWithdrawn }: { offer: HelpOffer; onWithdrawn?: () => void }) {
  const { actions } = useStore();
  const h = HELP_TYPES[offer.type];
  const Icon = h.icon;
  const withdraw = async () => {
    try {
      await api(`/api/help/${offer.id}`, { method: "DELETE" });
      actions.toast("Your offer was withdrawn", "info");
      revalidate(`/api/posts/${offer.postId}`, "/api/me/activity", "feed");
      onWithdrawn?.();
    } catch (e) {
      actions.toast((e as Error).message, "error");
    }
  };
  return (
    <div className={cn("flex items-start gap-3 rounded-[10px] p-2.5", offer.isMine && "bg-brand/[.07]")}>
      <Avatar code={offer.user.code} src={offer.user.avatarUrl} size="md" link />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <UserCode code={offer.user.code} size="sm" verified={offer.user.verifiedProfessional} />
          {offer.isMine && <span className="badge border-brand/30 bg-brand/15 text-blue-200">You</span>}
          <span className="badge border-rose-400/25 bg-rose-500/10 text-rose-200">
            <Icon className="size-3" /> {h.label}
          </span>
        </div>
        <p className="mt-1 text-[0.85rem] leading-snug text-ink-2">{offer.note}</p>
        <p className="mt-1 text-[0.72rem] text-faint">
          {offer.availability} · {timeAgo(offer.createdAt)}
          {offer.user.revealed && ` · ${offer.user.revealed.role}`}
        </p>
      </div>
      {offer.isMine ? (
        <button onClick={withdraw} className="btn btn-ghost btn-sm text-muted" aria-label="Withdraw offer">
          <Undo2 className="size-3.5" /> Withdraw
        </button>
      ) : (
        <Link href={`/messages?to=${offer.user.code}`} className="btn btn-ghost btn-sm btn-icon" aria-label={`Message #${offer.user.code}`}>
          <MessageCircle className="size-4" />
        </Link>
      )}
    </div>
  );
}

/** “People who can help” panel on a problem page. */
export function HelpPanel({ post }: { post: Post }) {
  const { actions } = useStore();
  const { data: offers, error, isLoading, mutate } = useSWR<HelpOffer[]>(`/api/posts/${post.id}/help`);
  const list = offers ?? [];
  const counts = list.reduce<Partial<Record<HelpType, number>>>((m, o) => ((m[o.type] = (m[o.type] ?? 0) + 1), m), {});

  return (
    <section id="help" className="card scroll-mt-24 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2 text-[1rem]">
            <HandHelping className="size-4.5 text-accent" /> People who can help
            <span className="rounded-md bg-white/5 px-1.5 text-[0.76rem] font-semibold text-muted">{list.length}</span>
          </h2>
          <p className="mt-0.5 text-[0.8rem] text-muted">Knowledge, skills, time, resources and connections offered for this problem.</p>
        </div>
        {post.status !== "solved" && !post.viewer.isOwner && (
          <button onClick={() => actions.openModal({ type: "help", post })} className="btn btn-red">
            <HandHelping className="size-4" /> I Can Help
          </button>
        )}
      </div>

      {Object.keys(counts).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(counts) as HelpType[]).map((t) => {
            const Icon = HELP_TYPES[t].icon;
            return (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-black/15 px-2.5 py-1 text-[0.76rem] text-ink-2">
                <Icon className="size-3.5 text-brand-ink" /> {HELP_TYPES[t].label} <span className="font-semibold text-ink">{counts[t]}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-3 divide-y divide-line">
        {isLoading ? (
          <p className="py-6 text-center text-[0.85rem] text-muted">Loading…</p>
        ) : error ? (
          <p className="py-6 text-center text-[0.85rem] text-rose-300">Couldn't load offers. {error.message}</p>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-[0.85rem] text-muted">
            {post.viewer.isOwner ? "Nobody has offered help yet. Sharing the problem can help it reach the right people." : "Nobody has offered help yet. If you know something, have something, or know someone, say so."}
          </p>
        ) : (
          list.map((o) => <HelpOfferRow key={o.id} offer={o} onWithdrawn={() => mutate()} />)
        )}
      </div>
    </section>
  );
}
