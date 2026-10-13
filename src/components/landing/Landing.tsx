"use client";

import { useRef } from "react";
import { CircleCheckBig } from "lucide-react";
import "./landing.css";
import { sora } from "./fonts";
import { useLandingMotion } from "./useLandingMotion";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { Problem } from "./Problem";
import { Journey } from "./Journey";
import { Preview } from "./Preview";
import { Features } from "./Features";
import { Privacy } from "./Privacy";
import { Closing } from "./Closing";

/** The public landing page. Smooth scrolling and scroll animation exist only while this is mounted. */
export function Landing({ accountDeleted }: { accountDeleted?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useLandingMotion(root);

  return (
    <div ref={root} className={`landing ${sora.variable}`}>
      <div className="l-atmos" aria-hidden>
        <div className="l-blob b1" data-drift="-160" />
        <div className="l-blob b2" data-drift="140" />
        <div className="l-blob b3" data-drift="-120" />
        <div className="l-floor" />
        <div className="l-grain" />
      </div>

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-[#2f7bff] focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Nav />

      <main id="main">
        {accountDeleted && (
          <p role="status" className="l-glass relative z-10 mx-auto mt-24 flex max-w-xl items-center gap-2 !rounded-2xl p-3 text-[0.9rem] text-[var(--l-ink2)]">
            <CircleCheckBig className="size-4 text-emerald-400" /> Your account and its content have been deleted.
          </p>
        )}
        <Hero />
        <Problem />
        <Journey />
        <Preview />
        <Features />
        <Privacy />
      </main>
      <Closing />
    </div>
  );
}
