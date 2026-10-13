import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnchorLink, NAV_LINKS } from "./Nav";

export function Closing() {
  return (
    <>
      <section className="l-section !pb-16" aria-labelledby="final-title">
        <div className="l-wrap">
          <div className="l-glass l-final" data-reveal>
            <div className="l-orbit" aria-hidden />
            <div className="l-orbit o2" aria-hidden />
            <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-[#2f6bff]/30 blur-[90px]" aria-hidden />
            <div className="pointer-events-none absolute -bottom-28 -right-16 size-80 rounded-full bg-[#ff2e55]/25 blur-[90px]" aria-hidden />
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/ruhiz-mark.png" alt="" width={256} height={256} className="l-logo mx-auto size-16" />
              <h2 id="final-title" className="l-h2 l-display mx-auto mt-6 max-w-3xl">
                RUHIZ isn&rsquo;t designed to keep you scrolling. It&rsquo;s designed to <span className="l-grad-red">help</span>.
              </h2>
              <p className="l-lead mx-auto mt-5 max-w-xl">Understand a problem, support each other, find the people who can contribute, and reach a real outcome.</p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href="/sign-up" className="l-btn l-btn-primary">
                  Find Your Community <ArrowRight className="size-4" />
                </Link>
                <Link href="/sign-in" className="l-btn l-btn-glass">
                  I already have an account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="l-foot border-t border-[var(--l-line)] px-5 py-10">
        <div className="l-wrap flex flex-wrap items-start gap-x-12 gap-y-8">
          <div className="max-w-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ruhiz-logo.png" alt="RUHIZ" width={900} height={201} className="h-7 w-auto opacity-90" />
            <p className="mt-3 text-[0.84rem] leading-relaxed text-[var(--l-muted)]">Problems, support, discussion and solutions.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-[0.9rem]">
            {NAV_LINKS.map((l) => (
              <AnchorLink key={l.href} href={l.href}>{l.label}</AnchorLink>
            ))}
            <Link href="/sign-in">Sign In</Link>
            <Link href="/sign-up">Sign Up</Link>
          </nav>
          <p className="max-w-sm text-[0.8rem] leading-relaxed text-[var(--l-muted)] md:ml-auto">
            RUHIZ is a community, not an emergency service. If you or someone else is in immediate danger, contact local emergency services (112 in India) or Tele-MANAS on 14416.
          </p>
        </div>
      </footer>
    </>
  );
}
