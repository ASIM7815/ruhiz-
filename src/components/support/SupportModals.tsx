"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Clock, Globe, HeartHandshake, LifeBuoy, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import type { SupportListing } from "@/lib/types";
import { api, revalidate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { UserCode } from "@/components/ui/UserCode";
import { Field } from "@/components/ui/Primitives";
import { Availability } from "./SupportCard";

export function CrisisNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/[.07] px-3 py-2 text-[0.76rem] leading-relaxed text-rose-100/90", className)}>
      <LifeBuoy className="mt-0.5 size-3.5 shrink-0 text-rose-300" />
      Community supporters are not emergency services. If you or someone else is in immediate danger, call 112, or Tele-MANAS on 14416 (India).
    </p>
  );
}

export function SupportProfileModal({ listing: p, onClose }: { listing: SupportListing; onClose: () => void }) {
  const { actions } = useStore();
  return (
    <Modal open onClose={onClose} size="md" title="Emotional support profile" icon={<HeartHandshake className="size-5" />}>
      <div className="flex items-start gap-4">
        <Avatar code={p.user.code} src={p.user.avatarUrl} size="xl" online={p.availability === "available"} />
        <div className="min-w-0 flex-1">
          <UserCode code={p.user.code} size="lg" copy verified={p.professional} />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Availability a={p.availability} />
            {p.professional ? (
              <span className="badge border-amber-400/30 bg-amber-500/10 text-amber-200">
                <BadgeCheck className="size-3" /> Verified professional
              </span>
            ) : (
              <span className="badge border-sky-400/25 bg-sky-500/10 text-sky-200">
                <ShieldCheck className="size-3" /> Community peer supporter
              </span>
            )}
          </div>
          {p.credential && <p className="mt-1.5 text-[0.76rem] text-amber-200/80">{p.credential} · verified by RUHIZ moderators</p>}
        </div>
      </div>
      {p.description && <p className="mt-4 text-[0.9rem] leading-relaxed text-ink-2">{p.description}</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="surface p-3">
          <p className="eyebrow">Approach</p>
          <p className="mt-1 text-[0.82rem] text-ink-2">{p.approach || "—"}</p>
        </div>
        <div className="surface p-3">
          <p className="eyebrow flex items-center gap-1">
            <Clock className="size-3" /> Hours
          </p>
          <p className="mt-1 text-[0.82rem] text-ink-2">{p.hours || "Flexible"}</p>
        </div>
        <div className="surface p-3">
          <p className="eyebrow flex items-center gap-1">
            <Globe className="size-3" /> Languages
          </p>
          <p className="mt-1 text-[0.82rem] text-ink-2">{p.languages.join(", ") || "—"}</p>
        </div>
      </div>
      <p className="eyebrow mb-2 mt-4">Comfortable supporting</p>
      <div className="flex flex-wrap gap-1.5">
        {p.areas.map((a) => (
          <span key={a} className="badge border-pink-400/25 bg-pink-500/10 text-pink-200">
            {a}
          </span>
        ))}
      </div>
      <CrisisNote className="mt-4" />
      <div className="mt-5 flex justify-end gap-2">
        <Link href={`/profile/${p.user.code}`} onClick={onClose} className="btn btn-ghost">
          View full profile
        </Link>
        {!p.isMe && (
          <button onClick={() => actions.openModal({ type: "requestSupport", listing: p })} disabled={p.availability === "away"} className="btn btn-red">
            <HeartHandshake className="size-4" /> Request support
          </button>
        )}
      </div>
    </Modal>
  );
}

export function RequestSupportModal({ listing: p, onClose }: { listing: SupportListing; onClose: () => void }) {
  const { actions } = useStore();
  const router = useRouter();
  const [topic, setTopic] = useState(p.areas[0] ?? "Something else");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/conversations", { body: { code: p.user.code, context: `Emotional support · ${topic}`, text: text.trim() } });
      revalidate("/api/conversations");
      onClose();
      actions.toast(`Message sent to #${p.user.code}`);
      router.push(`/messages?c=${id}`);
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
      size="md"
      icon={<MessageCircle className="size-5" />}
      title={`Reach out to #${p.user.code}`}
      subtitle="You'll start a private conversation. You appear only as your code."
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button disabled={text.trim().length < 3 || busy} onClick={send} className="btn btn-red">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Send"}
          </button>
        </>
      }
    >
      <p className="mb-2 text-[0.8rem] font-semibold text-ink-2">What would you like to talk about?</p>
      <div className="flex flex-wrap gap-1.5">
        {[...p.areas, "Something else"].map((a) => (
          <button key={a} onClick={() => setTopic(a)} data-on={topic === a} className="chip">
            {a}
          </button>
        ))}
      </div>
      <Field label="First message" className="mt-4">
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} rows={4} autoFocus className="input" placeholder="You don't need to explain everything. “Rough week, could use someone to talk to” is enough." />
      </Field>
      {error && <p className="mt-3 text-[0.84rem] text-rose-300">{error}</p>}
      <CrisisNote className="mt-3" />
    </Modal>
  );
}
