"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { getLenis, scrollToSection } from "./scroll";

export const NAV_LINKS = [
  { href: "#why", label: "Why RUHIZ" },
  { href: "#how", label: "How It Works" },
  { href: "#features", label: "Features" },
  { href: "#community", label: "Community" },
  { href: "#privacy", label: "Privacy" },
];

/** Anchor link that uses the smooth scroller when it is active and plain anchors otherwise. */
export function AnchorLink({ href, className, children, onNavigate }: { href: string; className?: string; children: React.ReactNode; onNavigate?: () => void }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onNavigate?.();
        // Let the mobile menu release its scroll lock first, then travel.
        requestAnimationFrame(() => scrollToSection(href));
      }}
    >
      {children}
    </a>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    getLenis()?.stop();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      getLenis()?.start();
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className={`l-nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="l-nav-bar">
        <AnchorLink href="#top" className="flex shrink-0 items-center" onNavigate={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ruhiz-logo.png" alt="RUHIZ" width={900} height={201} className="l-logo h-7 w-auto sm:h-8" />
        </AnchorLink>

        <nav aria-label="Page sections" className="ml-4 hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((l) => (
            <AnchorLink key={l.href} href={l.href} className="l-nav-link">
              {l.label}
            </AnchorLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/sign-in" className="l-nav-link hidden sm:inline-block">
            Sign In
          </Link>
          <Link href="/sign-up" className="l-btn l-btn-primary !h-10 !px-4 !text-[0.86rem]">
            Sign Up
          </Link>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-white hover:bg-white/10 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="l-mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="l-mobile-menu" className="l-menu" role="dialog" aria-modal="true" aria-label="Menu" style={{ pointerEvents: "auto" }}>
          {NAV_LINKS.map((l) => (
            <AnchorLink key={l.href} href={l.href} className="l-menu-link" onNavigate={() => setOpen(false)}>
              {l.label}
            </AnchorLink>
          ))}
          <Link href="/sign-in" className="l-menu-link" onClick={() => setOpen(false)}>
            Sign In
          </Link>
        </div>
      )}
    </header>
  );
}
