"use client";

import { useState } from "react";
import { Bookmark, Heart, HeartHandshake, Image as ImageIcon, MessageCircle, PenLine, Play, ShieldCheck, Video } from "lucide-react";

type Kind = "photo" | "video" | "thought";

const TABS: { id: Kind; label: string; icon: typeof ImageIcon }[] = [
  { id: "photo", label: "Photo", icon: ImageIcon },
  { id: "video", label: "Video", icon: Video },
  { id: "thought", label: "Thoughts", icon: PenLine },
];

const COPY: Record<Kind, { title: string; body: string }> = {
  photo: { title: "The shared reading room needs more chairs", body: "Sharing what our neighbourhood study space looks like right now. We need furniture and a few volunteers for evenings." },
  video: { title: "How the water reaches our street", body: "A two-minute walk-through of where the supply fails along our lane, so people can see the problem for themselves." },
  thought: { title: "I keep missing deadlines and I don't know why", body: "It isn't laziness. I sit down to start and freeze. Has anyone dealt with this, and what actually helped?" },
};

const REPLIES = [
  { t: "Personal Experience", c: "#a78bfa", x: "I went through the same freeze. Splitting the first task into ten-minute pieces got me moving." },
  { t: "Evidence", c: "#34d399", x: "Task-initiation difficulty is common, and structured starting routines have good support behind them." },
  { t: "Counterargument", c: "#fbbf24", x: "Routines helped me less than changing the environment I worked in. Worth trying both." },
];

/** Abstract artwork stands in for member media. It shows the shape each kind of post takes. */
function Media({ kind }: { kind: Exclude<Kind, "thought"> }) {
  if (kind === "photo")
    return (
      // Portrait artwork, shown whole: RUHIZ never crops a photo.
      <div className="l-media mx-auto" style={{ aspectRatio: "4 / 5", maxWidth: 300, background: "linear-gradient(180deg,#1d2f7a 0%,#2a4fc4 38%,#7b5cf0 68%,#ff6b9d 100%)" }}>
        <svg viewBox="0 0 300 375" className="size-full" aria-hidden preserveAspectRatio="xMidYMid meet">
          <circle cx="215" cy="92" r="34" fill="#ffd9e3" opacity=".9" />
          <path d="M0 300 L70 215 L130 270 L200 190 L300 295 L300 375 L0 375Z" fill="#0b1647" opacity=".85" />
          <path d="M0 335 L90 270 L160 318 L240 258 L300 320 L300 375 L0 375Z" fill="#050a26" />
        </svg>
      </div>
    );
  return (
    <div className="l-media" style={{ aspectRatio: "16 / 9", background: "linear-gradient(120deg,#0f1f66,#2f58d8 50%,#22d3ee)" }}>
      <svg viewBox="0 0 320 180" className="size-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <path d="M0 140 Q80 90 160 130 T320 110 L320 180 L0 180Z" fill="#06103a" opacity=".7" />
      </svg>
      <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white/85 bg-black/35 backdrop-blur-sm">
        <Play className="ml-0.5 size-6 fill-white text-white" />
      </span>
    </div>
  );
}

export function Preview() {
  const [kind, setKind] = useState<Kind>("photo");
  const c = COPY[kind];

  return (
    <section id="community" className="l-section" aria-labelledby="community-title">
      <div className="l-wrap">
        <div className="grid items-center gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <span className="l-eyebrow" data-reveal><i /> Inside the community</span>
            <h2 id="community-title" className="l-h2 l-display mt-5" data-reveal>
              A feed where every post <span className="l-grad">goes somewhere</span>.
            </h2>
            <p className="l-lead mt-5" data-reveal>
              Share a photo, a video or a few honest sentences. Photos and videos always appear whole, in their own shape, never cropped. Replies are labelled so you can tell a lived experience from evidence from an opinion.
            </p>
            <div className="l-tabs mt-8" role="tablist" aria-label="Post types" data-reveal>
              {TABS.map((t) => (
                <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={kind === t.id} aria-controls="preview-panel" className="l-tab" onClick={() => setKind(t.id)}>
                  <t.icon className="size-4" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="l-frame" data-parallax="0.06" data-reveal>
            <div className="l-device">
              <div id="preview-panel" role="tabpanel" aria-labelledby={`tab-${kind}`} className="l-glass l-post">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--l-line)] bg-black/30 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--l-muted)]">
                  Illustration · an example, not a real post
                </p>
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#2f6bff] to-[#0b1f66] text-white">
                    <ShieldCheck className="size-5" />
                  </span>
                  <div>
                    <p className="text-[0.92rem] font-semibold text-white">Anonymous member</p>
                    <p className="text-[0.76rem] text-[var(--l-muted)]">Identity Saver · only a code is shown</p>
                  </div>
                  <span className="l-pill ml-auto" style={{ ["--pc" as string]: "rgba(255,46,85,.4)", ["--pt" as string]: "#ffc2cf", ["--pb" as string]: "rgba(255,46,85,.12)" }}>{kind === "thought" ? "Seeking support" : "Problem"}</span>
                </div>

                <h3 key={kind} className="l-display l-id-enter mt-4 text-[1.2rem] font-bold leading-snug text-white">{c.title}</h3>
                <p className="mt-1.5 text-[0.92rem] leading-relaxed text-[var(--l-ink2)]">{c.body}</p>
                {kind !== "thought" && <div className="mt-4"><Media kind={kind} /></div>}

                <div className="mt-4 flex flex-wrap items-center gap-2" aria-hidden>
                  <span className="l-act on"><HeartHandshake className="size-4" /> Support</span>
                  <span className="l-act"><Heart className="size-4 text-[#ff6b9d]" /> Care</span>
                  <span className="l-act"><MessageCircle className="size-4" /> Discuss</span>
                  <span className="l-act ml-auto"><Bookmark className="size-4" /></span>
                </div>

                <div className="mt-4 space-y-2">
                  {(kind === "thought" ? REPLIES : REPLIES.slice(0, 2)).map((r) => (
                    <div key={r.t} className="l-reply" style={{ ["--tc" as string]: r.c }}>
                      <b>{r.t}</b>
                      {r.x}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
