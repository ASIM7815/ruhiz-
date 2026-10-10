import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CircleCheckBig,
  Compass,
  FileSearch,
  GitCompareArrows,
  HandHelping,
  Hash,
  HeartHandshake,
  Lightbulb,
  MessageSquareQuote,
  MessagesSquare,
  Milestone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { getViewer } from "@/server/session";

export const dynamic = "force-dynamic";

const LOOP = ["Problem", "Experience", "Evidence", "Discussion", "Debate", "Solution", "Contribution", "Action", "Outcome"];

const FEATURES = [
  { icon: Milestone, title: "A lifecycle for every problem", text: "Problems move from Unsolved to In Discussion, Solutions Proposed, Implementing and Solved, with a visible timeline of what changed and who moved it." },
  { icon: MessagesSquare, title: "Structured discussion", text: "Every reply is labelled: Personal Experience, Evidence, Opinion, Counterargument, Question or Proposed Solution. You can tell lived experience from data from opinion at a glance." },
  { icon: HandHelping, title: "I Can Help", text: "Offer what you can actually bring: knowledge, technical skills, research, funding, equipment, volunteering, a local connection or a professional service." },
  { icon: Lightbulb, title: "Solution Cards", text: "Turn ideas into a plan with steps, resources, funding needed, roles to fill, timeline and expected outcome. People can support it, join a role or pledge." },
  { icon: ShieldCheck, title: "Identity Saver & Revealer", text: "Talk about sensitive problems as just your code. Or reveal your name and role when you want your expertise connected to your contribution. You choose per post." },
  { icon: Hash, title: "Found by code, not by name", text: "Every member gets a unique six-character code. People search for codes, never names, so participating doesn't expose who you are." },
  { icon: HeartHandshake, title: "Emotional Support", text: "Find members who volunteer to listen, filtered by what they're comfortable supporting. Licensed professionals are marked only after moderators verify their registration." },
  { icon: Compass, title: "A feed built for outcomes", text: "Rankings favour real discussion and neglected problems over raw likes. Unsolved surfaces problems with the fewest offers of help. There's no infinite scroll." },
];

const TYPES = [
  { icon: UserRound, label: "Personal Experience", cls: "border-l-violet-400 text-violet-200" },
  { icon: FileSearch, label: "Evidence", cls: "border-l-emerald-400 text-emerald-200" },
  { icon: MessageSquareQuote, label: "Opinion", cls: "border-l-sky-400 text-sky-200" },
  { icon: GitCompareArrows, label: "Counterargument", cls: "border-l-amber-400 text-amber-200" },
  { icon: Lightbulb, label: "Proposed Solution", cls: "border-l-blue-400 text-blue-200" },
];

