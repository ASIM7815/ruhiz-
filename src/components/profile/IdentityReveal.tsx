"use client";

import { useState } from "react";
import { BadgeCheck, CircleAlert, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import type { Me } from "@/lib/types";
import { api, revalidate } from "@/lib/api";
import { useMe, useStore } from "@/store/store";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Primitives";

/** Mirrors the server's identityReveal schema (src/server/schemas.ts) for instant feedback. The server re-validates. */
function validate(v: { name: string; role: string; description: string }) {
  const errors: Partial<Record<"name" | "role" | "description", string>> = {};
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  const line = (s: string, min: number, max: number, label: string) => {
    const c = clean(s);
    if (!c) return `${label} is required`;
    if (c.length < min) return `${label} must be at least ${min} characters`;
    if (c.length > max) return `${label} must be at most ${max} characters`;
    if (!/\p{L}/u.test(c)) return `${label} must contain letters`;
    return undefined;
  };
  errors.name = line(v.name, 2, 60, "Name");
  errors.role = line(v.role, 2, 80, "Role");
  const d = v.description.trim();
  errors.description = !d ? "Description is required" : d.length < 10 ? "Description must be at least 10 characters" : d.length > 280 ? "Description must be at most 280 characters" : !/\p{L}/u.test(d) ? "Description must contain letters" : undefined;
  return Object.fromEntries(Object.entries(errors).filter(([, e]) => e)) as typeof errors;
}

export function RevealIdentityModal({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const { actions } = useStore();
  const [name, setName] = useState(me.revealedName);
  const [role, setRole] = useState(me.revealedRole);
  const [description, setDescription] = useState(me.bio);
  const [confirm, setConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = validate({ name, role, description });
  const valid = Object.keys(errors).length === 0;
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  const submit = async () => {
    setTouched(true);
    if (!valid || !confirm || busy) return;
    setBusy(true);
    setError(null);
    try {
      actions.setMe(await api<Me>("/api/me/identity", { method: "PUT", body: { name, role, description, confirm: true } }));
      revalidate("/api/users", "feed", "/api/sidebar", "/api/explore", "/api/posts", "/api/contributions");
      actions.toast("Your identity is now visible to other members", "success");
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
      icon={<BadgeCheck className="size-5" />}
      title={me.identity === "revealer" ? "Update your revealed identity" : "Reveal your identity"}
      subtitle="All fields are required."
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={submit} disabled={busy || (touched && !valid) || !confirm} className="btn btn-blue">
            {busy ? <Loader2 className="size-4 animate-spin" /> : me.identity === "revealer" ? "Save and publish" : "Reveal my identity"}
          </button>
        </>
      }
    >
      <form
        className="space-y-3.5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/[.08] p-3 text-[0.84rem] leading-relaxed text-amber-50">
          <p className="font-semibold text-amber-200">What becomes visible</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>
              Your name, role, description, profile photo, banner, headline, area and expertise on your profile <span className="code-font">#{me.code}</span>.
            </li>
            <li>Your name on posts and replies you mark as Identity Revealer.</li>
            <li>Anyone who already knows your code will be able to connect it to your name.</li>
          </ul>
          <p className="mt-1.5">Posts and replies you made as Identity Saver stay anonymous: they will no longer show your code at all. You can hide your identity again at any time.</p>
        </div>
        <Field label="Name" hint={`${name.length}/60`} error={show("name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} maxLength={60} className="input" autoComplete="name" required aria-invalid={!!show("name")} />
        </Field>
        <Field label="Role or credential" hint={`${role.length}/80`} error={show("role")}>
          <input value={role} onChange={(e) => setRole(e.target.value)} onBlur={() => setTouched(true)} maxLength={80} className="input" placeholder="e.g. Civil engineer · Teacher · Student" required aria-invalid={!!show("role")} />
        </Field>
        <Field label="Description" hint={`${description.length}/280`} error={show("description")}>
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 280))} onBlur={() => setTouched(true)} rows={3} className="input" placeholder="A few words about you and what you care about." required aria-invalid={!!show("description")} />
        </Field>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-3 text-[0.84rem] text-ink-2">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand,#2f7bff)]" />
          <span>I understand that my identity and these profile details will be visible to other RUHIZ members.</span>
        </label>
        {error && (
          <p className="flex items-start gap-2 text-[0.84rem] text-rose-300" role="alert">
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

/** Identity status card for Settings: hidden by default; reveal (with consent) or hide again. */
export function IdentityStatusPanel() {
  const me = useMe();
  const { actions } = useStore();
  const [busy, setBusy] = useState(false);
  const revealed = me.identity === "revealer";

  const hide = () =>
    actions.openModal({
      type: "confirm",
      title: "Hide your identity?",
      text: "Your name, role, description, photo, banner and other profile details stop being visible to other members right away. Posts you made as Identity Revealer will show only your code.",
      confirmLabel: "Hide my identity",
      onConfirm: async () => {
        setBusy(true);
        try {
          actions.setMe(await api<Me>("/api/me/identity", { method: "DELETE" }));
          revalidate("/api/users", "feed", "/api/sidebar", "/api/explore", "/api/posts", "/api/contributions");
          actions.toast("Your identity is hidden", "success");
        } finally {
          setBusy(false);
        }
      },
    });

  return (
    <div className="py-3.5">
      <div className={revealed ? "rounded-xl border border-amber-400/30 bg-amber-500/[.07] p-3.5" : "rounded-xl border border-sky-400/25 bg-sky-500/[.07] p-3.5"}>
        <div className="flex flex-wrap items-start gap-3">
          {revealed ? <BadgeCheck className="mt-0.5 size-5 text-amber-300" /> : <ShieldCheck className="mt-0.5 size-5 text-sky-300" />}
          <div className="min-w-0 flex-1">
            <p className="text-[0.92rem] font-semibold text-ink">{revealed ? "Your identity is revealed" : "Your identity is hidden"}</p>
            <p className="mt-0.5 text-[0.82rem] leading-relaxed text-muted">
              {revealed ? (
                <>
                  Members see <b className="text-ink-2">{me.revealedName}</b> · {me.revealedRole} on your profile and on posts you mark as Identity Revealer
                  {me.revealedAt ? ` (since ${new Date(me.revealedAt).toLocaleDateString()})` : ""}.
                </>
              ) : (
                <>
                  Everyone sees only <span className="code-font">#{me.code}</span>. Your name, photo and profile details stay private, on every device and after every sign-in, until you choose to reveal them.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => actions.openModal({ type: "revealIdentity" })} disabled={busy} className="btn btn-blue btn-sm">
              {revealed ? "Update details" : "Reveal identity"}
            </button>
            {revealed && (
              <button onClick={hide} disabled={busy} className="btn btn-outline btn-sm">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <EyeOff className="size-4" />} Hide identity
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
