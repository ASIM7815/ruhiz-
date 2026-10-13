import { CheckCircle2, Lightbulb, Lock, ShieldCheck } from "lucide-react";

const STEPS = [
  { t: "Share a problem", d: "Post it as a photo, a video or a few honest sentences, publicly or anonymously. Choose Identity Saver and only your code is shown." },
  { t: "Connect with people who understand", d: "Members who have lived something similar, and those who can help with knowledge, skills or time, find your problem and respond." },
  { t: "Exchange experience, evidence and ideas", d: "Every reply is labelled: Personal Experience, Evidence, Opinion, Counterargument, Question or Proposed Solution, so the discussion stays useful." },
  { t: "Turn conversation into next steps", d: "The best ideas become Solution Cards with steps, resources and roles. People join, pledge support, and the problem is marked Solved with its outcome." },
];

const TYPES = [
  { l: "Personal Experience", c: "#a78bfa" },
  { l: "Evidence", c: "#34d399" },
  { l: "Counterargument", c: "#fbbf24" },
  { l: "Proposed Solution", c: "#60a5fa" },
];

/** Dimensional illustration for each step. Pure CSS/SVG; no people, numbers or content from members. */
function StepVisual({ n }: { n: number }) {
  if (n === 0)
    return (
      <div className="l-vis">
        <p className="l-vis-label">New post</p>
        <div className="mt-3 rounded-xl bg-black/25 p-3">
          <div className="l-bar w80 !mt-0" />
          <div className="l-bar" />
          <div className="l-bar w60" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="l-pill" style={{ ["--pc" as string]: "rgba(255,46,85,.4)", ["--pt" as string]: "#ffc2cf", ["--pb" as string]: "rgba(255,46,85,.12)" }}>Problem</span>
          <span className="l-pill"><ShieldCheck className="size-3.5" /> Identity Saver</span>
        </div>
      </div>
    );
  if (n === 1)
    return (
      <div className="l-vis">
        <p className="l-vis-label">Connections</p>
        <svg viewBox="0 0 320 170" className="mt-2 w-full" role="img" aria-label="A problem connected to several people who can help">
          {[[50, 40], [60, 130], [265, 35], [270, 135], [160, 22]].map(([x, y], i) => (
            <line key={i} x1="160" y1="88" x2={x} y2={y} stroke="#5b95ff" strokeWidth="1.5" className="l-node-line" style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
          {[[50, 40, "#22d3ee"], [60, 130, "#a78bfa"], [265, 35, "#ff6b9d"], [270, 135, "#22d3ee"], [160, 22, "#5b95ff"]].map(([x, y, c], i) => (
            <circle key={i} cx={x as number} cy={y as number} r="12" fill={c as string} opacity="0.85" />
          ))}
          <circle cx="160" cy="88" r="26" fill="#ff2e55" />
          <circle cx="160" cy="88" r="36" fill="none" stroke="#ff2e55" strokeOpacity="0.35" />
        </svg>
      </div>
    );
  if (n === 2)
    return (
      <div className="l-vis">
        <p className="l-vis-label">Structured discussion</p>
        {TYPES.map((x) => (
          <div key={x.l} className="l-type-row" style={{ ["--tc" as string]: x.c }}>
            <span>{x.l}</span>
            <div className="l-bar !mt-0 flex-1" />
          </div>
        ))}
      </div>
    );
  return (
    <div className="l-vis">
      <div className="flex items-center justify-between">
        <p className="l-vis-label">Solution Card</p>
        <Lightbulb className="size-4 text-sky-300" />
      </div>
      <div className="mt-3 space-y-2.5">
        {["Plan and validate", "Gather resources", "Put it into action"].map((s, i) => (
          <div key={s} className="flex items-center gap-2.5 text-[0.86rem] text-[var(--l-ink2)]">
            <CheckCircle2 className={`size-4 ${i < 2 ? "text-emerald-400" : "text-slate-500"}`} /> {s}
          </div>
        ))}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#4b92ff] to-[#34d399]" />
      </div>
      <div className="mt-4 flex gap-2">
        <span className="l-pill"><Lock className="size-3.5" /> Solved, with outcome</span>
      </div>
    </div>
  );
}

export function Journey() {
  return (
    <section id="how" className="l-journey" data-journey data-steps={STEPS.length} data-step="0" aria-labelledby="how-title">
      <div className="l-wrap">
        <span className="l-eyebrow" data-reveal><i /> How RUHIZ works</span>
        <h2 id="how-title" className="l-h2 l-display mt-5 max-w-2xl" data-reveal>
          From a problem to an <span className="l-grad-red">outcome</span>, in the open.
        </h2>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
          <ol className="l-steps" aria-label="The four steps">
            <div className="l-rail" aria-hidden><i /></div>
            {STEPS.map((s, i) => (
              <li key={s.t} className="l-step" data-i={i}>
                <span className="l-num">{i + 1}</span>
                <div>
                  <h3 className="l-display text-[1.3rem] font-bold leading-snug text-white">{s.t}</h3>
                  <p className="mt-1.5 text-[0.98rem] leading-relaxed text-[var(--l-ink2)]">{s.d}</p>
                  {/* Small screens: the illustration sits with its step. */}
                  <div className="l-inline-vis mt-4 max-w-md" data-reveal><StepVisual n={i} /></div>
                </div>
              </li>
            ))}
          </ol>

          <div className="l-stage" aria-hidden>
            {STEPS.map((_, i) => (
              <div key={i} className="l-layer" style={{ ["--i" as string]: i }}>
                <StepVisual n={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