export default async function Landing({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const viewer = await getViewer().catch(() => null);
  if (viewer) redirect("/home");

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-line bg-[#040a1c]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Link href="/" aria-label="RUHIZ">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ruhiz-logo.png" alt="RUHIZ" className="h-8 w-auto drop-shadow-[0_4px_16px_rgba(47,123,255,.35)]" />
          </Link>
          <nav className="ml-6 hidden items-center gap-5 text-[0.88rem] text-ink-2 md:flex">
            <a href="#problem" className="hover:text-white">Why RUHIZ</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#privacy" className="hover:text-white">Privacy</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/sign-in" className="btn btn-ghost">
              Sign In
            </Link>
            <Link href="/sign-up" className="btn btn-red">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {deleted && (
        <div className="mx-auto mt-4 max-w-6xl px-5">
          <p className="card flex items-center gap-2 p-3 text-[0.88rem] text-ink-2">
            <CircleCheckBig className="size-4 text-emerald-400" /> Your account and its content have been deleted.
          </p>
        </div>
      )}

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 top-40 size-80 rounded-full bg-accent/10 blur-[100px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 md:grid-cols-[1.1fr_1fr] md:pt-24">
          <div>
            <span className="badge border-brand/30 bg-brand/10 text-blue-200">
              <Sparkles className="size-3" /> A social platform built around real problems
            </span>
            <h1 className="mt-5 font-display text-[2.4rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[3.2rem]">
              Bring a problem.
              <br />
              <span className="bg-gradient-to-r from-[#7fb0ff] via-[#2f7bff] to-[#ff4466] bg-clip-text text-transparent">Find the people who can help.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-ink-2">
              RUHIZ connects people facing real problems with people who understand them, people with knowledge, and people with resources. Conversations move from problem to solution to outcome, instead of disappearing into a feed.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/sign-up" className="btn btn-red btn-lg">
                Create your account <ArrowRight className="size-4" />
              </Link>
              <Link href="/sign-in" className="btn btn-outline btn-lg">
                Sign In
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[0.82rem] text-muted">
              <ShieldCheck className="size-4 text-sky-400" /> Join with just an email. Your name is never public unless you choose to reveal it.
            </p>
          </div>

          {/* Product illustration: the problem journey (no fake people or numbers) */}
          <div className="card relative p-5" aria-hidden>
            <div className="flex items-center gap-2">
              <span className="badge border-rose-400/30 bg-rose-500/10 text-rose-200">Problem</span>
              <span className="badge border-amber-400/25 bg-amber-500/12 text-amber-300">
                <MessagesSquare className="size-3" /> In Discussion
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-3.5 w-4/5 rounded bg-white/15" />
              <div className="h-3 w-full rounded bg-white/[.07]" />
              <div className="h-3 w-3/4 rounded bg-white/[.07]" />
            </div>
            <div className="mt-4 flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${i < 1 ? "bg-brand" : i === 1 ? "bg-accent" : "bg-white/10"}`} />
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {TYPES.map(({ icon: Icon, label, cls }) => (
                <div key={label} className={`flex items-center gap-2.5 rounded-lg border border-l-[3px] border-line bg-black/20 px-3 py-2 ${cls}`}>
                  <Icon className="size-4" />
                  <span className="text-[0.78rem] font-semibold">{label}</span>
                  <span className="ml-2 h-2 flex-1 rounded bg-white/[.06]" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-blue-400/25 bg-brand/[.1] px-3 py-2.5">
              <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-blue-200">
                <Lightbulb className="size-4" /> Solution Card
              </span>
              <span className="btn btn-red btn-sm pointer-events-none">
                <HandHelping className="size-3.5" /> I Can Help
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="scroll-mt-20 border-y border-line bg-black/20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <p className="eyebrow !text-rose-300">The problem</p>
            <h2 className="section-title mt-2 text-[1.9rem] leading-tight">Social media is built for attention, not for help.</h2>
          </div>
          <div className="space-y-4 text-[0.98rem] leading-relaxed text-ink-2">
            <p>Today's platforms are designed around likes, views and followers. Someone can post a serious problem about their studies, job, family, health or neighbourhood and receive a few comments and some sympathy. Then it scrolls away.</p>
            <p>There's no structured path from the problem to understanding it, to people who've lived it, to evidence, to a plan, to someone actually acting on it. And sharing honestly often means exposing who you are.</p>
            <p className="font-semibold text-ink">RUHIZ makes the problem the centre of the conversation, and moves it toward an outcome.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="eyebrow !text-brand-ink">How it works</p>
          <h2 className="section-title mt-2 max-w-2xl text-[1.9rem] leading-tight">From problem to outcome, in the open.</h2>
          <ol className="no-scrollbar mt-8 flex items-center gap-1 overflow-x-auto pb-2">
            {LOOP.map((s, i) => (
              <li key={s} className="flex shrink-0 items-center gap-1">
                <span className={`rounded-md border px-2.5 py-1.5 text-[0.74rem] font-bold uppercase tracking-wider ${i === 0 ? "border-accent/40 bg-accent/10 text-rose-200" : i === LOOP.length - 1 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-line bg-black/20 text-ink-2"}`}>{s}</span>
                {i < LOOP.length - 1 && <ChevronRight className="size-4 text-faint" />}
              </li>
            ))}
          </ol>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              { n: "1", t: "Raise a problem", d: "Describe what's happening as a photo, video or text post. Choose Identity Saver to stay anonymous." },
              { n: "2", t: "Understand it together", d: "People share experiences, evidence, questions and respectful counterarguments, all clearly labelled." },
              { n: "3", t: "Plan a solution", d: "Anyone can propose a Solution Card with steps, resources, funding, roles and expected outcome." },
              { n: "4", t: "Act and record the outcome", d: "Helpers join roles and pledge support. When it works, the outcome is documented and the problem is marked Solved." },
            ].map((s) => (
              <div key={s.n} className="card p-5">
                <span className="grid size-9 place-items-center rounded-full bg-brand/15 font-display font-bold text-brand-ink">{s.n}</span>
                <h3 className="section-title mt-3 text-[1rem]">{s.t}</h3>
                <p className="mt-1.5 text-[0.88rem] leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-y border-line bg-black/20">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="eyebrow !text-brand-ink">Features</p>
          <h2 className="section-title mt-2 text-[1.9rem]">Everything is built to move problems forward.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card p-5">
                <span className="grid size-10 place-items-center rounded-xl border border-line-strong bg-gradient-to-b from-elev-2 to-elev text-brand-ink">
                  <Icon className="size-5" />
                </span>
                <h3 className="section-title mt-4 text-[0.98rem]">{title}</h3>
                <p className="mt-1.5 text-[0.86rem] leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[0.86rem] text-muted">The feed supports photos (including multi-photo carousels), videos and written thoughts. RUHIZ intentionally has no short-video "reels". Instead of followers, people have Supporters and are Supporting others.</p>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <p className="eyebrow !text-sky-300">Privacy & safety</p>
            <h2 className="section-title mt-2 text-[1.9rem] leading-tight">Share honestly without exposing yourself.</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-ink-2">Your public identity on RUHIZ is your code. Your email is never shown to other members, and names can't be searched.</p>
          </div>
          <ul className="space-y-3">
            {[
              { icon: ShieldCheck, t: "Identity Saver by default", d: "Post and discuss as just your code. Switch to Identity Revealer per post when you want your name and role attached." },
              { icon: BadgeCheck, t: "Verified professionals are verified", d: "The licensed-professional badge appears only after a moderator checks the person's registration." },
              { icon: HeartHandshake, t: "Clear about what support is", d: "Peer supporters are community members, not clinicians. Crisis-line information is always shown alongside support." },
              { icon: HandHelping, t: "You control your data", d: "Edit or delete what you post, choose who can message you, hide from code search, or delete your account and everything in it." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="card flex gap-3 p-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-sky-300" />
                <div>
                  <p className="font-semibold text-ink">{t}</p>
                  <p className="mt-0.5 text-[0.86rem] leading-relaxed text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20">
        <div className="card relative mx-auto max-w-4xl overflow-hidden p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-brand/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-10 size-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative">
            <h2 className="section-title text-[1.8rem]">RUHIZ isn't designed to keep you scrolling.</h2>
            <p className="mx-auto mt-3 max-w-xl text-[1rem] text-ink-2">It's designed to help people understand problems, support each other, find people who can contribute, and reach real-world outcomes.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/sign-up" className="btn btn-red btn-lg">
                Sign Up <ArrowRight className="size-4" />
              </Link>
              <Link href="/sign-in" className="btn btn-outline btn-lg">
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-8 text-[0.8rem] text-faint">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ruhiz-logo.png" alt="RUHIZ" className="h-6 w-auto opacity-80" />
          <span>Problems, support, discussion and solutions.</span>
          <span className="ml-auto">If you are in immediate danger, contact local emergency services (112 in India) or Tele-MANAS on 14416.</span>
        </div>
      </footer>
    </div>
  );
}
