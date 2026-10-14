"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { FileSearch, Flag, Lightbulb, Loader2, MessagesSquare, Reply, ShieldAlert, ThumbsUp, Trash } from "lucide-react";
import type { Contribution, ContributionType, IdentityMode } from "@/lib/types";
import { CONTRIBUTION_TYPES } from "@/lib/meta";
import { api, revalidate } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { useMe, useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";
import { IdentityBadge, TypeBadge } from "@/components/ui/Badges";
import { UserCode } from "@/components/ui/UserCode";
import { Segmented } from "@/components/ui/Primitives";

const TYPES = Object.keys(CONTRIBUTION_TYPES) as ContributionType[];
export type Target = { kind: "post" | "solution"; id: string };
export const contributionsKey = (t: Target) => `/api/contributions?${t.kind}=${t.id}`;

function ContributionComposer({ target, parentId, defaultType = "experience", onDone, onProposeCard, autoFocus }: { target: Target; parentId?: string; defaultType?: ContributionType; onDone?: () => void; onProposeCard?: () => void; autoFocus?: boolean }) {
  const { actions } = useStore();
  const me = useMe();
  const [type, setType] = useState<ContributionType>(defaultType);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [identity, setIdentity] = useState<IdentityMode>(me.settings.defaultIdentity);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = CONTRIBUTION_TYPES[type];

  const submit = async () => {
    if (text.trim().length < 3 || sending) return;
    setSending(true);
    setError(null);
    try {
      await api("/api/contributions", {
        body: {
          [target.kind === "post" ? "postId" : "solutionId"]: target.id,
          parentId,
          type,
          text: text.trim(),
          source: type === "evidence" && source.trim() ? source.trim() : undefined,
          identity,
        },
      });
      setText("");
      setSource("");
      revalidate(contributionsKey(target), `/api/posts/${target.id}`, `/api/solutions/${target.id}`, "/api/me/activity");
      actions.toast(`${meta.label} added to the discussion`);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn("rounded-xl border border-line bg-black/20 p-3", parentId && "mt-2")}>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2.5">
        {TYPES.map((t) => {
          const m = CONTRIBUTION_TYPES[t];
          const Icon = m.icon;
          const on = t === type;
          return (
            <button key={t} type="button" onClick={() => setType(t)} aria-pressed={on} className={cn("badge h-7 shrink-0 cursor-pointer px-2.5 transition-all", on ? m.tone.pill : "border-line bg-transparent text-muted hover:text-ink-2")}>
              <Icon className="size-3.5" /> {m.short}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2.5">
        <Avatar code={me.code} src={me.avatarUrl} size="sm" className="mt-1 hidden sm:block" />
        <div className="min-w-0 flex-1 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 3000))}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
            rows={parentId ? 2 : 3}
            autoFocus={autoFocus}
            placeholder={meta.hint}
            className={cn("input border-l-[3px]", meta.tone.bar)}
            aria-label={`Write ${meta.label}`}
          />
          {type === "evidence" && <input value={source} onChange={(e) => setSource(e.target.value)} maxLength={300} className="input h-9 text-[0.84rem]" placeholder="Source (report, dataset, link or how you measured it)" />}
          {type === "solution" && onProposeCard && (
            <p className="flex items-center gap-2 text-[0.78rem] text-muted">
              <Lightbulb className="size-3.5 text-brand-ink" /> Have a full plan with costs and roles?
              <button onClick={onProposeCard} className="font-semibold text-brand-ink hover:text-white">
                Create a Solution Card
              </button>
            </p>
          )}
          {error && <p className="text-[0.8rem] text-rose-300">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={identity}
              onChange={setIdentity}
              options={[
                { id: "saver", label: "Identity Saver" },
                { id: "revealer", label: "Revealer" },
              ]}
            />
            <div className="ml-auto flex gap-2">
              {onDone && parentId && (
                <button onClick={onDone} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
              )}
              <button onClick={submit} disabled={text.trim().length < 3 || sending} className="btn btn-blue btn-sm">
                {sending ? <Loader2 className="size-3.5 animate-spin" /> : `Post ${meta.short.toLowerCase()}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({ c, childrenOf, depth, target }: { c: Contribution; childrenOf: Map<string, Contribution[]>; depth: number; target: Target }) {
  const { actions } = useStore();
  const [replying, setReplying] = useState(false);
  const [helpful, setHelpful] = useState({ on: c.helpfulByMe, n: c.helpful });
  const meta = CONTRIBUTION_TYPES[c.type];
  const kids = childrenOf.get(c.id) ?? [];

  const toggleHelpful = async () => {
    const on = !helpful.on;
    setHelpful((h) => ({ on, n: h.n + (on ? 1 : -1) }));
    try {
      const r = await api<{ helpful: number }>(`/api/contributions/${c.id}/helpful`, { method: on ? "POST" : "DELETE" });
      setHelpful({ on, n: r.helpful });
    } catch (e) {
      setHelpful((h) => ({ on: !on, n: h.n + (on ? -1 : 1) }));
      actions.toast((e as Error).message, "error");
    }
  };

  const remove = (asModerator: boolean) =>
    actions.openModal({
      type: "confirm",
      title: asModerator ? "Remove this contribution as a moderator?" : "Delete your contribution?",
      text: asModerator ? `This removes ${c.author.code ? `#${c.author.code}'s` : "this"} contribution. Replies stay in the discussion. The action is logged.` : "Replies from others will stay in the discussion.",
      confirmLabel: asModerator ? "Remove" : "Delete",
      danger: true,
      onConfirm: async () => {
        await api(`/api/contributions/${c.id}`, { method: "DELETE" });
        revalidate(contributionsKey(target), `/api/posts/${target.id}`, "/api/me/activity");
        actions.toast("Contribution removed", "info");
      },
    });

  return (
    <li className="anim-fade">
      <div className={cn("rounded-xl border border-l-[3px] border-line bg-black/[.14] p-3 sm:p-3.5", meta.tone.bar, c.isOwner && "bg-brand/[.05]")}>
        <div className="flex items-start gap-2.5">
          <Avatar code={c.author.code} src={c.author.avatarUrl} size="sm" link />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <UserCode code={c.author.code} size="sm" verified={c.author.verifiedProfessional} />
              <span className="text-[0.74rem] text-faint">{timeAgo(c.createdAt)}</span>
              <TypeBadge type={c.type} className="ml-auto" />
            </div>
            {c.author.revealed && <IdentityBadge mode="revealer" revealed={c.author.revealed} className="mt-0.5" />}
            <p className="prose-post mt-1.5 text-[0.88rem] leading-relaxed text-ink-2">{c.text}</p>
            {c.source && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-500/[.07] px-2.5 py-1.5 text-[0.76rem] text-emerald-200/90">
                <FileSearch className="size-3.5 shrink-0" /> Source: {c.source}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <button onClick={toggleHelpful} aria-pressed={helpful.on} className={cn("btn btn-ghost btn-sm h-7 px-2 text-[0.76rem]", helpful.on && "text-brand-ink")}>
                <ThumbsUp className={cn("size-3.5", helpful.on && "fill-current")} /> Helpful · {helpful.n}
              </button>
              {depth < 3 && (
                <button onClick={() => setReplying((r) => !r)} className="btn btn-ghost btn-sm h-7 px-2 text-[0.76rem]">
                  <Reply className="size-3.5" /> Respond
                </button>
              )}
              <span className="ml-auto flex">
                {c.isOwner ? (
                  <button onClick={() => remove(false)} className="btn btn-ghost btn-sm btn-icon h-7 text-faint hover:text-rose-300" aria-label="Delete contribution">
                    <Trash className="size-3.5" />
                  </button>
                ) : (
                  <button onClick={() => actions.openModal({ type: "report", target: { target: "contribution", id: c.id, label: "this contribution" } })} className="btn btn-ghost btn-sm btn-icon h-7 text-faint hover:text-rose-300" aria-label="Report contribution">
                    <Flag className="size-3.5" />
                  </button>
                )}
                {c.canModerate && !c.isOwner && (
                  <button onClick={() => remove(true)} className="btn btn-ghost btn-sm btn-icon h-7 text-faint hover:text-rose-300" aria-label="Remove as moderator">
                    <ShieldAlert className="size-3.5" />
                  </button>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
      {replying && <ContributionComposer target={target} parentId={c.id} defaultType={c.type === "question" ? "experience" : "counter"} onDone={() => setReplying(false)} autoFocus />}
      {kids.length > 0 && (
        <ul className="ml-3 mt-2 space-y-2 border-l border-line pl-3 sm:ml-5 sm:pl-4">
          {kids.map((k) => (
            <Item key={k.id} c={k} childrenOf={childrenOf} depth={depth + 1} target={target} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Structured discussion: every contribution is typed so people can tell experience from evidence from opinion. */
export function Discussion({ target, onProposeCard, title = "Structured discussion" }: { target: Target; onProposeCard?: () => void; title?: string }) {
  const { data, error, isLoading } = useSWR<Contribution[]>(contributionsKey(target));
  const [filter, setFilter] = useState<ContributionType | "all">("all");
  const [sort, setSort] = useState<"helpful" | "newest">("helpful");
  const all = useMemo(() => data ?? [], [data]);

  const { roots, childrenOf } = useMemo(() => {
    const order = (list: Contribution[]) => [...list].sort((a, b) => (sort === "newest" ? b.createdAt - a.createdAt : b.helpful - a.helpful || a.createdAt - b.createdAt));
    if (filter !== "all") return { roots: order(all.filter((c) => c.type === filter)), childrenOf: new Map<string, Contribution[]>() };
    const childrenOf = new Map<string, Contribution[]>();
    const ids = new Set(all.map((c) => c.id));
    for (const c of all) if (c.parentId && ids.has(c.parentId)) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c]);
    return { roots: order(all.filter((c) => !c.parentId || !ids.has(c.parentId))), childrenOf };
  }, [all, filter, sort]);

  const counts = TYPES.reduce<Record<string, number>>((m, t) => ((m[t] = all.filter((c) => c.type === t).length), m), {});

  return (
    <section id="discussion" className="card scroll-mt-24 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title flex items-center gap-2 text-[1rem]">
          <MessagesSquare className="size-4.5 text-brand-ink" /> {title}
          <span className="rounded-md bg-white/5 px-1.5 text-[0.76rem] font-semibold text-muted">{all.length}</span>
        </h2>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input h-8 w-auto text-[0.8rem]" aria-label="Sort contributions">
          <option value="helpful">Most helpful</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {all.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setFilter("all")} data-on={filter === "all"} className="chip h-8 shrink-0 text-[0.78rem]">
            All · {all.length}
          </button>
          {TYPES.filter((t) => counts[t]).map((t) => {
            const m = CONTRIBUTION_TYPES[t];
            const Icon = m.icon;
            return (
              <button key={t} onClick={() => setFilter(t)} data-on={filter === t} className="chip h-8 shrink-0 text-[0.78rem]">
                <Icon className={cn("size-3.5", m.tone.text)} /> {m.short} · {counts[t]}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <ContributionComposer target={target} onProposeCard={onProposeCard} />
      </div>

      {isLoading ? (
        <p className="flex items-center justify-center gap-2 py-8 text-[0.86rem] text-muted">
          <Loader2 className="size-4 animate-spin" /> Loading discussion…
        </p>
      ) : error ? (
        <p className="py-8 text-center text-[0.86rem] text-rose-300">Couldn't load the discussion. {error.message}</p>
      ) : roots.length === 0 ? (
        <p className="py-8 text-center text-[0.86rem] text-muted">No contributions {filter !== "all" ? "of this type " : ""}yet. Share an experience or ask a question to start.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {roots.map((c) => (
            <Item key={c.id} c={c} childrenOf={childrenOf} depth={0} target={target} />
          ))}
        </ul>
      )}
    </section>
  );
}
