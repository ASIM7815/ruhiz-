"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { CalendarDays, Check, EyeOff, Flag, Forward, HandHelping, Image as ImageIcon, Lightbulb, MapPin, MessageCircle, PenLine, Play, SearchX, ShieldAlert, Sparkles, UserPlus, Video } from "lucide-react";
import type { Contribution, Post, Profile, Solution } from "@/lib/types";
import { HELP_TYPES } from "@/lib/meta";
import { api, revalidate } from "@/lib/api";
import { formatCount, monthYear, normalizeCode } from "@/lib/utils";
import { useMe, useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";
import { UserCode } from "@/components/ui/UserCode";
import { IdentityBadge } from "@/components/ui/Badges";
import { EmptyState, Menu, MenuItem, Tabs } from "@/components/ui/Primitives";
import { PostCard, PostSkeleton } from "@/components/feed/PostCard";
import { ContributionList } from "@/components/profile/ContributionList";
import { ProfileBanner } from "@/components/profile/ProfileBanner";
import { SolutionCard } from "@/components/solution/SolutionCard";

type Tab = "contributions" | "posts" | "photos" | "videos" | "thoughts";
const KIND: Partial<Record<Tab, string>> = { photos: "photo", videos: "video", thoughts: "thought" };

function MediaGrid({ posts, kind }: { posts: Post[]; kind: "photo" | "video" }) {
  const tiles = posts.flatMap((p) => p.media.map((m) => ({ p, m })));
  if (!tiles.length) return <p className="card p-8 text-center text-[0.86rem] text-muted">No {kind}s yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {tiles.map(({ p, m }) => (
        <Link key={m.id} href={`/post/${p.id}`} className="group relative aspect-square overflow-hidden rounded-xl bg-elev ring-1 ring-white/10">
          {m.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.url} alt={m.alt} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <video src={`${m.url}#t=0.1`} preload="metadata" muted className="size-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          {m.type === "video" && (
            <span className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white/80 bg-black/40">
              <Play className="ml-0.5 size-4.5 fill-white text-white" />
            </span>
          )}
          <span className="absolute bottom-2 left-2 right-2 line-clamp-2 text-[0.74rem] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">{p.title ?? p.text}</span>
        </Link>
      ))}
    </div>
  );
}

