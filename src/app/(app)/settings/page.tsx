"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { BadgeCheck, Bell, Clock, Globe, HeartHandshake, Loader2, LogOut, Palette, RotateCcw, Shield, Trash, UserRound, type LucideIcon } from "lucide-react";
import type { Me, MySupportListing, Settings } from "@/lib/types";
import { SUPPORT_AREAS } from "@/lib/meta";
import { DEFAULT_SETTINGS, SUPPORT_LANGUAGES } from "@/lib/settings";
import { api, revalidate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMe, useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";
import { UserCode } from "@/components/ui/UserCode";
import { Field, Segmented, Toggle } from "@/components/ui/Primitives";
import { IdentityPicker } from "@/components/feed/IdentityPicker";

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "identity", label: "Identity & Privacy", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "support", label: "Emotional Support", icon: HeartHandshake },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "language", label: "Language & Region", icon: Globe },
];

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[0.9rem] font-semibold text-ink">{title}</p>
        {desc && <p className="mt-0.5 text-[0.8rem] leading-snug text-muted">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ id, title, desc, children }: { id: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-5">
      <h2 className="section-title text-[1.05rem]">{title}</h2>
      <p className="mt-0.5 text-[0.84rem] text-muted">{desc}</p>
      <div className="mt-3 divide-y divide-line">{children}</div>
    </section>
  );
}

