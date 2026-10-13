import { Eye, Heart, Share2, UserRound } from "lucide-react";

const POINTS = [
  { n: "01", t: "A serious problem gets a day of sympathy.", d: "Someone posts about their studies, their job, their family, their health or their neighbourhood. A few comments arrive. Then the feed moves on." },
  { n: "02", t: "There is no path from the problem to a fix.", d: "Nothing connects it to people who have lived it, to evidence, to a plan, or to someone who can act on it." },
  { n: "03", t: "Being honest often means being identifiable.", d: "The most useful stories are the ones people are afraid to attach their name to." },
];

/** A deliberately generic feed card: this is what attention-first feeds reward. */
function GhostCard({ z, t, ry, o, rows }: { z: number; t: string; ry: number; o: number; rows: number }) {
  return (
    <div className="l-ghost" style={{ ["--z" as string]: `${z}px`, ["--t" as string]: t, ["--ry" as string]: `${ry}deg`, ["--o" as string]: o }}>
      <div className="row">
        <span className="l-dot" />
        <span className="l-bar w40 !mt-0 flex-1" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`l-bar ${i % 2 ? "w60" : "w80"}`} />
      ))}
      <div className="mt-4 flex gap-2">
        <span className="l-metric"><Heart className="size-3" /> likes</span>
        <span className="l-metric"><Eye className="size-3" /> views</span>
        <span className="l-metric"><UserRound className="size-3" /> followers</span>
        <span className="l-metric"><Share2 className="size-3" /> shares</span>
      </div>
    </div>
  );
}

export function Problem() {
  return (
    <section id="why" className="l-section" aria-labelledby="why-title">
      <div className="l-wrap">
        <span className="l-eyebrow" data-reveal><i /> The problem</span>
        <h2 id="why-title" className="l-h2 l-display mt-5 max-w-3xl" data-reveal>
          Feeds are built for attention.
          <br />
          <span className="l-grad">Real problems need more.</span>
        </h2>

        <div className="mt-16 grid items-center gap-16 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="l-layers" aria-hidden data-reveal>
            <div data-parallax="0.12"><GhostCard z={-170} t="0" ry={-14} o={0.55} rows={2} /></div>
            <div data-parallax="0.22"><GhostCard z={-70} t="88px" ry={-10} o={0.8} rows={3} /></div>
            <div data-parallax="0.34">
              <div className="l-ghost !border-[rgba(255,46,85,0.35)]" style={{ ["--z" as string]: "40px", ["--t" as string]: "190px", ["--ry" as string]: "-6deg" }}>
                <div className="row">
                  <span className="l-dot" />
                  <span className="l-bar w60 !mt-0 flex-1" />
                </div>
                <p className="mt-3 text-[0.95rem] font-semibold leading-snug text-white">
                  “I don&rsquo;t know who to ask about this.”
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="l-metric l-struck">17 likes</span>
                  <span className="l-metric l-struck">followers</span>
                  <span className="l-metric !text-[#ffb3c4]">still unsolved</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-9">
            {POINTS.map((p) => (
              <div key={p.n} className="l-point" data-reveal>
                <b>{p.n}</b>
                <div>
                  <h3 className="l-display text-[1.35rem] font-bold leading-snug text-white">{p.t}</h3>
                  <p className="mt-2 text-[1rem] leading-relaxed text-[var(--l-ink2)]">{p.d}</p>
                </div>
              </div>
            ))}
            <p className="l-display border-t border-[var(--l-line)] pt-8 text-[1.55rem] font-bold leading-snug text-white" data-reveal>
              RUHIZ puts the problem at the centre, and moves it toward an <span className="l-grad-red">outcome</span>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
