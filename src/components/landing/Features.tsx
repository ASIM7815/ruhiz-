import { BookOpen, Hash, HeartHandshake, Layers, Lightbulb, ShieldCheck } from "lucide-react";
import { CATEGORIES } from "@/lib/meta";
import type { CategoryId } from "@/lib/types";

const TYPE_ROWS = [
  { l: "Personal Experience", c: "#a78bfa" },
  { l: "Evidence", c: "#34d399" },
  { l: "Counterargument", c: "#fbbf24" },
  { l: "Proposed Solution", c: "#60a5fa" },
];

const STAGES = ["Unsolved", "In Discussion", "Solutions", "Implementing", "Solved"];

/** Bento grid: each feature gets its own visual treatment rather than a repeated card. */
export function Features() {
  return (
    <section id="features" className="l-section" aria-labelledby="features-title">
      <div className="l-wrap">
        <span className="l-eyebrow" data-reveal><i /> Features</span>
        <h2 id="features-title" className="l-h2 l-display mt-5 max-w-3xl" data-reveal>
          Built so conversations <span className="l-grad">lead somewhere</span>.
        </h2>

        <div className="l-bento mt-14">
          {/* Anonymous participation */}
          <article className="l-glass l-card l-b-a" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#7dd3fc" }}><ShieldCheck className="size-5" /></div>
            <h3>Anonymous participation</h3>
            <p>Talk about the things that are hard to say. As Identity Saver you appear only as a six-character code. Reveal your name and role when it helps your reputation, and only when you choose to.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-hidden>
              <div className="rounded-2xl border border-[var(--l-line)] bg-black/25 p-4">
                <p className="l-vis-label">Identity Saver</p>
                <p className="code-font mt-2 text-lg font-bold text-white">#A1B2C3</p>
                <p className="text-[0.76rem] text-[var(--l-muted)]">Only a code</p>
              </div>
              <div className="rounded-2xl border border-[rgba(255,200,120,.25)] bg-black/25 p-4">
                <p className="l-vis-label !text-[#fcd34d]">Identity Revealer</p>
                <p className="mt-2 text-lg font-bold text-white">Your name</p>
                <p className="text-[0.76rem] text-[var(--l-muted)]">Your role, verified by you</p>
              </div>
            </div>
          </article>

          {/* Meaningful support */}
          <article className="l-glass l-card l-b-b" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#ff8fb0" }}><HeartHandshake className="size-5" /></div>
            <h3>Meaningful support</h3>
            <p>Peer supporters who volunteer to listen, and licensed professionals clearly marked once verified.</p>
            <div className="l-pulse-wrap" aria-hidden>
              <i /><i style={{ ["--pd" as string]: "1s" }} /><i style={{ ["--pd" as string]: "2s" }} />
              <HeartHandshake className="relative size-7 text-[#ff8fb0]" />
            </div>
          </article>

          {/* Problem categories */}
          <article className="l-glass l-card l-b-c" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#c4b5fd" }}><Layers className="size-5" /></div>
            <h3>Problem categories</h3>
            <p>Browse by what matters, from mental health and education to money, family and your neighbourhood.</p>
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Categories">
              {(Object.keys(CATEGORIES) as CategoryId[]).map((id) => {
                const Icon = CATEGORIES[id].icon;
                return (
                  <span key={id} className="l-cat"><Icon className="size-3.5" /> {CATEGORIES[id].label}</span>
                );
              })}
            </div>
          </article>

          {/* Knowledge sharing */}
          <article className="l-glass l-card l-b-d" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#6ee7b7" }}><BookOpen className="size-5" /></div>
            <h3>Knowledge sharing</h3>
            <p>Say what kind of contribution you are making, and back it with a source when it is evidence.</p>
            <div className="mt-5" aria-hidden>
              {TYPE_ROWS.map((x) => (
                <div key={x.l} className="l-type-row" style={{ ["--tc" as string]: x.c }}>
                  <span>{x.l}</span>
                  <div className="l-bar !mt-0 flex-1" />
                </div>
              ))}
            </div>
          </article>

          {/* Find people by code */}
          <article className="l-glass l-card l-b-e" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#fcd34d" }}><Hash className="size-5" /></div>
            <h3>Found by code</h3>
            <p>People search for codes, never names.</p>
            <div className="mt-5 flex h-11 items-center gap-2 rounded-full border border-[var(--l-line)] bg-black/30 px-4 text-[0.86rem] text-[var(--l-muted)]" aria-hidden>
              <Hash className="size-4" /> Search users by code
            </div>
          </article>

          {/* Solution-oriented conversations */}
          <article className="l-glass l-card l-b-f" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#93c5fd" }}><Lightbulb className="size-5" /></div>
            <h3>Solution-oriented conversations</h3>
            <p>Every problem has a visible journey. Ideas become Solution Cards with steps, resources and open roles, and finished work is recorded as an outcome.</p>
            <ol className="mt-6 flex items-center gap-1.5" aria-label="Problem stages">
              {STAGES.map((s, i) => (
                <li key={s} className="min-w-0 flex-1">
                  <div className={`h-1.5 rounded-full ${i < 3 ? "bg-[#4b92ff]" : i === 3 ? "bg-[#ff2e55] shadow-[0_0_12px_rgba(255,46,85,.7)]" : "bg-white/10"}`} />
                  <p className="mt-2 truncate text-[0.7rem] font-semibold text-[var(--l-muted)]">{s}</p>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </div>
    </section>
  );
}
