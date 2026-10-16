import Link from "next/link";
import { ArrowRight, Mail, ExternalLink } from "lucide-react";
import { AnchorLink, NAV_LINKS } from "./Nav";

const FOOTER_SECTIONS = {
  platform: {
    title: "Platform",
    links: [
      { label: "How It Works", href: "#how" },
      { label: "Features", href: "#features" },
      { label: "Privacy", href: "#privacy" },
      { label: "Pricing", href: "/pricing" },
    ]
  },
  community: {
    title: "Community",
    links: [
      { label: "Categories", href: "/explore" },
      { label: "Success Stories", href: "/success-stories" },
      { label: "Top Contributors", href: "/contributors" },
      { label: "Campus Ambassadors", href: "/ambassadors" },
    ]
  },
  resources: {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Study Guides", href: "/guides" },
      { label: "Placement Prep", href: "/placement-prep" },
      { label: "Project Ideas", href: "/projects" },
    ]
  },
  company: {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Press Kit", href: "/press" },
    ]
  },
  legal: {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Community Guidelines", href: "/guidelines" },
      { label: "Cookie Policy", href: "/cookies" },
    ]
  },
};

const SOCIAL_LINKS = [
  { label: "Twitter", href: "https://twitter.com/ruhiz" },
  { label: "LinkedIn", href: "https://linkedin.com/company/ruhiz" },
  { label: "Instagram", href: "https://instagram.com/ruhiz" },
  { label: "YouTube", href: "https://youtube.com/@ruhiz" },
  { label: "GitHub", href: "https://github.com/ruhiz" },
];

export function Closing() {
  return (
    <>
      {/* Final CTA Section */}
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
              <h2 id="final-title" className="l-h2 l-display mx-auto mt-6 max-w-4xl">
                Your engineering community <span className="l-grad-red">awaits</span>.
              </h2>
              <p className="l-lead mx-auto mt-5 max-w-2xl">
                Join 15,000+ engineering students solving problems together. From confused freshman to confident engineer—your journey starts here.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href="/sign-up" className="l-btn l-btn-primary">
                  Start Your Journey <ArrowRight className="size-4" />
                </Link>
                <Link href="/sign-in" className="l-btn l-btn-glass">
                  I already have an account
                </Link>
              </div>
              <p className="mx-auto mt-6 text-sm text-[var(--l-muted)]">
                Free forever. No credit card required. Join in 30 seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive Footer */}
      <footer className="l-foot border-t border-[var(--l-line)] bg-black/20 px-5 py-12">
        <div className="l-wrap">
          {/* Main Footer Content */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
            {/* Brand Column */}
            <div className="lg:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/ruhiz-logo.png" alt="RUHIZ" width={900} height={201} className="h-7 w-auto opacity-90" />
              <p className="mt-3 text-[0.9rem] font-medium text-white">Where Engineering Students Grow Together</p>
              <p className="mt-2 text-[0.84rem] leading-relaxed text-[var(--l-muted)]">
                From DSA struggles to placement victories, project showcases to career questions—we're building the community engineering students deserve.
              </p>
              
              {/* Social Links */}
              <div className="mt-5 flex items-center gap-3">
                {SOCIAL_LINKS.map(({ href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid size-9 place-items-center rounded-full border border-[var(--l-line)] bg-white/5 text-[var(--l-muted)] transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-400"
                    aria-label={label}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                ))}
              </div>

              {/* Trust Indicators */}
              <div className="mt-6 space-y-2 text-[0.8rem] text-[var(--l-muted)]">
                <p className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Trusted by students from IITs, NITs, and 120+ colleges
                </p>
                <p className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-sky-400" />
                  Your data is encrypted and never sold
                </p>
              </div>
            </div>

            {/* Navigation Columns */}
            {Object.entries(FOOTER_SECTIONS).map(([key, section]) => (
              <nav key={key} aria-label={section.title}>
                <h3 className="text-[0.9rem] font-semibold text-white">{section.title}</h3>
                <ul className="mt-3 space-y-2">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith('#') ? (
                        <AnchorLink href={link.href} className="text-[0.84rem] text-[var(--l-muted)] transition-colors hover:text-cyan-400">
                          {link.label}
                        </AnchorLink>
                      ) : (
                        <Link href={link.href} className="text-[0.84rem] text-[var(--l-muted)] transition-colors hover:text-cyan-400">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/* Newsletter Signup */}
          <div className="mt-10 rounded-2xl border border-[var(--l-line)] bg-gradient-to-br from-blue-500/10 to-violet-500/10 p-6">
            <div className="grid gap-6 md:grid-cols-[1fr_auto]">
              <div>
                <h3 className="text-lg font-semibold text-white">Stay Updated</h3>
                <p className="mt-1 text-[0.85rem] text-[var(--l-muted)]">
                  Get weekly digests of top solutions, placement experiences, and career opportunities.
                </p>
              </div>
              <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--l-muted)]" />
                  <input
                    type="email"
                    placeholder="your.email@college.edu"
                    className="h-11 w-full rounded-full border border-[var(--l-line)] bg-black/40 pl-10 pr-4 text-[0.9rem] text-white placeholder:text-[var(--l-muted)] focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-2.5 text-[0.9rem] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--l-line)] pt-8 text-[0.8rem] text-[var(--l-muted)]">
            <p>
              © {new Date().getFullYear()} RUHIZ. Made with{" "}
              <span className="text-rose-400" aria-label="love">❤️</span>{" "}
              for engineering students.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/sitemap" className="hover:text-cyan-400">Sitemap</Link>
              <Link href="/image-credits" className="hover:text-cyan-400">Image Credits</Link>
              <Link href="/accessibility" className="hover:text-cyan-400">Accessibility</Link>
            </div>
          </div>

          {/* Emergency Notice */}
          <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
            <p className="text-[0.85rem] leading-relaxed text-amber-200">
              <strong className="font-semibold">Important:</strong> RUHIZ is a peer community, not a crisis service or professional counseling platform. If you're experiencing a mental health emergency, please contact{" "}
              <a href="tel:14416" className="font-semibold underline hover:text-amber-100">Tele-MANAS (14416)</a> or{" "}
              <a href="tel:112" className="font-semibold underline hover:text-amber-100">Emergency Services (112)</a> immediately.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