function ProfileContent({ code, tab }: { code: string; tab: Tab }) {
  const isPosts = tab !== "contributions";
  const { data: posts, isLoading: lp } = useSWR<Post[]>(isPosts ? `/api/users/${code}/posts${KIND[tab] ? `?kind=${KIND[tab]}` : ""}` : null);
  const { data: contrib, isLoading: lc } = useSWR<{ contributions: Contribution[]; solutions: Solution[] }>(!isPosts ? `/api/users/${code}/contributions` : null);
  if (lp || lc) return <PostSkeleton />;
  if (tab === "contributions")
    return (
      <div className="space-y-4">
        {contrib?.solutions.map((s) => <SolutionCard key={s.id} solution={s} compact />)}
        <ContributionList items={contrib?.contributions ?? []} empty={contrib?.solutions.length ? "No discussion contributions yet." : "No contributions yet."} />
      </div>
    );
  if (tab === "photos") return <MediaGrid posts={posts ?? []} kind="photo" />;
  if (tab === "videos") return <MediaGrid posts={posts ?? []} kind="video" />;
  if (!posts?.length) return <p className="card p-8 text-center text-[0.86rem] text-muted">No {tab === "thoughts" ? "thoughts" : "posts"} yet.</p>;
  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = normalizeCode(raw);
  const router = useRouter();
  const me = useMe();
  const { actions } = useStore();
  const [tab, setTab] = useState<Tab>("posts");
  const { data: u, error, isLoading, mutate } = useSWR<Profile>(code.length === 6 ? `/api/users/${code}` : null);

  if (code.length === 6 && isLoading)
    return (
      <div className="mx-auto max-w-[860px]">
        <div className="card skeleton h-72" />
      </div>
    );
  if (!u || error)
    return (
      <div className="mx-auto max-w-[760px]">
        <EmptyState icon={SearchX} title={`No user with code #${code}`} text="Check the code and try again. RUHIZ codes are six characters, like #A1B2C3." action={<Link href="/home" className="btn btn-blue">Back to Home</Link>} />
      </div>
    );

  const toggleSupport = async () => {
    const on = !u.supportedByMe;
    mutate({ ...u, supportedByMe: on, supporters: u.supporters + (on ? 1 : -1) }, { revalidate: false });
    try {
      await api(`/api/users/${code}/support`, { method: on ? "POST" : "DELETE" });
      actions.toast(on ? `You're now supporting #${code}` : `You stopped supporting #${code}`, on ? "success" : "info");
      revalidate("/api/me", "/api/sidebar");
    } catch (e) {
      mutate();
      actions.toast((e as Error).message, "error");
    }
  };

  const adminDelete = () =>
    actions.openModal({
      type: "confirm",
      title: `Delete #${code}'s account?`,
      text: "This permanently deletes the account and everything it created: profile, posts, media, contributions, Solution Cards and messages. The action is recorded in the moderation log.",
      confirmLabel: "Delete account",
      danger: true,
      requireReason: true,
      onConfirm: async (reason) => {
        await api(`/api/admin/users/${code}`, { method: "DELETE", body: { reason } });
        actions.toast(`Account #${code} deleted`, "info");
        revalidate("feed", "/api/sidebar", "/api/explore");
        router.push("/admin");
      },
    });

  return (
    <div className="mx-auto max-w-[860px] space-y-4">
      <section className="card overflow-hidden">
        <ProfileBanner src={u.bannerUrl} editable={u.isMe} onChanged={() => mutate()} />
        <div className="relative px-4 pb-5 sm:px-6">
          <div className="-mt-14 flex flex-wrap items-end gap-4 sm:-mt-16">
            <Avatar code={code} src={u.avatarUrl} size="3xl" ring online={u.online} className="!size-28 sm:!size-32" />
            <div className="ml-auto flex flex-wrap gap-2 pb-1">
              {u.isMe ? (
                <button onClick={() => actions.openModal({ type: "editProfile" })} className="btn btn-outline">
                  <PenLine className="size-4" /> Edit profile
                </button>
              ) : (
                <>
                  <button onClick={toggleSupport} data-on={u.supportedByMe} aria-pressed={u.supportedByMe} className="btn btn-support">
                    {u.supportedByMe ? <Check className="size-4" /> : <UserPlus className="size-4" />} {u.supportedByMe ? "Supporting" : "Support"}
                  </button>
                  <Link href={`/messages?to=${code}`} className="btn btn-outline">
                    <MessageCircle className="size-4" /> Message
                  </Link>
                </>
              )}
              <button onClick={() => actions.openModal({ type: "share", target: { kind: "profile", id: code, title: `#${code} on RUHIZ` } })} className="btn btn-outline btn-icon" aria-label="Share profile">
                <Forward className="size-4" />
              </button>
              {!u.isMe && (
                <Menu
                  label="More"
                  trigger={({ toggle }) => (
                    <button onClick={toggle} className="btn btn-outline btn-icon" aria-label="More options">
                      <Flag className="size-4" />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem icon={Flag} danger onClick={() => (close(), actions.openModal({ type: "report", target: { target: "user", id: code, label: `#${code}` } }))}>
                        Report #{code}
                      </MenuItem>
                      {me.isAdmin && (
                        <MenuItem icon={ShieldAlert} danger onClick={() => (close(), adminDelete())}>
                          Delete account (moderator)
                        </MenuItem>
                      )}
                    </>
                  )}
                </Menu>
              )}
            </div>
          </div>

          {u.ownerView && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-sky-400/25 bg-sky-500/[.07] px-3 py-2 text-[0.8rem] leading-relaxed text-sky-100">
              <EyeOff className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden />
              <span>
                Your identity is hidden. Other members see only <b className="code-font">#{code}</b>: your photo, banner, headline, bio, location and expertise are visible to you alone.{" "}
                <Link href="/settings#identity" className="font-semibold text-sky-300 underline-offset-2 hover:underline">
                  Identity settings
                </Link>
              </span>
            </p>
          )}

          <div className="mt-4">
            <UserCode code={code} size="xl" link={false} copy verified={u.verifiedProfessional} />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <IdentityBadge mode={u.identity} revealed={u.revealed ?? undefined} />
              {u.location && (
                <span className="inline-flex items-center gap-1 text-[0.78rem] text-muted">
                  <MapPin className="size-3.5" /> {u.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[0.78rem] text-muted">
                <CalendarDays className="size-3.5" /> Joined {monthYear(u.joinedAt)}
              </span>
            </div>
            {u.headline && <p className="mt-1 text-[0.9rem] font-medium text-ink-2">{u.headline}</p>}
            {u.bio ? (
              <p className="mt-2 max-w-2xl whitespace-pre-line text-[0.9rem] leading-relaxed text-ink-2">{u.bio}</p>
            ) : (
              u.isMe && (
                <button onClick={() => actions.openModal({ type: "editProfile" })} className="mt-2 text-[0.86rem] font-semibold text-brand-ink">
                  Add a bio
                </button>
              )
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => actions.openModal({ type: "people", code, list: "supporters" })} className="surface px-3.5 py-2 text-left hover:border-line-strong">
              <span className="block text-[1.1rem] font-bold tabular-nums text-ink">{u.supporters.toLocaleString()}</span>
              <span className="text-[0.74rem] text-muted">Supporters</span>
            </button>
            <button onClick={() => actions.openModal({ type: "people", code, list: "supporting" })} className="surface px-3.5 py-2 text-left hover:border-line-strong">
              <span className="block text-[1.1rem] font-bold tabular-nums text-ink">{u.supporting.toLocaleString()}</span>
              <span className="text-[0.74rem] text-muted">Supporting</span>
            </button>
            <div className="surface px-3.5 py-2">
              <span className="block text-[1.1rem] font-bold tabular-nums text-ink">{u.counts.posts + u.counts.contributions}</span>
              <span className="text-[0.74rem] text-muted">Contributions</span>
            </div>
            <div className="surface px-3.5 py-2">
              <span className="block text-[1.1rem] font-bold tabular-nums text-ink">{formatCount(u.impact.helped)}</span>
              <span className="text-[0.74rem] text-muted">Offers of help</span>
            </div>
          </div>

          {(u.canHelpWith.length > 0 || u.expertise.length > 0) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {u.canHelpWith.length > 0 && (
                <div>
                  <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                    <HandHelping className="size-3.5" /> Can help with
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {u.canHelpWith.map((h) => {
                      const Icon = HELP_TYPES[h].icon;
                      return (
                        <span key={h} className="badge border-rose-400/20 bg-rose-500/[.08] text-rose-200">
                          <Icon className="size-3" /> {HELP_TYPES[h].label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {u.expertise.length > 0 && (
                <div>
                  <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="size-3.5" /> Expertise
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {u.expertise.map((e) => (
                      <span key={e} className="badge border-line bg-white/[.04] text-ink-2">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "posts", label: "Posts", count: u.counts.posts },
          { id: "contributions", label: "Contributions", count: u.counts.contributions + u.impact.solutions, icon: Lightbulb },
          { id: "photos", label: "Photos", count: u.counts.photos, icon: ImageIcon },
          { id: "videos", label: "Videos", count: u.counts.videos, icon: Video },
          { id: "thoughts", label: "Thoughts", count: u.counts.thoughts, icon: PenLine },
        ]}
      />
      <ProfileContent code={code} tab={tab} />
    </div>
  );
}
