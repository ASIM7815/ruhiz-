"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Check, CircleAlert, Copy, Flag, HandCoins, Loader2, LogOut, MessageCircle, PenLine, Send, Share2, Trash, UserPlus, Users } from "lucide-react";
import type { ConversationSummary, HelpType, IdentityMode, Me, Member, Solution } from "@/lib/types";
import { HELP_TYPES } from "@/lib/meta";
import { api, revalidate } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { cn, formatINR, normalizeCode } from "@/lib/utils";
import { type ReportTarget, type ShareTarget, useMe, useStore } from "@/store/store";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Field, Tabs } from "@/components/ui/Primitives";
import { IdentityPicker } from "@/components/feed/IdentityPicker";
import { AvatarEditor } from "@/components/profile/AvatarEditor";

const ErrorLine = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[0.84rem] text-rose-200">
      <CircleAlert className="mt-0.5 size-4 shrink-0" /> {text}
    </p>
  ) : null;

/* ───────── Share ───────── */
export function ShareModal({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const { actions } = useStore();
  const { data: convs, isLoading } = useSWR<ConversationSummary[]>("/api/conversations");
  const [sent, setSent] = useState<string[]>([]);
  const path = target.kind === "post" ? `/post/${target.id}` : target.kind === "solution" ? `/solution/${target.id}` : `/profile/${target.id}`;
  const url = `${window.location.origin}${path}`;
  const record = (channel: "link" | "device") => target.kind === "post" && api(`/api/posts/${target.id}/share`, { body: { channel } }).catch(() => {});

  const send = async (convId: string) => {
    try {
      await api(`/api/conversations/${convId}`, {
        body: { text: target.kind === "profile" ? `Have a look at #${target.id}'s profile: ${url}` : "Thought you'd want to see this.", attachment: target.kind === "profile" ? undefined : { kind: target.kind, id: target.id } },
      });
      setSent((s) => [...s, convId]);
      revalidate("/api/conversations");
    } catch (e) {
      actions.toast((e as Error).message, "error");
    }
  };

  return (
    <Modal open onClose={onClose} icon={<Share2 className="size-5" />} title="Share" subtitle={<span className="line-clamp-1">{target.title}</span>}>
      <div className="flex gap-2">
        <input readOnly value={url} className="input code-font text-[0.8rem]" aria-label="Link" onFocus={(e) => e.currentTarget.select()} />
        <button
          onClick={() => {
            navigator.clipboard?.writeText(url).catch(() => {});
            record("link");
            actions.toast("Link copied", "info");
          }}
          className="btn btn-blue shrink-0"
        >
          <Copy className="size-4" /> Copy
        </button>
      </div>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <button onClick={() => navigator.share({ title: target.title, url }).then(() => record("device")).catch(() => {})} className="btn btn-outline mt-2 w-full">
          <Share2 className="size-4" /> Share via device
        </button>
      )}
      <p className="mt-3 text-[0.74rem] text-faint">Links open for signed-in RUHIZ members only.</p>
      <p className="eyebrow mb-2 mt-5">Send in Messages</p>
      {isLoading ? (
        <p className="text-[0.84rem] text-muted">Loading conversations…</p>
      ) : !convs?.length ? (
        <p className="text-[0.84rem] text-muted">You don't have any conversations yet.</p>
      ) : (
        <ul className="space-y-1">
          {convs.slice(0, 8).map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
              <Avatar code={c.with.code} src={c.with.avatarUrl} size="sm" />
              <span className="code-font flex-1 text-[0.86rem] font-semibold text-ink">#{c.with.code}</span>
              <button onClick={() => send(c.id)} disabled={sent.includes(c.id)} className="btn btn-outline btn-sm">
                {sent.includes(c.id) ? <Check className="size-3.5" /> : <Send className="size-3.5" />}
                {sent.includes(c.id) ? "Sent" : "Send"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ───────── Pledge ───────── */
export function PledgeModal({ solution: s, onClose }: { solution: Solution; onClose: () => void }) {
  const { actions } = useStore();
  const [amount, setAmount] = useState(1000);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = Math.max(0, s.funding.needed - s.funding.raised);
  const value = Math.min(custom ? Number(custom.replace(/[^0-9]/g, "")) : amount, remaining);

  const pledge = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/solutions/${s.id}/pledge`, { body: { amount: value } });
      revalidate(`/api/solutions/${s.id}`, "feed");
      actions.toast(`You pledged ${formatINR(value)}. No payment was taken.`);
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
      icon={<HandCoins className="size-5" />}
      title="Pledge support"
      subtitle={s.title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button disabled={!value || busy} onClick={pledge} className="btn btn-blue">
            {busy ? <Loader2 className="size-4 animate-spin" /> : `Pledge ${value ? formatINR(value) : ""}`}
          </button>
        </>
      }
    >
      <p className="text-[0.84rem] text-muted">{formatINR(remaining)} still needed.</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[500, 1000, 5000, 10000].map((a) => (
          <button key={a} onClick={() => (setAmount(a), setCustom(""))} data-on={!custom && amount === a} className="chip justify-center">
            {formatINR(a)}
          </button>
        ))}
      </div>
      <Field label="Custom amount (₹)" className="mt-3">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="numeric" className="input" placeholder="Enter an amount" />
      </Field>
      <p className="mt-3 rounded-lg bg-amber-500/[.08] px-3 py-2 text-[0.76rem] text-amber-200/90">A pledge is a public commitment to the solution's team. RUHIZ does not collect or process payments.</p>
      <ErrorLine text={error} />
    </Modal>
  );
}

/* ───────── Supporters / Supporting ───────── */
type PersonRow = Member & { supportedByMe: boolean; isMe: boolean };
export function PeopleModal({ code, list, onClose }: { code: string; list: "supporters" | "supporting"; onClose: () => void }) {
  const { actions } = useStore();
  const [tab, setTab] = useState(list);
  const { data, error, isLoading, mutate } = useSWR<PersonRow[]>(`/api/users/${code}/people?list=${tab}`);

  const toggle = async (p: PersonRow) => {
    try {
      await api(`/api/users/${p.code}/support`, { method: p.supportedByMe ? "DELETE" : "POST" });
      mutate();
      revalidate("/api/me", "/api/users");
    } catch (e) {
      actions.toast((e as Error).message, "error");
    }
  };

  return (
    <Modal open onClose={onClose} icon={<Users className="size-5" />} title={`#${code}`} size="sm" bodyClassName="px-2 pt-0">
      <Tabs
        className="sticky top-0 z-10 bg-[var(--card-solid)] px-3"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "supporters", label: "Supporters" },
          { id: "supporting", label: "Supporting" },
        ]}
      />
      {isLoading ? (
        <p className="p-6 text-center text-[0.84rem] text-muted">Loading…</p>
      ) : error ? (
        <p className="p-6 text-center text-[0.84rem] text-rose-300">{error.message}</p>
      ) : !data?.length ? (
        <p className="p-6 text-center text-[0.84rem] text-muted">{tab === "supporters" ? "No Supporters yet." : "Not supporting anyone yet."}</p>
      ) : (
        <ul className="py-2">
          {data.map((p) => (
            <li key={p.code} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[.03]">
              <Link href={`/profile/${p.code}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar code={p.code} src={p.avatarUrl} size="md" online={p.online} />
                <span className="min-w-0">
                  <span className="code-font block font-semibold text-ink">#{p.code}</span>
                  <span className="block truncate text-[0.76rem] text-muted">{p.headline || "RUHIZ member"}</span>
                </span>
              </Link>
              {!p.isMe && (
                <button onClick={() => toggle(p)} data-on={p.supportedByMe} className="btn btn-support btn-sm">
                  {p.supportedByMe ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
                  {p.supportedByMe ? "Supporting" : "Support"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ───────── Edit profile ───────── */
export function EditProfileModal({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const { actions } = useStore();
  const [headline, setHeadline] = useState(me.headline);
  const [bio, setBio] = useState(me.bio);
  const [location, setLocation] = useState(me.location);
  const [expertise, setExpertise] = useState(me.expertise.join(", "));
  const [help, setHelp] = useState<HelpType[]>(me.canHelpWith);
  const [avatar, setAvatar] = useState<{ id: string | null } | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await api<Me>("/api/me", {
        method: "PATCH",
        body: {
          headline,
          bio,
          location,
          expertise: expertise.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12),
          canHelpWith: help,
          ...(avatar !== undefined ? { avatarMediaId: avatar.id } : {}),
        },
      });
      actions.setMe(next);
      revalidate("/api/users", "feed", "/api/sidebar");
      actions.toast("Profile updated");
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
      size="lg"
      icon={<PenLine className="size-5" />}
      title="Edit profile"
      subtitle={`Your code #${me.code} is permanent and is how people find you.`}
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={save} disabled={busy} className="btn btn-blue">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        {me.identity !== "revealer" && (
          <p className="rounded-xl border border-sky-400/25 bg-sky-500/[.07] px-3 py-2 text-[0.8rem] leading-relaxed text-sky-100">
            Your identity is hidden, so your photo, headline, bio, area and expertise are visible only to you. They appear to others only if you reveal your identity in Settings.
          </p>
        )}
        <AvatarEditor code={me.code} currentUrl={me.avatarUrl} identity={me.identity} onChange={(id) => setAvatar({ id })} />
        <Field label="Headline" hint={`${headline.length}/80`}>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="input" maxLength={80} placeholder="e.g. Civil engineering student · Water access" />
        </Field>
        <Field label="Bio" hint={`${bio.length}/280`}>
          <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 280))} rows={3} className="input" placeholder="What you care about and what you can help with." />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Area" hint="Used for Nearby">
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} className="input" placeholder="City or neighbourhood" />
          </Field>
          <Field label="Expertise" hint="Comma separated">
            <input value={expertise} onChange={(e) => setExpertise(e.target.value)} className="input" />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">I can help with</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(HELP_TYPES) as HelpType[]).map((t) => {
              const on = help.includes(t);
              const Icon = HELP_TYPES[t].icon;
              return (
                <button key={t} onClick={() => setHelp((h) => (on ? h.filter((x) => x !== t) : [...h, t]))} data-on={on} className="chip">
                  <Icon className="size-3.5" /> {HELP_TYPES[t].label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
          <span className="text-[0.82rem] text-ink-2">
            Identity: <b className="text-ink">{me.identity === "revealer" ? `Revealed as ${me.revealedName}` : "Hidden (Identity Saver)"}</b>
          </span>
          <button type="button" onClick={() => actions.openModal({ type: "revealIdentity" })} className="btn btn-outline btn-sm">
            {me.identity === "revealer" ? "Update identity" : "Reveal identity"}
          </button>
        </div>
        <ErrorLine text={error} />
      </div>
    </Modal>
  );
}

/* ───────── New message ───────── */
export function NewMessageModal({ initialCode, onClose }: { initialCode?: string; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState(initialCode ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = normalizeCode(q);
  const { data: matches = [] } = useSWR<(Member & { isMe: boolean })[]>(code ? `/api/users/search?q=${code}` : null);
  const exact = matches.find((m) => m.code === code && !m.isMe);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/conversations", { body: { code, text: text.trim() || undefined } });
      revalidate("/api/conversations", "/api/me/counts");
      onClose();
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
      size="sm"
      icon={<MessageCircle className="size-5" />}
      title="New message"
      subtitle="Start a conversation using someone's code."
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button disabled={!exact || busy} onClick={open} className="btn btn-blue">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Open conversation"}
          </button>
        </>
      }
    >
      <Field label="Recipient code">
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus className="input code-font" placeholder="#A1B2C3" maxLength={8} />
      </Field>
      {!exact && matches.filter((m) => !m.isMe).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {matches
            .filter((m) => !m.isMe)
            .slice(0, 5)
            .map((m) => (
              <button key={m.code} onClick={() => setQ(m.code)} className="chip code-font">
                <Avatar code={m.code} src={m.avatarUrl} size="xs" /> #{m.code}
              </button>
            ))}
        </div>
      )}
      {code.length === 6 && !exact && matches.length === 0 && <p className="mt-2 text-[0.8rem] text-rose-300">No user found with code #{code}.</p>}
      {exact && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-black/15 p-2.5">
          <Avatar code={exact.code} src={exact.avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="code-font font-semibold text-ink">#{exact.code}</p>
            <p className="truncate text-[0.76rem] text-muted">{exact.headline || "RUHIZ member"}</p>
          </div>
        </div>
      )}
      <Field label="Message (optional)" className="mt-3">
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} rows={3} className="input" placeholder="Say hello…" />
      </Field>
      <ErrorLine text={error} />
    </Modal>
  );
}

/* ───────── Report ───────── */
const REASONS = [
  { id: "spam", label: "Spam or scam" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hate speech" },
  { id: "self-harm", label: "Self-harm or someone at risk" },
  { id: "misinformation", label: "Harmful misinformation" },
  { id: "privacy", label: "Shares private information" },
  { id: "other", label: "Something else" },
] as const;

export function ReportModal({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const { actions } = useStore();
  const [reason, setReason] = useState<(typeof REASONS)[number]["id"] | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/reports", { body: { target: target.target, id: target.id, reason, details: details.trim() || undefined } });
      actions.toast("Thanks. A moderator will review this.", "info");
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
      size="sm"
      icon={<Flag className="size-5 text-rose-300" />}
      title="Report"
      subtitle={<span className="line-clamp-1">{target.label}</span>}
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button disabled={!reason || busy} onClick={submit} className="btn btn-red">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Send report"}
          </button>
        </>
      }
    >
      <div className="space-y-1.5" role="radiogroup">
        {REASONS.map((r) => (
          <button key={r.id} role="radio" aria-checked={reason === r.id} onClick={() => setReason(r.id)} className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-[0.86rem]", reason === r.id ? "border-accent/50 bg-accent/[.08] text-ink" : "border-line text-ink-2 hover:border-line-strong")}>
            <span className={cn("size-3.5 rounded-full border-2", reason === r.id ? "border-accent bg-accent" : "border-line-strong")} />
            {r.label}
          </button>
        ))}
      </div>
      {reason === "self-harm" && (
        <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/[.07] px-3 py-2 text-[0.78rem] text-rose-100/90">If someone is in immediate danger, contact local emergency services (112 in India) or Tele-MANAS on 14416.</p>
      )}
      <Field label="Details (optional)" className="mt-3">
        <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} rows={2} className="input" />
      </Field>
      <ErrorLine text={error} />
    </Modal>
  );
}

/* ───────── Generic confirm ───────── */
export function ConfirmModal({ title, text, confirmLabel, danger, requireReason, onConfirm, onClose }: { title: string; text: string; confirmLabel: string; danger?: boolean; requireReason?: boolean; onConfirm: (reason: string) => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={title}
      icon={danger ? <Trash className="size-5 text-rose-300" /> : undefined}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className="btn btn-ghost">
            Cancel
          </button>
          <button
            disabled={busy || (requireReason && reason.trim().length < 3)}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm(reason.trim());
                onClose();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
            className={cn("btn", danger ? "btn-red" : "btn-blue")}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[0.88rem] leading-relaxed text-ink-2">{text}</p>
      {requireReason && (
        <Field label="Reason (recorded in the moderation log)" className="mt-3">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="input" autoFocus />
        </Field>
      )}
      <ErrorLine text={error} />
    </Modal>
  );
}

/* ───────── Delete own account ───────── */
export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = normalizeCode(confirm) === me.code;

  const del = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/me", { method: "DELETE", body: { confirm: me.code } });
      await authClient.signOut().catch(() => {});
      window.location.href = "/?deleted=1";
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      icon={<Trash className="size-5 text-rose-300" />}
      title="Delete your account"
      footer={
        <>
          <button onClick={onClose} disabled={busy} className="btn btn-ghost">
            Cancel
          </button>
          <button disabled={!ok || busy} onClick={del} className="btn btn-red">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Delete my account"}
          </button>
        </>
      }
    >
      <p className="text-[0.88rem] leading-relaxed text-ink-2">
        This permanently deletes your account and everything you've shared: your profile, posts, photos and videos, contributions, Solution Cards, offers of help, messages and activity history. This can't be undone.
      </p>
      <Field label={`Type your code #${me.code} to confirm`} className="mt-4">
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input code-font" placeholder={`#${me.code}`} autoFocus />
      </Field>
      <ErrorLine text={error} />
    </Modal>
  );
}

/* ───────── Logout ───────── */
export function LogoutModal({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    await authClient.signOut().catch(() => {});
    window.location.href = "/";
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      icon={<LogOut className="size-5 text-rose-300" />}
      title="Log out of RUHIZ?"
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Stay
          </button>
          <button onClick={signOut} disabled={busy} className="btn btn-red">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Log Out"}
          </button>
        </>
      }
    >
      <p className="text-[0.86rem] leading-relaxed text-muted">You'll need your email and password (or Google) to sign back in.</p>
    </Modal>
  );
}
