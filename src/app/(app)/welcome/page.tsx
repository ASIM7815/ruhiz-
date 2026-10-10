"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import type { CategoryId, HelpType, IdentityMode, Me } from "@/lib/types";
import { CATEGORIES, HELP_TYPES } from "@/lib/meta";
import { api, revalidate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMe, useStore } from "@/store/store";
import { Field } from "@/components/ui/Primitives";
import { IdentityPicker } from "@/components/feed/IdentityPicker";
import { AvatarEditor } from "@/components/profile/AvatarEditor";
import { UserCode } from "@/components/ui/UserCode";

/** First-run profile setup. Every field is optional; topics seed the For You feed. */
export default function WelcomePage() {
  const me = useMe();
  const { actions } = useStore();
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [headline, setHeadline] = useState(me.headline);
  const [location, setLocation] = useState(me.location);
  const [bio, setBio] = useState(me.bio);
  const [identity, setIdentity] = useState<IdentityMode>(me.identity);
  const [interests, setInterests] = useState<CategoryId[]>([]);
  const [help, setHelp] = useState<HelpType[]>(me.canHelpWith);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (skip = false) => {
    setBusy(true);
    setError(null);
    try {
      const next = await api<Me>("/api/me/onboarding", {
        body: skip ? {} : { headline: headline.trim(), location: location.trim(), bio: bio.trim(), identity, interests, canHelpWith: help, ...(avatar ? { avatarMediaId: avatar } : {}) },
      });
      actions.setMe(next);
      revalidate("feed", "/api/sidebar");
      router.push("/home");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      <div className="card p-5 sm:p-7">
        <p className="eyebrow !text-brand-ink">Welcome to RUHIZ</p>
        <h1 className="section-title mt-1.5 text-[1.6rem]">Set up your profile</h1>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-2">
          Your public identity is your code <UserCode code={me.code} size="md" link={false} />. People find you by it. Your email and name are never shown or searchable. Everything below is optional and can be changed later.
        </p>
      </div>

      <div className="card space-y-5 p-5 sm:p-6">
        <AvatarEditor code={me.code} currentUrl={me.avatarUrl} identity={identity} onChange={(id) => setAvatar(id)} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Headline">
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} className="input" placeholder="e.g. Teacher · Student mental health" />
          </Field>
          <Field label="Your area" hint="Used for Nearby">
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} className="input" placeholder="City or neighbourhood" />
          </Field>
        </div>
        <Field label="Bio" hint={`${bio.length}/280`}>
          <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 280))} rows={2} className="input" />
        </Field>

        <div>
          <p className="mb-2 text-[0.86rem] font-semibold text-ink">Topics you care about</p>
          <p className="mb-2 text-[0.78rem] text-muted">These shape your For You feed from day one.</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATEGORIES) as CategoryId[]).map((id) => {
              const c = CATEGORIES[id];
              const Icon = c.icon;
              const on = interests.includes(id);
              return (
                <button key={id} onClick={() => setInterests((x) => (on ? x.filter((y) => y !== id) : [...x, id]))} data-on={on} className="chip">
                  {on ? <Check className="size-3.5" /> : <Icon className={cn("size-3.5", c.tone.text)} />} {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[0.86rem] font-semibold text-ink">What could you help others with?</p>
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

        <Field label="Profile identity mode">
          <IdentityPicker value={identity} onChange={setIdentity} />
        </Field>

        {error && <p className="text-[0.84rem] text-rose-300">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <button onClick={() => finish(true)} disabled={busy} className="btn btn-ghost">
            Skip for now
          </button>
          <button onClick={() => finish(false)} disabled={busy} className="btn btn-red">
            {busy ? <Loader2 className="size-4 animate-spin" /> : (
              <>
                Continue <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
