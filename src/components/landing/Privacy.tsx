"use client";

import { useState } from "react";
import { BadgeCheck, EyeOff, HandHelping, HeartHandshake, ShieldCheck } from "lucide-react";

const PROMISES = [
  { icon: EyeOff, t: "Your email stays private", d: "It is used to sign in and for account messages. It is never shown to other members and cannot be searched." },
  { icon: BadgeCheck, t: "Verified means verified", d: "The licensed-professional badge appears only after a RUHIZ moderator checks the person's registration." },
  { icon: HeartHandshake, t: "Clear about what support is", d: "Peer supporters are community members, not clinicians. Crisis-line details are always shown next to support." },
  { icon: HandHelping, t: "You control what you share", d: "Edit or delete your posts, choose who can message you, hide from code search, or delete your account and everything in it." },
];

export function Privacy() {
  const [mode, setMode] = useState<"saver" | "revealer">("saver");

  return (
    <section id="privacy" className="l-section" aria-labelledby="privacy-title">
      <div className="l-wrap grid items-start gap-14 lg:grid-cols-2">
        <div>
          <span className="l-eyebrow" data-reveal><i /> Privacy &amp; safety</span>
          <h2 id="privacy-title" className="l-h2 l-display mt-5" data-reveal>
            Share honestly without <span className="l-grad">exposing yourself</span>.
          </h2>
          <p className="l-lead mt-5" data-reveal>
            Your public identity on RUHIZ is a code. You decide, post by post, whether a name and role go with it. Try it.
          </p>

          <div className="l-glass mt-8 p-6" data-reveal>
            <div className="l-switch" role="group" aria-label="Identity mode">
              <button type="button" aria-pressed={mode === "saver"} onClick={() => setMode("saver")}>Identity Saver</button>
              <button type="button" aria-pressed={mode === "revealer"} onClick={() => setMode("revealer")}>Identity Revealer</button>
            </div>
            <div className="mt-6 rounded-2xl border border-[var(--l-line)] bg-black/25 p-5" aria-live="polite">
              <div key={mode} className="l-id l-id-enter">
                {mode === "saver" ? (
                  <>
                    <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-[#2f6bff] to-[#0b1f66] text-white"><ShieldCheck className="size-6" /></span>
                    <div>
                      <p className="code-font text-xl font-bold text-white">#A1B2C3</p>
                      <p className="text-[0.84rem] text-[var(--l-muted)]">Identity Saver. Your real-world identity is protected.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-[#f59e0b] to-[#b45309] text-white"><BadgeCheck className="size-6" /></span>
                    <div>
                      <p className="text-xl font-bold text-white">Your name <span className="code-font text-base font-semibold text-[var(--l-muted)]">· #A1B2C3</span></p>
                      <p className="text-[0.84rem] text-[var(--l-muted)]">Identity Revealer. Your role and reputation travel with what you share.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="mt-4 text-[0.78rem] text-[var(--l-muted)]">The code shown here is only an example of the format.</p>
          </div>
        </div>

        <ul className="space-y-4">
          {PROMISES.map(({ icon: Icon, t, d }) => (
            <li key={t} className="l-glass flex gap-4 p-5" data-reveal>
              <span className="l-ico !mb-0 shrink-0" style={{ ["--ic" as string]: "#7dd3fc" }}><Icon className="size-5" /></span>
              <div>
                <h3 className="l-display text-[1.05rem] font-bold text-white">{t}</h3>
                <p className="mt-1 text-[0.92rem] leading-relaxed text-[var(--l-ink2)]">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
