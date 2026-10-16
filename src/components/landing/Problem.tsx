import { AlertCircle, Briefcase, Code, Flame, Lightbulb, Users } from "lucide-react";

const CHALLENGES = [
  {
    icon: Code,
    quote: "I'm stuck on DSA concepts and my exams are next week",
    context: "You're not alone. Thousands of engineering students struggle with Data Structures and Algorithms. The difference? Here, you'll find peers who've been exactly where you are, with real solutions that worked.",
    color: "text-blue-400",
    bg: "from-blue-500/10 to-blue-600/5",
  },
  {
    icon: Lightbulb,
    quote: "I built something cool but no one sees it beyond my college",
    context: "Your projects deserve an audience. On RUHIZ, showcase your work to students and recruiters across 120+ colleges, get feedback from peers, and turn solutions into portfolio pieces.",
    color: "text-violet-400",
    bg: "from-violet-500/10 to-violet-600/5",
  },
  {
    icon: Briefcase,
    quote: "Everyone around me got placed. I feel left behind.",
    context: "Placement anxiety is real, but silence makes it worse. Connect with students sharing interview experiences, salary insights, and proven preparation strategies. Your breakthrough is one conversation away.",
    color: "text-amber-400",
    bg: "from-amber-500/10 to-amber-600/5",
  },
  {
    icon: Users,
    quote: "I'm the only one struggling with this. Where's my tribe?",
    context: "You're not the only one—you just haven't found your people yet. Whether it's a tough subject, imposter syndrome, or career confusion, there's a community here that gets it.",
    color: "text-emerald-400",
    bg: "from-emerald-500/10 to-emerald-600/5",
  },
  {
    icon: AlertCircle,
    quote: "I don't know if I'm learning the right skills for the industry",
    context: "The gap between college curriculum and industry needs is real. Learn from seniors who've made the jump, get mentored on relevant skills, and understand what actually matters in placements.",
    color: "text-cyan-400",
    bg: "from-cyan-500/10 to-cyan-600/5",
  },
  {
    icon: Flame,
    quote: "Assignments, projects, placements—it's overwhelming",
    context: "Engineering burnout is a thing. Share your load with study groups, find project collaborators, and remember: asking for help is a strength, not a weakness.",
    color: "text-rose-400",
    bg: "from-rose-500/10 to-rose-600/5",
  },
];

export function Problem() {
  return (
    <section id="why" className="l-section" aria-labelledby="why-title">
      <div className="l-wrap">
        <span className="l-eyebrow" data-reveal><i /> The challenges</span>
        <h2 id="why-title" className="l-h2 l-display mt-5 max-w-3xl" data-reveal>
          Every engineer faces these moments.
          <br />
          <span className="l-grad">You don't have to face them alone.</span>
        </h2>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CHALLENGES.map((challenge, idx) => {
            const Icon = challenge.icon;
            return (
              <div
                key={idx}
                className="l-glass group relative overflow-hidden rounded-2xl border border-[var(--l-line)] p-6 transition-all hover:scale-[1.02]"
                data-reveal
                style={{ ["--reveal-delay" as string]: `${idx * 0.1}s` }}
              >
                {/* Gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${challenge.bg} opacity-50 transition-opacity group-hover:opacity-70`} />
                
                {/* Content */}
                <div className="relative z-10">
                  <div className={`mb-4 inline-flex rounded-xl bg-black/40 p-3 ${challenge.color}`}>
                    <Icon className="size-6" />
                  </div>
                  
                  <blockquote className="mb-3 text-[1.1rem] font-semibold leading-snug text-white">
                    "{challenge.quote}"
                  </blockquote>
                  
                  <p className="text-[0.9rem] leading-relaxed text-[var(--l-ink2)]">
                    {challenge.context}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center" data-reveal>
          <p className="l-display mx-auto max-w-2xl text-[1.55rem] font-bold leading-snug text-white">
            RUHIZ connects your challenges with <span className="l-grad-red">real solutions</span>, from students who've been there.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-[1rem] text-[var(--l-ink2)]">
            From confused freshman to confident graduate—your engineering journey is about to get a whole lot less lonely.
          </p>
        </div>
      </div>
    </section>
  );
}