function RevealedFields() {
  const me = useMe();
  const { actions } = useStore();
  const [name, setName] = useState(me.revealedName);
  const [role, setRole] = useState(me.revealedRole);
  const [busy, setBusy] = useState(false);
  const dirty = name !== me.revealedName || role !== me.revealedRole;
  const save = async () => {
    setBusy(true);
    try {
      actions.setMe(await api<Me>("/api/me", { method: "PATCH", body: { revealedName: name.trim(), revealedRole: role.trim() } }));
      actions.toast("Saved");
    } catch (e) {
      actions.toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-3 py-3.5 sm:grid-cols-2">
      <Field label="Name shown in Identity Revealer">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input" />
      </Field>
      <Field label="Role / credential">
        <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} className="input" />
      </Field>
      <p className="text-[0.76rem] text-faint sm:col-span-1">Shown only on content you post as Identity Revealer. Never searchable.</p>
      <div className="flex justify-end sm:col-span-1">
        <button onClick={save} disabled={!dirty || busy} className="btn btn-blue btn-sm">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}

function SupportSection() {
  const { actions } = useStore();
  const { data, mutate, isLoading } = useSWR<MySupportListing>("/api/me/support-listing");
  const [form, setForm] = useState<MySupportListing | null>(null);
  const [cred, setCred] = useState({ credentialType: "", issuingBody: "", registrationNumber: "" });
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading || !form) return <p className="py-6 text-[0.86rem] text-muted">Loading…</p>;

  const save = async (next: MySupportListing) => {
    setBusy("listing");
    try {
      const saved = await api<MySupportListing>("/api/me/support-listing", {
        method: "PUT",
        body: { listed: next.listed, areas: next.areas, description: next.description, languages: next.languages, hours: next.hours, approach: next.approach, availability: next.availability },
      });
      mutate(saved, { revalidate: false });
      revalidate("/api/support-directory");
      actions.toast(saved.listed ? "Your supporter listing is saved" : "You're not listed as a supporter", saved.listed ? "success" : "info");
    } catch (e) {
      actions.toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setBusy("cred");
    try {
      mutate(await api<MySupportListing>("/api/me/support-listing", { method: "POST", body: cred }), { revalidate: false });
      actions.toast("Application submitted. A moderator will review it.");
    } catch (e) {
      actions.toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const set = (p: Partial<MySupportListing>) => setForm((f) => (f ? { ...f, ...p } : f));
  const toggleIn = (k: "areas" | "languages", v: string) => set({ [k]: form[k].includes(v) ? form[k].filter((x) => x !== v) : [...form[k], v] } as Partial<MySupportListing>);
  const c = data?.credential;

  return (
    <>
      <Row title="List me as a peer supporter" desc="You'll appear on the Emotional Support page with your code only. You are not expected to act as a professional.">
        <Toggle on={form.listed} onChange={(v) => set({ listed: v })} label="Peer supporter listing" />
      </Row>
      <div className={cn("space-y-3 py-3.5 transition-opacity", !form.listed && "opacity-60")}>
        <div>
          <p className="mb-2 text-[0.86rem] font-semibold text-ink">Areas I'm comfortable supporting</p>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORT_AREAS.map((a) => (
              <button key={a} onClick={() => toggleIn("areas", a)} data-on={form.areas.includes(a)} className="chip h-8 text-[0.78rem]">
                {a}
              </button>
            ))}
          </div>
        </div>
        <Field label="Short description" hint={`${form.description.length}/500`}>
          <textarea value={form.description} onChange={(e) => set({ description: e.target.value.slice(0, 500) })} rows={2} className="input" placeholder="What you've lived through or how you like to listen." />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Hours">
            <input value={form.hours} onChange={(e) => set({ hours: e.target.value })} maxLength={80} className="input" placeholder="e.g. Evenings 7–10 PM" />
          </Field>
          <Field label="Approach">
            <input value={form.approach} onChange={(e) => set({ approach: e.target.value })} maxLength={200} className="input" placeholder="e.g. Listening first" />
          </Field>
          <Field label="Availability">
            <select value={form.availability} onChange={(e) => set({ availability: e.target.value as MySupportListing["availability"] })} className="input">
              <option value="available">Available</option>
              <option value="busy">Limited</option>
              <option value="away">Away</option>
            </select>
          </Field>
        </div>
        <div>
          <p className="mb-2 text-[0.86rem] font-semibold text-ink">Languages</p>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORT_LANGUAGES.map((l) => (
              <button key={l} onClick={() => toggleIn("languages", l)} data-on={form.languages.includes(l)} className="chip h-8 text-[0.78rem]">
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={() => save(form)} disabled={busy === "listing" || (form.listed && form.areas.length === 0)} className="btn btn-blue btn-sm">
            {busy === "listing" ? <Loader2 className="size-4 animate-spin" /> : "Save listing"}
          </button>
        </div>
      </div>

      <div className="py-3.5">
        <p className="flex items-center gap-2 text-[0.9rem] font-semibold text-ink">
          <BadgeCheck className="size-4 text-amber-300" /> Licensed professional verification
        </p>
        <p className="mt-0.5 text-[0.8rem] leading-snug text-muted">Psychologists, therapists and licensed counsellors can apply. The professional badge appears only after a RUHIZ moderator verifies your registration.</p>
        {c && (
          <div className={cn("mt-3 rounded-lg border px-3 py-2 text-[0.82rem]", c.status === "verified" ? "border-emerald-400/25 bg-emerald-500/[.08] text-emerald-100" : c.status === "rejected" ? "border-rose-400/25 bg-rose-500/[.08] text-rose-100" : "border-amber-400/25 bg-amber-500/[.08] text-amber-100")}>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              {c.status === "pending" && <Clock className="size-3.5" />}
              {c.status === "verified" ? "Verified" : c.status === "rejected" ? "Not approved" : "Pending review"}
            </span>{" "}
            · {c.type}, {c.issuingBody} ({c.registrationNumber}){c.reviewNote ? ` · ${c.reviewNote}` : ""}
          </div>
        )}
        {c?.status !== "verified" && c?.status !== "pending" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Credential">
              <input value={cred.credentialType} onChange={(e) => setCred({ ...cred, credentialType: e.target.value })} maxLength={80} className="input" placeholder="e.g. Clinical Psychologist" />
            </Field>
            <Field label="Issuing body">
              <input value={cred.issuingBody} onChange={(e) => setCred({ ...cred, issuingBody: e.target.value })} maxLength={120} className="input" placeholder="e.g. RCI" />
            </Field>
            <Field label="Registration number">
              <input value={cred.registrationNumber} onChange={(e) => setCred({ ...cred, registrationNumber: e.target.value })} maxLength={60} className="input" />
            </Field>
            <div className="flex justify-end sm:col-span-3">
              <button onClick={apply} disabled={busy === "cred" || Object.values(cred).some((v) => v.trim().length < 2)} className="btn btn-outline btn-sm">
                {busy === "cred" ? <Loader2 className="size-4 animate-spin" /> : "Submit for verification"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function SettingsPage() {
  const { state, actions } = useStore();
  const me = useMe();
  const s = me.settings;
  const set = (p: Partial<Settings>) => actions.updateSettings(p);
  const [active, setActive] = useState("account");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 150);
    const obs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-30% 0px -60% 0px" });
    SECTIONS.forEach((x) => {
      const el = document.getElementById(x.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const notifyRows: { k: keyof Settings["notify"]; t: string; d: string }[] = [
    { k: "supports", t: "Supports", d: "When someone supports your posts or solutions, or becomes your Supporter." },
    { k: "responses", t: "Responses", d: "Replies, counterarguments and questions on what you shared." },
    { k: "solutions", t: "Solutions and progress", d: "New Solution Cards and status changes on problems you're involved in." },
    { k: "help", t: "Offers of help", d: "When someone offers help on your problems." },
    { k: "messages", t: "Messages", d: "New direct messages." },
  ];

  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="section-title text-[1.5rem]">Settings</h1>
      <p className="mt-1 text-[0.9rem] text-muted">Changes are saved to your account.</p>

      <div className="mt-5 grid gap-5 md:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="no-scrollbar flex gap-1 overflow-x-auto md:sticky md:top-24 md:flex-col md:self-start">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                setActive(id);
              }}
              className={cn("flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-[0.86rem] font-medium transition-colors", active === id ? "border-brand/45 bg-brand/[.12] text-white" : "border-transparent text-ink-2 hover:bg-white/[.04]")}
            >
              <Icon className="size-4" /> {label}
            </a>
          ))}
        </nav>

        <div className="space-y-4">
          <Section id="account" title="Account" desc="Your RUHIZ code is permanent and is how people find you.">
            <div className="flex flex-wrap items-center gap-4 py-3.5">
              <Avatar code={me.code} src={me.avatarUrl} size="xl" />
              <div className="min-w-0 flex-1">
                <UserCode code={me.code} size="lg" copy link={false} />
                <p className="truncate text-[0.8rem] text-muted">Signed in as {me.email}. Your email is private and never shown to others.</p>
              </div>
              <button onClick={() => actions.openModal({ type: "editProfile" })} className="btn btn-outline btn-sm">
                Edit profile
              </button>
            </div>
            <Row title="Log out" desc="Sign out on this device.">
              <button onClick={() => actions.openModal({ type: "logout" })} className="btn btn-outline btn-sm">
                <LogOut className="size-4" /> Log Out
              </button>
            </Row>
            <Row title="Delete account" desc="Permanently delete your account and everything you've shared.">
              <button onClick={() => actions.openModal({ type: "deleteAccount" })} className="btn btn-outline btn-sm text-rose-300">
                <Trash className="size-4" /> Delete
              </button>
            </Row>
          </Section>

          <Section id="identity" title="Identity & Privacy" desc="Choose how much of your real-world identity you share. You can change it for every post.">
            <div className="py-3.5">
              <p className="mb-2 text-[0.9rem] font-semibold text-ink">Default identity for new posts</p>
              <IdentityPicker value={s.defaultIdentity} onChange={(v) => set({ defaultIdentity: v })} />
            </div>
            <RevealedFields />
            <Row title="Who can message you" desc="Applies to new conversations.">
              <select value={s.messagesFrom} onChange={(e) => set({ messagesFrom: e.target.value as Settings["messagesFrom"] })} className="input h-9 w-auto text-[0.84rem]">
                <option value="everyone">Everyone</option>
                <option value="supporters">Only my Supporters</option>
                <option value="none">No one</option>
              </select>
            </Row>
            <Row title="Show when I'm online" desc="Others see a green dot on your avatar.">
              <Toggle on={s.showOnline} onChange={(v) => set({ showOnline: v })} label="Show online status" />
            </Row>
            <Row title="Allow people to find me by code" desc="Turn off to hide from code search and suggestions. Your profile link still works.">
              <Toggle on={s.allowCodeSearch} onChange={(v) => set({ allowCodeSearch: v })} label="Allow code search" />
            </Row>
          </Section>

          <Section id="notifications" title="Notifications" desc="Only what moves problems forward. No engagement bait.">
            {notifyRows.map((r) => (
              <Row key={r.k} title={r.t} desc={r.d}>
                <Toggle on={s.notify[r.k]} onChange={(v) => set({ notify: { ...s.notify, [r.k]: v } })} label={r.t} />
              </Row>
            ))}
          </Section>

          <Section id="support" title="Emotional Support" desc="Volunteer as a community peer supporter, or apply for verification as a licensed professional.">
            <SupportSection />
          </Section>

          <Section id="appearance" title="Appearance" desc="Adjust RUHIZ for comfort.">
            <Row title="Theme">
              <Segmented
                value={s.theme}
                onChange={(v) => set({ theme: v })}
                options={[
                  { id: "navy", label: "Navy" },
                  { id: "midnight", label: "Midnight" },
                ]}
              />
            </Row>
            <Row title="Text size">
              <Segmented
                value={s.textSize}
                onChange={(v) => set({ textSize: v })}
                options={[
                  { id: "sm", label: "Small" },
                  { id: "md", label: "Default" },
                  { id: "lg", label: "Large" },
                ]}
              />
            </Row>
            <Row title="Reduce motion" desc="Minimise animations and transitions.">
              <Toggle on={s.reduceMotion} onChange={(v) => set({ reduceMotion: v })} label="Reduce motion" />
            </Row>
            <Row title="Collapse left sidebar" desc="Show icons only. Also available from the header.">
              <Toggle on={state.ui.leftCollapsed} onChange={() => actions.toggleLeft()} label="Collapse sidebar" />
            </Row>
          </Section>

          <Section id="language" title="Language & Region" desc="Interface language is English for now. These preferences are saved for future localisation.">
            <Row title="Preferred language">
              <select value={s.language} onChange={(e) => set({ language: e.target.value })} className="input h-9 w-auto text-[0.84rem]">
                {SUPPORT_LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Row>
            <Row title="Region">
              <select value={s.region} onChange={(e) => set({ region: e.target.value })} className="input h-9 w-auto text-[0.84rem]">
                {["India", "Bangladesh", "Nepal", "Sri Lanka", "Pakistan", "United Kingdom", "United States", "Other"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Row>
            <Row title="Reset preferences" desc="Restore all settings on this page to their defaults.">
              <button onClick={() => (set(DEFAULT_SETTINGS), actions.toast("Settings restored to defaults", "info"))} className="btn btn-outline btn-sm">
                <RotateCcw className="size-4" /> Reset
              </button>
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}
