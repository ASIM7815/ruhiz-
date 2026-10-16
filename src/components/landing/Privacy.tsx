"use client";

import { useState } from "react";
import { BadgeCheck, EyeOff, HandHelping, HeartHandshake, ShieldCheck, UserCheck } from "lucide-react";

const PROMISES = [
  { icon: EyeOff, t: "Ask without fear of judgment", d: "Your questions about \"basic concepts\" won't follow you. Placement rejections stay anonymous. Your struggles remain private until you're ready to own them publicly." },
  { icon: UserCheck, t: "Build your reputation when ready", d: "Switch to Identity Revealer to showcase projects, help others publicly, and build a portfolio that recruiters can see. Your choice, your timeline." },
  { icon: HeartHandshake, t: "Real support, clear boundaries", d: "Peer supporters are students like you, not therapists. Professional mentors have verified credentials. Crisis resources are always visible." },
  { icon: HandHelping, t: "You're in control", d: "Edit or delete posts anytime. Choose who can message you. Hide your profile from search. Or delete everything and start fresh—no questions asked." },
];

export function Privacy() {
  const [mode, setMode] = useState<"saver" | "revealer">("saver");

  return (
    <section id="privacy" className="l-section" aria-labelledby="privacy-title">
      <div className="l-wrap grid items-start gap-14 lg:grid-cols-2">
        <div>
          <span className="l-eyebrow" data-reveal><i /> Privacy & Control</span>
          <h2 id="privacy-title" className="l-h2 l-display mt-5" data-reveal>
            Ask anything. <span className="l-grad">No one needs to know</span> it was you.
          </h2>
          <p className="l-lead mt-5" data-reveal>
            Your public identity is just a code. No one at your college will know you asked that "stupid question"—unless you choose to reveal yourself and take credit for the answer.
          </p>

          <div className="l-glass mt-8 p-6" data-reveal>
            <p className="mb-4 text-[0.85rem] font-medium text-white">Choose your mode:</p>
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
                      <p className="code-font text-xl font-bold text-white">#K4M2N7</p>
                      <p className="mt-1 text-[0.84rem] text-[var(--l-muted)]">Identity Saver · Ask anything without revealing yourself</p>
                      <ul className="mt-3 space-y-1 text-[0.8rem] text-sky-300">
                        <li>✓ Ask "dumb" questions safely</li>
                        <li>✓ Share placement rejections honestly</li>
                        <li>✓ Discuss salary without revealing yourself</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-[#f59e0b] to-[#b45309] text-white"><BadgeCheck className="size-6" /></span>
                    <div>
                      <p className="text-xl font-bold text-white">Priya Sharma <span className="code-font text-base font-semibold text-[var(--l-muted)]">· #K4M2N7</span></p>
                      <p className="mt-1 text-[0.84rem] text-[var(--l-muted)]">B.Tech CSE, IIIT Hyderabad · 3rd Year</p>
                      <ul className="mt-3 space-y-1 text-[0.8rem] text-amber-300">
                        <li>✓ Build public reputation</li>
                        <li>✓ Showcase projects to recruiters</li>
                        <li>✓ Get credit for helping others</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="mt-4 text-[0.78rem] text-[var(--l-muted)]">
              Switch between modes anytime. Your code stays the same—only the visible name changes.
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-sky-400/30 bg-sky-500/10 p-4" data-reveal>
            <p className="text-[0.85rem] text-sky-200">
              <strong className="font-semibold">Real talk:</strong> Your college won't see what you post in Saver mode. But once you reveal yourself, that association is permanent on those posts. Choose wisely for each post.
            </p>
          </div>
        </div>

        <ul className="space-y-4">
          <h3 className="l-display text-[1.3rem] font-bold text-white" data-reveal>Our commitments to you</h3>
          {PROMISES.map(({ icon: Icon, t, d }) => (
            <li key={t} className="l-glass flex gap-4 p-5" data-reveal>
              <span className="l-ico !mb-0 shrink-0" style={{ ["--ic" as string]: "#7dd3fc" }}><Icon className="size-5" /></span>
              <div>
                <h4 className="l-display text-[1.05rem] font-bold text-white">{t}</h4>
                <p className="mt-1 text-[0.92rem] leading-relaxed text-[var(--l-ink2)]">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
