import { CheckCircle2, Code, HandHelping, Lightbulb, MessageSquare, Share2, Trophy } from "lucide-react";

const STEPS = [
  { 
    icon: MessageSquare,
    t: "Share Your Problem", 
    d: "Stuck on a DSA problem? Can't crack that circuit? Post it with context—code snippets, error logs, or just describe where you're confused. Go anonymous or public, you choose.",
    example: "Posted: Getting TLE in Leetcode Medium—tried two approaches, both timeout",
  },
  { 
    icon: Code,
    t: "Get Peer Insights", 
    d: "Students who've solved similar problems, seniors who've been through it, and peers learning alongside you share their approaches, debugging tips, and real experiences.",
    example: "3 replies: \"Try memoization\", \"Here's my accepted solution\", \"I struggled with this too\"",
  },
  { 
    icon: Lightbulb,
    t: "Build Together", 
    d: "Turn insights into working solutions. Collaborate on projects, form study groups for tough subjects, team up for hackathons, or find project partners who complement your skills.",
    example: "Solution implemented → Code shared → Added to portfolio",
  },
  { 
    icon: Trophy,
    t: "Showcase Your Work", 
    d: "Document your solution with explanations, add it to your public profile, and help others facing the same problem. Every solved challenge becomes proof of your growth.",
    example: "Marked as Helpful by 12 students → Portfolio piece → Interview talking point",
  },
  { 
    icon: HandHelping,
    t: "Help Others", 
    d: "Your breakthrough becomes someone else's roadmap. Answer questions in your strong areas, share placement experiences, mentor juniors, and build your reputation in the community.",
    example: "You're now answering DSA questions → Building credibility → Getting noticed by recruiters",
  },
];

