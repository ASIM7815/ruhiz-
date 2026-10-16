import { BookOpen, Code2, FileCode, GitPullRequest, Hash, Layers, Lightbulb, ShieldCheck, Trophy, Users } from "lucide-react";
import { CATEGORIES } from "@/lib/meta";
import type { CategoryId } from "@/lib/types";

const STAGES = ["Asked", "Discussed", "Solution Proposed", "Code Shared", "Marked Helpful"];

/** Bento grid: each feature gets its own visual treatment rather than a repeated card. */
export function Features() {
  return (
    <section id="features" className="l-section" aria-labelledby="features-title">
      <div className="l-wrap">
        <span className="l-eyebrow" data-reveal><i /> Features</span>
        <h2 id="features-title" className="l-h2 l-display mt-5 max-w-3xl" data-reveal>
          Built for engineers who <span className="l-grad">actually build things</span>.
        </h2>

        <div className="l-bento mt-14">
          {/* Anonymous Participation */}
          <article className="l-glass l-card l-b-a" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#7dd3fc" }}><ShieldCheck className="size-5" /></div>
            <h3>Anonymous or Public—Your Choice</h3>
            <p>Ask "dumb questions" without fear. Share placement rejections. Discuss salary honestly. Be real without risking your reputation. When you're ready to shine, reveal yourself and build your public profile.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-hidden>
              <div className="rounded-2xl border border-[var(--l-line)] bg-black/25 p-4">
                <p className="l-vis-label">Identity Saver</p>
                <p className="code-font mt-2 text-lg font-bold text-white">#A1B2C3</p>
                <p className="text-[0.76rem] text-[var(--l-muted)]">Ask anything, stay anonymous</p>
              </div>
              <div className="rounded-2xl border border-[rgba(255,200,120,.25)] bg-black/25 p-4">
                <p className="l-vis-label !text-[#fcd34d]">Identity Revealer</p>
                <p className="mt-2 text-lg font-bold text-white">Priya Sharma</p>
                <p className="text-[0.76rem] text-[var(--l-muted)]">B.Tech CSE, IIT Delhi</p>
              </div>
            </div>
          </article>

          {/* Project Portfolio */}
          <article className="l-glass l-card l-b-b" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#c084fc" }}><Trophy className="size-5" /></div>
            <h3>Turn Solutions into Portfolio Pieces</h3>
            <p>Every problem you solve, every project you complete, every insight you share becomes proof of skill. Build your engineering portfolio organically.</p>
            <div className="mt-5 space-y-2" aria-hidden>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                  <FileCode className="size-4 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.85rem] font-semibold text-white">Optimized sorting algorithm</p>
                  <p className="text-[0.7rem] text-emerald-400">Helped 24 students</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--l-line)] bg-black/20 p-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20">
                  <GitPullRequest className="size-4 text-violet-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.85rem] font-semibold text-white">React state management guide</p>
                  <p className="text-[0.7rem] text-[var(--l-muted)]">Saved by 18 students</p>
                </div>
              </div>
            </div>
          </article>

          {/* Peer Code Review */}
          <article className="l-glass l-card l-b-c" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#34d399" }}><Code2 className="size-5" /></div>
            <h3>Get Real Code Reviews</h3>
            <p>Feedback from students who've cracked FAANG interviews. Learn what clean code actually looks like, not just what works.</p>
            <div className="mt-5 rounded-xl border border-[var(--l-line)] bg-black/25 p-3" aria-hidden>
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500" />
                <div>
                  <p className="text-[0.8rem] font-semibold text-white">Senior @Google</p>
                  <p className="text-[0.7rem] text-[var(--l-muted)]">Reviewed your code</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex gap-2">
                  <span className="text-emerald-400">+</span>
                  <span className="text-[0.75rem] font-mono text-emerald-400">// Good: Using memoization</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-rose-400">-</span>
                  <span className="text-[0.75rem] font-mono text-rose-400">// Consider edge cases</span>
                </div>
              </div>
            </div>
          </article>

          {/* Placement Experiences */}
          <article className="l-glass l-card l-b-d" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#fbbf24" }}><BookOpen className="size-5" /></div>
            <h3>Real Placement Experiences</h3>
            <p>Question banks, interview tips, and salary data from students who got offers. Know exactly what to expect before you walk into that interview.</p>
            <div className="mt-5 flex flex-wrap gap-2" aria-hidden>
              {["Google", "Microsoft", "Amazon", "Meta", "Netflix", "Apple"].map((company) => (
                <div key={company} className="flex items-center gap-1.5 rounded-full border border-[var(--l-line)] bg-black/30 px-3 py-1.5">
                  <div className="size-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
                  <span className="text-[0.8rem] font-medium text-white">{company}</span>
                </div>
              ))}
            </div>
          </article>

          {/* Study Groups */}
          <article className="l-glass l-card l-b-e" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#ff8fb0" }}><Users className="size-5" /></div>
            <h3>Find Your Study Tribe</h3>
            <p>Study buddies for that tough subject. Project teams for hackathons. Accountability partners for interview prep. Your people are here.</p>
            <div className="mt-5 flex -space-x-3" aria-hidden>
              {[
                "from-cyan-400 to-blue-500",
                "from-violet-400 to-purple-500",
                "from-rose-400 to-pink-500",
                "from-emerald-400 to-teal-500",
                "from-amber-400 to-orange-500",
              ].map((gradient, i) => (
                <div
                  key={i}
                  className={`flex size-12 items-center justify-center rounded-full border-2 border-[#0a0e1a] bg-gradient-to-br ${gradient} text-sm font-bold text-white`}
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
              <div className="flex size-12 items-center justify-center rounded-full border-2 border-[#0a0e1a] bg-white/10 text-sm font-bold text-white">
                +12
              </div>
            </div>
            <p className="mt-3 text-[0.8rem] text-[var(--l-muted)]">17 study groups active in Operating Systems</p>
          </article>

          {/* Problem Lifecycle */}
          <article className="l-glass l-card l-b-f" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#60a5fa" }}><Lightbulb className="size-5" /></div>
            <h3>Problems Have a Journey</h3>
            <p>From confused to confident, every question moves through clear stages. See progress, not just endless discussion.</p>
            <ol className="mt-6 flex items-center gap-1.5" aria-label="Problem stages">
              {STAGES.map((s, i) => (
                <li key={s} className="min-w-0 flex-1">
                  <div className={`h-1.5 rounded-full ${i < 3 ? "bg-[#4b92ff]" : i === 3 ? "bg-[#34d399]" : "bg-[#fcd34d] shadow-[0_0_12px_rgba(252,211,77,.7)]"}`} />
                  <p className="mt-2 truncate text-[0.7rem] font-semibold text-[var(--l-muted)]">{s}</p>
                </li>
              ))}
            </ol>
          </article>

          {/* Engineering Categories */}
          <article className="l-glass l-card l-b-g" data-reveal>
            <div className="l-ico" style={{ ["--ic" as string]: "#c4b5fd" }}><Layers className="size-5" /></div>
            <h3>Categories That Matter to Engineers</h3>
            <p>From coding challenges to campus life, find help organized the way you think about your problems.</p>
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Categories">
              {(["coding-help", "project-help", "placement-prep", "exam-strategies", "hackathons", "campus-life", "career-guidance", "mental-wellness"] as CategoryId[]).map((id) => {
                const Icon = CATEGORIES[id].icon;
                return (
                  <span key={id} className="l-cat"><Icon className="size-3.5" /> {CATEGORIES[id].label}</span>
                );
              })}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
