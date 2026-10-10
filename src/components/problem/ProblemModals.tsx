"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleCheckBig, HandHelping, Lightbulb, Loader2, Milestone } from "lucide-react";
import type { HelpOffer, HelpType, Post, ProblemStatus, Solution } from "@/lib/types";
import { HELP_TYPES, STATUS_META, STATUS_ORDER } from "@/lib/meta";
import { api, revalidate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Primitives";
import { HelpOfferRow } from "./HelpPanel";

const ErrorLine = ({ text }: { text: string | null }) => (text ? <p role="alert" className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[0.84rem] text-rose-200">{text}</p> : null);

/* ───────── I Can Help ───────── */
export function HelpModal({ post, onClose }: { post: Pick<Post, "id" | "title" | "text">; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<HelpType | null>(null);
  const [note, setNote] = useState("");
  const [availability, setAvailability] = useState("This week");
  const [offer, setOffer] = useState<HelpOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const o = await api<HelpOffer>(`/api/posts/${post.id}/help`, { body: { type, note: note.trim(), availability } });
      setOffer(o);
      revalidate(`/api/posts/${post.id}`, "feed", "/api/me/activity", "/api/sidebar");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (offer)
    return (
      <Modal open onClose={onClose} size="md" title="Your offer is live" icon={<CircleCheckBig className="size-5 text-emerald-400" />} subtitle="This is how it appears to everyone on the problem.">
        <div className="rounded-xl border border-line bg-black/20 p-1">
          <HelpOfferRow offer={offer} />
        </div>
        <p className="mt-4 text-[0.84rem] leading-relaxed text-muted">The person who raised this problem has been notified and may message you to coordinate. You can withdraw this offer at any time from the problem page.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            Done
          </button>
          <button
            onClick={() => {
              onClose();
              router.push(`/post/${post.id}#help`);
            }}
            className="btn btn-blue"
          >
            View on problem <ArrowRight className="size-4" />
          </button>
        </div>
      </Modal>
    );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={<HandHelping className="size-5 text-rose-300" />}
      title="I Can Help"
      subtitle={<span className="line-clamp-1">{post.title ?? post.text}</span>}
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button disabled={!type || note.trim().length < 5 || busy} onClick={submit} className="btn btn-red">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Offer help"}
          </button>
        </>
      }
    >
      <p className="mb-3 text-[0.84rem] text-muted">What can you contribute? RUHIZ connects people by what they can bring, not by who they follow.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(Object.keys(HELP_TYPES) as HelpType[]).map((t) => {
          const h = HELP_TYPES[t];
          const Icon = h.icon;
          const on = type === t;
          return (
            <button key={t} onClick={() => setType(t)} aria-pressed={on} className={cn("flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all", on ? "border-accent/60 bg-accent/[.1] text-white shadow-[0_0_0_1px_rgba(255,46,85,.2)]" : "border-line text-ink-2 hover:border-line-strong hover:bg-white/[.03]")}>
              <Icon className={cn("size-5", on ? "text-rose-300" : "text-brand-ink")} />
              <span className="text-[0.76rem] font-semibold leading-tight">{h.label}</span>
            </button>
          );
        })}
      </div>
      {type && <p className="mt-2.5 text-[0.8rem] text-muted">{HELP_TYPES[type].desc}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <Field label="What exactly can you offer?" hint={`${note.length}/500`}>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} className="input" placeholder="Be specific: what, how much, and when." />
        </Field>
        <Field label="Availability">
          <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="input">
            {["Today", "This week", "This month", "Ongoing", "One-time"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorLine text={error} />
    </Modal>
  );
}

/* ───────── Update status (author or moderator only; enforced server-side) ───────── */
export function StatusModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { actions } = useStore();
  const [status, setStatus] = useState<ProblemStatus>(post.status ?? "unsolved");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState(post.outcome ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/posts/${post.id}/status`, { body: { status, note: note.trim(), outcome: outcome.trim() } });
      revalidate(`/api/posts/${post.id}`, "feed", "/api/explore", "/api/me/activity");
      actions.toast(`Problem moved to “${STATUS_META[status].label}”`);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={<Milestone className="size-5" />}
      title="Update problem status"
      subtitle={post.viewer.isOwner ? "You raised this problem." : "Moderator action. This will be logged."}
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button disabled={status === post.status || (status === "solved" && outcome.trim().length < 10) || busy} onClick={save} className="btn btn-blue">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Save status"}
          </button>
        </>
      }
    >
      <div className="space-y-2">
        {STATUS_ORDER.map((s) => {
          const m = STATUS_META[s];
          const Icon = m.icon;
          return (
            <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all", status === s ? "border-brand/60 bg-brand/[.1]" : "border-line hover:border-line-strong")}>
              <span className={cn("grid size-9 place-items-center rounded-lg border", m.tone.pill)}>
                <Icon className="size-4.5" />
              </span>
              <span className="flex-1">
                <span className="block text-[0.88rem] font-semibold text-ink">
                  {m.label} {post.status === s && <span className="ml-1 text-[0.72rem] font-medium text-faint">(current)</span>}
                </span>
                <span className="block text-[0.78rem] text-muted">{m.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Field label="Update note" className="mt-4">
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="input" placeholder="What changed?" />
      </Field>
      {status === "solved" && (
        <Field label="Outcome (required)" hint="What was actually achieved?" className="mt-3">
          <textarea value={outcome} onChange={(e) => setOutcome(e.target.value.slice(0, 1000))} rows={3} className="input" placeholder="Describe the measurable result." />
        </Field>
      )}
      <ErrorLine text={error} />
    </Modal>
  );
}

/* ───────── Propose a Solution Card ───────── */
export function ProposeModal({ problem, onClose }: { problem: Pick<Post, "id" | "title" | "text">; onClose: () => void }) {
  const { actions } = useStore();
  const router = useRouter();
  const [f, setF] = useState({ title: "", summary: "", approach: "", resources: "", funding: "", skills: "", timeline: "", outcome: "", evidence: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const valid = f.title.trim().length >= 8 && f.summary.trim().length >= 20 && lines(f.approach).length > 0 && f.outcome.trim().length >= 10;

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await api<Solution>("/api/solutions", {
        body: {
          problemId: problem.id,
          title: f.title.trim(),
          summary: f.summary.trim(),
          approach: lines(f.approach),
          resources: list(f.resources),
          fundingNeeded: Math.max(0, Number(f.funding.replace(/[^0-9]/g, "")) || 0),
          skills: list(f.skills),
          timeline: f.timeline.trim(),
          expectedOutcome: f.outcome.trim(),
          evidence: lines(f.evidence),
        },
      });
      revalidate("/api/solutions", `/api/posts/${problem.id}`, "feed", "/api/explore", "/api/me/activity");
      onClose();
      actions.toast("Solution Card published");
      router.push(`/solution/${s.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      icon={<Lightbulb className="size-5" />}
      title="Propose a Solution Card"
      subtitle={<span className="line-clamp-1">For: {problem.title ?? problem.text}</span>}
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button disabled={!valid || busy} onClick={publish} className="btn btn-blue">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Publish Solution Card"}
          </button>
        </>
      }
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Solution title" hint="8+ characters" className="sm:col-span-2">
          <input value={f.title} onChange={up("title")} maxLength={160} className="input" placeholder="Name the approach in one line" />
        </Field>
        <Field label="Summary" hint="20+ characters" className="sm:col-span-2">
          <textarea value={f.summary} onChange={up("summary")} rows={2} maxLength={1000} className="input" placeholder="What is the approach in two sentences?" />
        </Field>
        <Field label="Steps" hint="One per line">
          <textarea value={f.approach} onChange={up("approach")} rows={4} className="input" placeholder="First step&#10;Second step&#10;Third step" />
        </Field>
        <Field label="Supporting evidence" hint="One per line">
          <textarea value={f.evidence} onChange={up("evidence")} rows={4} className="input" placeholder="Data, sources or past results" />
        </Field>
        <Field label="Resources required" hint="Comma separated">
          <input value={f.resources} onChange={up("resources")} className="input" placeholder="Materials, space, tools" />
        </Field>
        <Field label="People & skills needed" hint="Comma separated">
          <input value={f.skills} onChange={up("skills")} className="input" placeholder="Roles people can join" />
        </Field>
        <Field label="Approximate funding (₹)" hint="0 if none">
          <input value={f.funding} onChange={up("funding")} inputMode="numeric" className="input" placeholder="0" />
        </Field>
        <Field label="Estimated time">
          <input value={f.timeline} onChange={up("timeline")} maxLength={80} className="input" placeholder="e.g. 6 weeks" />
        </Field>
        <Field label="Expected outcome" hint="10+ characters" className="sm:col-span-2">
          <textarea value={f.outcome} onChange={up("outcome")} rows={2} maxLength={1000} className="input" placeholder="What will be measurably better?" />
        </Field>
      </div>
      <ErrorLine text={error} />
    </Modal>
  );
}