/** Visual representations for each journey stage */
function StepVisual({ n }: { n: number }) {
  if (n === 0) {
    // Share Your Problem - Post card mockup
    return (
      <div className="l-vis">
        <p className="l-vis-label">New Problem Post</p>
        <div className="mt-3 rounded-xl border border-[var(--l-line)] bg-black/25 p-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500" />
            <div className="flex-1">
              <div className="l-bar w60 !mt-0" />
              <div className="l-bar w40 !h-2" />
            </div>
          </div>
          <div className="mt-3">
            <div className="l-bar w80 !mt-0" />
            <div className="l-bar" />
            <div className="l-bar w60" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-[0.75rem] font-medium text-blue-300">Coding & DSA</span>
            <span className="rounded-full bg-rose-500/20 px-2.5 py-1 text-[0.75rem] font-medium text-rose-300">Help Needed</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (n === 1) {
    // Get Peer Insights - Discussion threads
    return (
      <div className="l-vis">
        <p className="l-vis-label">Peer Responses</p>
        <div className="mt-3 space-y-2">
          {[
            { c: "#34d399", l: "Experience", w: "w-4/5" },
            { c: "#60a5fa", l: "Solution", w: "w-3/4" },
            { c: "#fbbf24", l: "Code Example", w: "w-full" },
          ].map((item, i) => (
            <div key={i} className="rounded-lg border border-[var(--l-line)] bg-black/20 p-3">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full" style={{ backgroundColor: item.c, opacity: 0.6 }} />
                <span className="text-[0.75rem] font-medium" style={{ color: item.c }}>{item.l}</span>
              </div>
              <div className={`l-bar ${item.w} mt-2`} />
              <div className="l-bar w60" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (n === 2) {
    // Build Together - Collaboration
    return (
      <div className="l-vis">
        <p className="l-vis-label">Building Solution</p>
        <div className="mt-3 rounded-xl border border-emerald-400/30 bg-black/25 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[0.85rem] font-semibold text-emerald-400">In Progress</span>
            <Code className="size-4 text-emerald-400" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span className="text-[0.8rem] text-[var(--l-ink2)]">Understood the approach</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span className="text-[0.8rem] text-[var(--l-ink2)]">Implemented solution</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-4 rounded-full border-2 border-slate-500" />
              <span className="text-[0.8rem] text-slate-500">Testing & refinement</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (n === 3) {
    // Showcase Your Work - Portfolio piece
    return (
      <div className="l-vis">
        <p className="l-vis-label">Portfolio Showcase</p>
        <div className="mt-3 rounded-xl border border-violet-400/30 bg-black/25 p-4">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-400" />
            <span className="text-[0.85rem] font-semibold text-white">Solution Accepted</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1 text-[0.75rem]">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span className="text-[var(--l-ink2)]">Solved</span>
            </div>
            <div className="flex items-center gap-1 text-[0.75rem]">
              <Share2 className="size-3.5 text-sky-400" />
              <span className="text-[var(--l-ink2)]">12 helped</span>
            </div>
            <div className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[0.7rem] font-medium text-violet-300">
              Portfolio
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Help Others - Mentorship cycle
  return (
    <div className="l-vis">
      <p className="l-vis-label">Helping Others</p>
      <svg viewBox="0 0 280 140" className="mt-3 w-full" role="img" aria-label="Cycle of learning and mentorship">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#22d3ee" />
          </marker>
        </defs>
        
        {/* Circular flow */}
        <path 
          d="M 140 30 Q 220 50, 230 100 Q 220 130, 170 135 Q 110 135, 50 100 Q 40 50, 140 30" 
          fill="none" 
          stroke="#22d3ee" 
          strokeWidth="2"
          strokeDasharray="5,5"
          markerEnd="url(#arrowhead)"
          opacity="0.6"
        />
        
        {/* Nodes */}
        <circle cx="140" cy="30" r="14" fill="#ff2e55" opacity="0.85" />
        <text x="140" y="20" fontSize="10" fill="#fff" textAnchor="middle" fontWeight="600">You</text>
        
        <circle cx="230" cy="100" r="12" fill="#22d3ee" opacity="0.85" />
        <text x="250" y="105" fontSize="9" fill="#22d3ee" textAnchor="start">Learn</text>
        
        <circle cx="170" cy="135" r="12" fill="#34d399" opacity="0.85" />
        <text x="170" y="155" fontSize="9" fill="#34d399" textAnchor="middle">Build</text>
        
        <circle cx="50" cy="100" r="12" fill="#a78bfa" opacity="0.85" />
        <text x="30" y="105" fontSize="9" fill="#a78bfa" textAnchor="end">Teach</text>
      </svg>
    </div>
  );
}

export function Journey() {
  return (
    <section id="how" className="l-journey" data-journey data-steps={STEPS.length} data-step="0" aria-labelledby="how-title">
      <div className="l-wrap">
        <span className="l-eyebrow" data-reveal><i /> Your Engineering Journey</span>
        <h2 id="how-title" className="l-h2 l-display mt-5 max-w-3xl" data-reveal>
          From confused freshman to confident engineer.
          <br />
          <span className="l-grad-red">Here's how it happens.</span>
        </h2>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
          <ol className="l-steps" aria-label="The five journey stages">
            <div className="l-rail" aria-hidden><i /></div>
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.t} className="l-step" data-i={i}>
                  <span className="l-num">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="l-display text-[1.3rem] font-bold leading-snug text-white">{s.t}</h3>
                    <p className="mt-1.5 text-[0.98rem] leading-relaxed text-[var(--l-ink2)]">{s.d}</p>
                    <p className="mt-2 text-[0.85rem] italic text-sky-300/70">
                      <span className="not-italic">→</span> {s.example}
                    </p>
                    {/* Small screens: the illustration sits with its step. */}
                    <div className="l-inline-vis mt-4 max-w-md" data-reveal><StepVisual n={i} /></div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="l-stage" aria-hidden>
            {STEPS.map((_, i) => (
              <div key={i} className="l-layer" style={{ ["--i" as string]: i }}>
                <StepVisual n={i} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center" data-reveal>
          <p className="l-display mx-auto max-w-2xl text-[1.4rem] font-bold leading-snug text-white">
            Every problem you solve makes the next engineer's path easier.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-[0.95rem] text-[var(--l-ink2)]">
            That's how we build a community where everyone grows—together.
          </p>
        </div>
      </div>
    </section>
  );
}
