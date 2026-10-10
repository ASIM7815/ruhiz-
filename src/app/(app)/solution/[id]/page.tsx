"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Bookmark, Check, CircleCheckBig, Clock, FileSearch, Forward, HandCoins, HeartHandshake, Lightbulb, ListChecks, Loader2, Package, Rocket, Target, Trash, UserPlus, Users } from "lucide-react";
import type { Solution } from "@/lib/types";
import { STAGE_META, STAGE_ORDER } from "@/lib/meta";
import { api, revalidate } from "@/lib/api";
import { cn, formatCount, formatINR, timeAgo } from "@/lib/utils";
import { useMe, useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";
import { IdentityBadge, StagePill, StatusPill } from "@/components/ui/Badges";
import { EmptyState, Progress } from "@/components/ui/Primitives";
import { UserCode } from "@/components/ui/UserCode";
import { Discussion } from "@/components/problem/Discussion";
import { useSolutionToggles } from "@/components/solution/SolutionCard";

const NEXT_LABEL: Record<string, string> = {
  proposed: "Move to community review",
  reviewing: "Start gathering resources",
  funding: "Begin implementation",
  implementing: "Confirm completed",
};

function Block({ icon: Icon, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="section-title mb-3 flex items-center gap-2 text-[0.95rem]">
        <Icon className="size-4.5 text-brand-ink" /> {title}
      </h2>
      {children}
    </section>
  );
}

function Detail({ initial }: { initial: Solution }) {
  const router = useRouter();
  const { actions } = useStore();
  const { s, setS, toggle } = useSolutionToggles(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const stageIdx = STAGE_ORDER.indexOf(s.stage);
  const pct = s.funding.needed ? (s.funding.raised / s.funding.needed) * 100 : 100;
  const me = useMe();
  // Mirrors the server rule: only the problem's author (or an admin) confirms completion.
  const canComplete = s.stage !== "implementing" || me.isAdmin || s.problem?.authorCode === me.code;

  const advance = async () => {
    setBusy("advance");
    try {
      const next = await api<Solution>(`/api/solutions/${s.id}/advance`, { method: "POST", body: {} });
      setS(next);
      actions.toast(`Moved to “${STAGE_META[next.stage].label}”${next.stage === "completed" ? ". The problem is now marked Solved." : ""}`);
      revalidate(`/api/posts/${s.problem?.id}`, "feed", "/api/explore");
    } catch (e) {
      actions.toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const joinSkill = async (skillId: string, joined: boolean) => {
    setBusy(skillId);
    try {
      setS(await api<Solution>(`/api/solutions/${s.id}/skills/${skillId}`, { method: joined ? "DELETE" : "POST" }));
      actions.toast(joined ? "You left the role" : "You joined the role", joined ? "info" : "success");
      revalidate("/api/me/activity");
    } catch (e) {
      actions.toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const remove = () =>
    actions.openModal({
      type: "confirm",
      title: "Delete this Solution Card?",
      text: "Its discussion, roles and pledges will be removed. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        await api(`/api/solutions/${s.id}`, { method: "DELETE" });
        revalidate("/api/solutions", "feed", "/api/explore", "/api/me/activity");
        actions.toast("Solution Card deleted", "info");
        router.push(s.problem ? `/post/${s.problem.id}` : "/home");
      },
    });

  return (
    <div className="mx-auto max-w-[960px] space-y-4">
      <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/explore"))} className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="size-4" /> Back
      </button>

      <section className="card relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge border-blue-400/30 bg-blue-500/12 text-blue-200">
              <Lightbulb className="size-3" /> Solution Card
            </span>
            <StagePill stage={s.stage} />
          </div>
          {s.problem && (
            <Link href={`/post/${s.problem.id}`} className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-black/20 p-3 hover:border-line-strong">
              <Target className="mt-0.5 size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="eyebrow block">Problem it addresses</span>
                <span className="mt-0.5 block text-[0.9rem] font-semibold text-ink">{s.problem.title}</span>
              </span>
              {s.problem.status && <StatusPill status={s.problem.status} />}
            </Link>
          )}
          <h1 className="section-title mt-4 text-[1.5rem] leading-tight sm:text-[1.7rem]">{s.title}</h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{s.summary}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Avatar code={s.author.code} src={s.author.avatarUrl} size="md" link />
            <div>
              <UserCode code={s.author.code} size="sm" verified={s.author.verifiedProfessional} />
              <div className="flex items-center gap-2 text-[0.74rem] text-muted">
                <IdentityBadge mode={s.author.revealed ? "revealer" : "saver"} revealed={s.author.revealed ?? undefined} /> · {timeAgo(s.createdAt)}
              </div>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <button onClick={() => toggle("support")} data-on={s.supportedByMe} aria-pressed={s.supportedByMe} className="btn btn-support">
                <HeartHandshake className="size-4" /> {s.supportedByMe ? "Supported" : "Support"} · {formatCount(s.supports)}
              </button>
              <button onClick={() => toggle("save")} className={cn("btn btn-outline btn-icon", s.savedByMe && "text-brand-ink")} aria-label={s.savedByMe ? "Unsave" : "Save"}>
                <Bookmark className={cn("size-4", s.savedByMe && "fill-current")} />
              </button>
              <button onClick={() => actions.openModal({ type: "share", target: { kind: "solution", id: s.id, title: s.title } })} className="btn btn-outline btn-icon" aria-label="Share">
                <Forward className="size-4" />
              </button>
              {s.canDelete && (
                <button onClick={remove} className="btn btn-outline btn-icon text-rose-300" aria-label="Delete Solution Card">
                  <Trash className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title flex items-center gap-2 text-[0.95rem]">
            <Rocket className="size-4.5 text-accent" /> Path to implementation
          </h2>
          {s.stage === "completed" ? (
            <span className="badge border-emerald-400/30 bg-emerald-500/12 text-emerald-200">
              <CircleCheckBig className="size-3.5" /> Outcome reached
            </span>
          ) : s.canManage && canComplete ? (
            <button onClick={advance} disabled={busy === "advance"} className="btn btn-red btn-sm">
              {busy === "advance" ? <Loader2 className="size-4 animate-spin" /> : NEXT_LABEL[s.stage]}
            </button>
          ) : null}
        </div>
        <ol className="grid grid-cols-5 gap-1">
          {STAGE_ORDER.map((st, i) => (
            <li key={st} className="text-center">
              <div className={cn("h-1.5 rounded-full", i < stageIdx || s.stage === "completed" ? "bg-brand" : i === stageIdx ? "bg-accent shadow-[0_0_10px_rgba(255,46,85,.6)]" : "bg-white/10")} />
              <p className={cn("mt-2 text-[0.7rem] font-semibold sm:text-[0.76rem]", i <= stageIdx ? "text-ink" : "text-faint")}>{STAGE_META[st].label}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[0.76rem] text-faint">
          {s.canManage
            ? "As an owner of this solution or its problem, you can move it forward. Only the person who raised the problem can confirm completion."
            : "The solution's author and the person who raised the problem move this forward."}
        </p>
        {s.outcome && s.stage === "completed" && (
          <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/[.08] p-3.5 text-[0.88rem] text-ink-2">
            <span className="font-semibold text-emerald-300">Outcome · </span>
            {s.outcome}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Block icon={ListChecks} title="Proposed approach">
            <ol className="space-y-2.5">
              {s.approach.map((a, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[0.74rem] font-bold text-brand-ink">{i + 1}</span>
                  <span className="text-[0.88rem] leading-relaxed text-ink-2">{a}</span>
                </li>
              ))}
            </ol>
          </Block>

          <Block icon={Clock} title={`Estimated time${s.timeline ? ` · ${s.timeline}` : ""}`}>
            <div className="flex flex-col gap-2 sm:flex-row">
              {s.phases.map((p, i) => (
                <div key={i} className="flex-1 rounded-[10px] border border-line bg-black/15 p-3">
                  <p className="text-[0.7rem] font-bold uppercase tracking-wider text-faint">Phase {i + 1}</p>
                  <p className="mt-1 text-[0.86rem] font-semibold text-ink">{p.label}</p>
                  <p className="text-[0.78rem] text-muted">{p.duration}</p>
                </div>
              ))}
            </div>
          </Block>

          <Block icon={Target} title="Expected outcome">
            <p className="text-[0.9rem] leading-relaxed text-ink-2">{s.expectedOutcome}</p>
          </Block>

          <Block icon={FileSearch} title="Supporting information">
            {s.evidence.length ? (
              <ul className="space-y-2">
                {s.evidence.map((e, i) => (
                  <li key={i} className="rounded-lg border-l-[3px] border-l-emerald-400 bg-emerald-500/[.05] px-3 py-2 text-[0.86rem] text-ink-2">
                    {e}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.86rem] text-muted">No supporting evidence added yet. Add evidence in the discussion below.</p>
            )}
          </Block>
        </div>

        <div className="space-y-4">
          <Block icon={HandCoins} title="Funding">
            {s.funding.needed ? (
              <>
                <p className="text-[1.5rem] font-bold tracking-tight text-ink">{formatINR(s.funding.raised)}</p>
                <p className="text-[0.8rem] text-muted">
                  pledged of {formatINR(s.funding.needed)} needed · {Math.round(pct)}%
                </p>
                <Progress value={pct} className="mt-3 h-2" tone={pct >= 100 ? "green" : "blue"} />
                {s.myPledge > 0 && <p className="mt-2.5 text-[0.8rem] text-emerald-300">You pledged {formatINR(s.myPledge)}</p>}
                {pct < 100 && s.stage !== "completed" && (
                  <button onClick={() => actions.openModal({ type: "pledge", solution: s })} className="btn btn-blue mt-3.5 w-full">
                    <HandCoins className="size-4" /> Pledge support
                  </button>
                )}
                <p className="mt-2 text-[0.72rem] text-faint">Pledges are commitments recorded on RUHIZ. No payment is collected here.</p>
              </>
            ) : (
              <p className="text-[0.86rem] text-muted">This solution needs time and skills, not money.</p>
            )}
          </Block>

          <Block icon={Package} title="Resources required">
            {s.resources.length ? (
              <ul className="space-y-1.5">
                {s.resources.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-[0.85rem] text-ink-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand-ink" /> {r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.86rem] text-muted">None listed.</p>
            )}
          </Block>

          <Block icon={Users} title="People & skills required">
            {s.skills.length ? (
              <ul className="space-y-3">
                {s.skills.map((k) => {
                  const full = k.filled >= k.needed && !k.joined;
                  return (
                    <li key={k.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.84rem] font-medium text-ink-2">{k.label}</span>
                        <button onClick={() => joinSkill(k.id, k.joined)} disabled={full || s.stage === "completed" || busy === k.id} data-on={k.joined} className="btn btn-support btn-sm h-7 px-2 text-[0.74rem]">
                          {k.joined ? <Check className="size-3" /> : <UserPlus className="size-3" />}
                          {k.joined ? "Joined" : full ? "Filled" : "Join"}
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={(k.filled / k.needed) * 100} className="flex-1" tone={k.filled >= k.needed ? "green" : "blue"} />
                        <span className="text-[0.72rem] tabular-nums text-faint">
                          {k.filled}/{k.needed}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[0.86rem] text-muted">No roles listed.</p>
            )}
          </Block>

          <Block icon={HeartHandshake} title={`Contributors · ${s.contributors.length}`}>
            <div className="flex flex-wrap gap-1.5">
              {s.contributors.map((c) => (
                <Link key={c} href={`/profile/${c}`} className="code-font rounded-md bg-white/5 px-1.5 py-0.5 text-[0.74rem] text-ink-2 hover:text-white">
                  #{c}
                </Link>
              ))}
            </div>
          </Block>
        </div>
      </div>

      <Discussion target={{ kind: "solution", id: s.id }} title="Discuss this solution" />
    </div>
  );
}

export default function SolutionPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading } = useSWR<Solution>(`/api/solutions/${id}`);
  if (isLoading)
    return (
      <div className="mx-auto max-w-[960px]">
        <div className="card skeleton h-64" />
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-[760px]">
        <EmptyState
          icon={Lightbulb}
          title="Solution not found"
          text="This Solution Card may have been deleted."
          action={
            <Link href="/explore?tab=solutions" className="btn btn-blue">
              Browse solutions
            </Link>
          }
        />
      </div>
    );
  return <Detail initial={data} />;
}
