"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  CircleCheckBig,
  CornerDownRight,
  Ellipsis,
  EyeOff,
  Flag,
  Forward,
  HandHelping,
  Heart,
  HeartHandshake,
  Lightbulb,
  Link2,
  MapPin,
  MessageCircle,
  PenLine,
  ShieldAlert,
  Trash,
} from "lucide-react";
import type { Post } from "@/lib/types";
import { INTENT_LABEL, STATUS_META } from "@/lib/meta";
import { api, revalidate } from "@/lib/api";
import { cn, formatCount, formatINR, timeAgo } from "@/lib/utils";
import { useStore } from "@/store/store";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { CategoryPill, IdentityBadge, StagePill, StatusPill } from "@/components/ui/Badges";
import { Menu, MenuItem, Progress } from "@/components/ui/Primitives";
import { UserCode } from "@/components/ui/UserCode";
import { MediaCarousel } from "./MediaCarousel";
import { LifecycleMini } from "@/components/problem/Lifecycle";

const INTENT_TONE: Record<string, string> = {
  problem: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  solution: "border-blue-400/30 bg-blue-500/12 text-blue-200",
  experience: "border-violet-400/25 bg-violet-500/10 text-violet-200",
  support: "border-pink-400/25 bg-pink-500/10 text-pink-200",
  update: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  thought: "border-slate-400/25 bg-slate-400/10 text-slate-200",
};

/** Keys whose data contains posts; revalidated after any post mutation. */
export const POST_KEYS = ["feed", "/api/posts", "/api/users", "/api/saved", "/api/me/activity", "/api/explore", "/api/sidebar"];

export function PostCard({ post: initial, detail, onRemoved }: { post: Post; detail?: boolean; onRemoved?: (id: string) => void }) {
  const { actions } = useStore();
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [expanded, setExpanded] = useState(!!detail);
  const [pop, setPop] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setPost(initial), [initial]);

  const isProblem = post.intent === "problem" && !!post.status;
  const long = post.text.length > 260;
  const href = `/post/${post.id}`;

  /** Optimistic toggle against /api/posts/:id/:action. */
  const toggle = async (action: "support" | "care" | "save", key: "supported" | "cared" | "saved", count?: "supports" | "cares") => {
    if (busy) return;
    const on = !post.viewer[key];
    const before = post;
    setPost((p) => ({ ...p, viewer: { ...p.viewer, [key]: on }, counts: count ? { ...p.counts, [count]: Math.max(0, p.counts[count] + (on ? 1 : -1)) } : p.counts }));
    setBusy(action);
    try {
      const r = await api<{ supports: number; cares: number }>(`/api/posts/${post.id}/${action}`, { method: on ? "POST" : "DELETE" });
      setPost((p) => ({ ...p, counts: { ...p.counts, supports: r.supports, cares: r.cares } }));
      if (action === "save") {
        actions.toast(on ? "Saved to your collection" : "Removed from Saved", on ? "success" : "info", on ? { label: "View", href: "/saved" } : undefined);
        revalidate("/api/saved");
      }
      if (action === "support" && on) actions.toast(`You're supporting this ${post.intent === "problem" ? "problem" : "post"}`);
    } catch (e) {
      setPost(before);
      actions.toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const hide = async () => {
    try {
      await api(`/api/posts/${post.id}/hide`, { method: "POST" });
      onRemoved?.(post.id);
      actions.toast("Post hidden from your feed", "info");
    } catch (e) {
      actions.toast((e as Error).message, "error");
    }
  };

  const remove = (asModerator: boolean) =>
    actions.openModal({
      type: "confirm",
      title: asModerator ? "Remove this post as a moderator?" : "Delete this post?",
      text: asModerator
        ? `This permanently removes #${post.author.code}'s post, its media, discussion and Solution Cards. The action is recorded in the moderation log.`
        : "This permanently deletes the post, its photos or video, and its discussion. This can't be undone.",
      confirmLabel: asModerator ? "Remove post" : "Delete post",
      danger: true,
      requireReason: asModerator,
      onConfirm: async (reason) => {
        await api(`/api/posts/${post.id}`, { method: "DELETE", body: asModerator ? { reason } : {} });
        actions.toast(asModerator ? "Post removed" : "Post deleted", "info");
        onRemoved?.(post.id);
        revalidate(...POST_KEYS);
        if (detail) router.push("/home");
      },
    });

  return (
    <article className={cn("card anim-up overflow-hidden", !detail && "card-hover")}>
      <div className="p-4 sm:p-5">
        {post.addresses && (
          <Link href={`/post/${post.addresses.id}`} className="mb-3 flex items-center gap-1.5 rounded-lg border border-line bg-black/15 px-2.5 py-1.5 text-[0.78rem] text-muted hover:border-line-strong hover:text-ink-2">
            <CornerDownRight className="size-3.5 shrink-0 text-brand-ink" />
            <span className="truncate">
              Responding to problem: <span className="font-medium text-ink-2">{post.addresses.title}</span>
            </span>
          </Link>
        )}

        <header className="flex items-start gap-3">
          <Avatar code={post.author.code} src={post.author.avatarUrl} size="lg" link online={post.author.online} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <UserCode code={post.author.code} size="md" verified={post.author.verifiedProfessional} />
              <span className="text-[0.8rem] text-muted">
                · {timeAgo(post.createdAt)}
                {post.editedAt && " · edited"}
              </span>
              <CategoryPill id={post.category} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <IdentityBadge mode={post.identity} revealed={post.author.revealed ?? undefined} compact={post.identity === "saver"} />
              {post.location && (
                <span className="inline-flex items-center gap-1 text-[0.72rem] text-muted">
                  <MapPin className="size-3" /> {post.location}
                </span>
              )}
            </div>
          </div>
          <Menu
            label="Post options"
            trigger={({ toggle: t, open }) => (
              <button onClick={t} aria-expanded={open} className="btn btn-ghost btn-icon btn-sm -mr-1.5 -mt-1" aria-label="Post options">
                <Ellipsis className="size-5" />
              </button>
            )}
          >
            {(close) => (
              <>
                {!detail && (
                  <MenuItem icon={ArrowRight} href={href} onClick={close}>
                    Open {post.intent === "problem" ? "problem" : "post"}
                  </MenuItem>
                )}
                <MenuItem icon={Bookmark} onClick={() => (close(), toggle("save", "saved"))}>
                  {post.viewer.saved ? "Remove from Saved" : "Save"}
                </MenuItem>
                <MenuItem
                  icon={Link2}
                  onClick={() => {
                    close();
                    navigator.clipboard?.writeText(`${window.location.origin}${href}`).catch(() => {});
                    api(`/api/posts/${post.id}/share`, { body: { channel: "link" } }).catch(() => {});
                    actions.toast("Link copied", "info");
                  }}
                >
                  Copy link
                </MenuItem>
                {post.viewer.isOwner && (
                  <MenuItem icon={PenLine} onClick={() => (close(), actions.openModal({ type: "editPost", post }))}>
                    Edit post
                  </MenuItem>
                )}
                {!detail && !post.viewer.isOwner && (
                  <MenuItem icon={EyeOff} onClick={() => (close(), hide())}>
                    Hide from feed
                  </MenuItem>
                )}
                <div className="my-1 h-px bg-line" />
                {post.viewer.isOwner ? (
                  <MenuItem icon={Trash} danger onClick={() => (close(), remove(false))}>
                    Delete post
                  </MenuItem>
                ) : (
                  <MenuItem icon={Flag} danger onClick={() => (close(), actions.openModal({ type: "report", target: { target: "post", id: post.id, label: post.title ?? "this post" } }))}>
                    Report
                  </MenuItem>
                )}
                {post.viewer.canModerate && !post.viewer.isOwner && (
                  <MenuItem icon={ShieldAlert} danger onClick={() => (close(), remove(true))}>
                    Remove (moderator)
                  </MenuItem>
                )}
              </>
            )}
          </Menu>
        </header>

        <div className="mt-3.5">
          {(post.intent !== "thought" || isProblem) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn("badge", INTENT_TONE[post.intent])}>{INTENT_LABEL[post.intent]}</span>
              {isProblem && <StatusPill status={post.status!} />}
            </div>
          )}
          {post.title && (
            <Link href={href}>
              <h2 className={cn("section-title leading-snug hover:text-white", detail ? "text-[1.3rem]" : "text-[1.06rem]")}>{post.title}</h2>
            </Link>
          )}
          <p className={cn("prose-post mt-1.5 text-[0.93rem] leading-relaxed text-ink-2", !expanded && long && "line-clamp-4")}>{post.text}</p>
          {long && !detail && (
            <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-[0.82rem] font-semibold text-brand-ink hover:text-white">
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {post.media.length > 0 && <MediaCarousel media={post.media} className="mt-3.5" />}

        {post.status === "solved" && post.outcome && (
          <div className="mt-3.5 flex gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/[.08] p-3">
            <CircleCheckBig className="mt-0.5 size-4.5 shrink-0 text-emerald-400" />
            <p className="text-[0.84rem] leading-relaxed text-ink-2">
              <span className="font-semibold text-emerald-300">Outcome · </span>
              {post.outcome}
            </p>
          </div>
        )}

        {isProblem && post.status !== "solved" && (
          <div className="mt-3.5 rounded-xl border border-line bg-black/20 p-3">
            <p className="text-[0.74rem] font-semibold text-ink-2">{STATUS_META[post.status!].desc}</p>
            <LifecycleMini status={post.status!} className="mt-2" />
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {post.counts.helpers > 0 ? (
                <span className="flex items-center gap-2 text-[0.78rem] text-muted">
                  <AvatarStack people={post.helpers} total={post.helpers.length} max={4} size="xs" />
                  {post.counts.helpers} {post.counts.helpers === 1 ? "offer" : "offers"} of help
                </span>
              ) : (
                <span className="text-[0.78rem] text-muted">No one has offered help yet. Be the first.</span>
              )}
              {!post.viewer.isOwner && (
                <button onClick={() => actions.openModal({ type: "help", post })} className="btn btn-red btn-sm ml-auto">
                  <HandHelping className="size-4" /> I Can Help
                </button>
              )}
            </div>
          </div>
        )}

        {post.topSolution && (
          <Link href={`/solution/${post.topSolution.id}`} className="group mt-3.5 block rounded-xl border border-blue-400/25 bg-gradient-to-r from-brand/[.12] to-transparent p-3 transition-colors hover:border-blue-400/45">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-brand-ink" />
              <span className="text-[0.72rem] font-bold uppercase tracking-wider text-brand-ink">Solution Card</span>
              <StagePill stage={post.topSolution.stage} />
              <ArrowRight className="ml-auto size-4 text-muted transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-1.5 text-[0.88rem] font-semibold text-ink">{post.topSolution.title}</p>
            {post.topSolution.fundingNeeded > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <Progress value={(post.topSolution.fundingRaised / post.topSolution.fundingNeeded) * 100} className="flex-1" tone={post.topSolution.stage === "completed" ? "green" : "blue"} />
                <span className="shrink-0 text-[0.74rem] text-muted">
                  {formatINR(post.topSolution.fundingRaised)} / {formatINR(post.topSolution.fundingNeeded)} pledged
                </span>
              </div>
            )}
          </Link>
        )}

        <footer className="mt-4 flex items-center gap-2">
          <button
            onClick={() => {
              toggle("care", "cared", "cares");
              setPop(true);
              window.setTimeout(() => setPop(false), 400);
            }}
            aria-pressed={post.viewer.cared}
            className={cn("pill-action", post.viewer.cared && "border-rose-400/30 text-rose-200")}
            aria-label={post.viewer.cared ? "Remove care" : "Care"}
          >
            <Heart className={cn("size-[1.05rem] text-accent", post.viewer.cared && "fill-accent", pop && "anim-pop")} />
            <span className="tabular-nums">{formatCount(post.counts.cares)}</span>
          </button>
          <button onClick={() => router.push(`${href}#discussion`)} className="pill-action" aria-label={`Discuss, ${post.counts.discussions} contributions`}>
            <MessageCircle className="size-[1.05rem]" />
            <span className="tabular-nums">{formatCount(post.counts.discussions)}</span>
          </button>
          <button onClick={() => toggle("support", "supported", "supports")} data-on={post.viewer.supported} aria-pressed={post.viewer.supported} className="btn btn-support btn-sm h-[2.05rem]">
            <HeartHandshake className="size-[1.05rem]" />
            {post.viewer.supported ? "Supported" : "Support"}
            <span className="hidden tabular-nums opacity-75 sm:inline">· {formatCount(post.counts.supports)}</span>
          </button>
          <div className="ml-auto flex items-center">
            <button onClick={() => toggle("save", "saved")} aria-pressed={post.viewer.saved} className={cn("btn btn-ghost btn-icon", post.viewer.saved && "text-brand-ink")} aria-label={post.viewer.saved ? "Unsave" : "Save"}>
              <Bookmark className={cn("size-[1.15rem]", post.viewer.saved && "fill-current")} />
            </button>
            <button onClick={() => actions.openModal({ type: "share", target: { kind: "post", id: post.id, title: post.title ?? post.text.slice(0, 70) } })} className="btn btn-ghost btn-icon" aria-label="Share">
              <Forward className="size-[1.2rem]" />
            </button>
          </div>
        </footer>
      </div>
    </article>
  );
}

/** Loading placeholder shaped like a post (no fake content). */
export function PostSkeleton() {
  return (
    <div className="card p-5" aria-hidden>
      <div className="flex items-center gap-3">
        <span className="skeleton size-12 rounded-full" />
        <span className="flex-1 space-y-2">
          <span className="skeleton block h-3.5 w-40 rounded" />
          <span className="skeleton block h-3 w-24 rounded" />
        </span>
      </div>
      <span className="skeleton mt-4 block h-3.5 w-full rounded" />
      <span className="skeleton mt-2 block h-3.5 w-4/5 rounded" />
      <span className="skeleton mt-4 block h-48 w-full rounded-xl" />
    </div>
  );
}
