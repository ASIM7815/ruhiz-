"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { AnchorLink } from "./Nav";

type Tone = "ice" | "rose" | "aqua";

function Word({ i, text, tone = "ice" }: { i: number; text: string; tone?: Tone }) {
  return (
    <span className="l-word" style={{ ["--i" as string]: i }}>
      <span className="x3d" data-t={text} data-tone={tone} aria-hidden>
        <span>{text}</span>
      </span>
    </span>
  );
}

/** Decides whether the WebGL scene should run at all, and how rich it should be. */
function pick3D(): "high" | "low" | null {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || nav.connection?.saveData) return null;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  if (cores <= 2 || mem <= 1) return null;
  try {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return null;
  } catch {
    return null;
  }
  return cores >= 6 && window.matchMedia("(pointer: fine)").matches ? "high" : "low";
}

type VisualMode = "loading" | "3d" | "static";

/**
 * Hero Earth. While the model downloads only a faint glow is shown (no placeholder object).
 * Devices that skip WebGL, or lose the context, get a static transparent snapshot of the same Earth.
 */
function HeroVisual() {
  const host = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<VisualMode>("loading");

  useEffect(() => {
    const quality = pick3D();
    if (!quality) {
      setMode("static");
      return;
    }
    let cancelled = false;
    let dispose: (() => void) | null = null;

    const start = async () => {
      try {
        // Three.js is a separate chunk, fetched only after the hero has painted.
        const { createHeroScene } = await import("./scene/createHeroScene");
        if (cancelled || !host.current) return;
        // Resolves once the Earth model is downloaded and the first frame is drawn.
        const handle = await createHeroScene(host.current, { quality, onLost: () => setMode("static") });
        if (cancelled) {
          handle.dispose();
          return;
        }
        dispose = handle.dispose;
        setMode("3d");
      } catch {
        if (!cancelled) setMode("static");
      }
    };
    // Safari lacks requestIdleCallback, so fall back to a short timeout after the first paint.
    const hasIdle = "requestIdleCallback" in window;
    const id = hasIdle ? window.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 700);
    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
      dispose?.();
    };
  }, []);

  return (
    <div className={`l-visual ${mode === "3d" ? "is-3d" : ""}`} data-hero-visual role="img" aria-label="A slowly rotating 3D model of planet Earth">
      <div className="l-glow" aria-hidden />
      {mode === "static" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="l-poster" src="/models/earth-poster.webp" alt="" width={810} height={810} decoding="async" />
      )}
      <div ref={host} className="l-canvas-host" />
    </div>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);

  // Gentle pointer tilt for the headline and visual (fine pointers only; off for reduced motion).
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const on = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", `${(x * 7).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-y * 5).toFixed(2)}deg`);
      });
    };
    el.addEventListener("pointermove", on, { passive: true });
    return () => {
      el.removeEventListener("pointermove", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="top" ref={root} className="l-hero" data-hero aria-labelledby="hero-title">
      <div className="l-hero-grid">
        <div data-hero-copy>
          <span className="l-eyebrow l-rise" style={{ ["--d" as string]: "0.05s" }}>
            <i /> A social platform built around real problems
          </span>

          <h1 id="hero-title" className="l-h1 l-display" aria-label="You’re not alone. Real people. Real support.">
            <span className="l-line">
              <Word i={0} text="You’re" />
              <Word i={1} text="not" />
              <Word i={2} text="alone." />
            </span>
            <span className="l-line small">
              <Word i={3} text="Real" tone="aqua" />
              <Word i={4} text="people." tone="aqua" />
            </span>
            <span className="l-line small">
              <Word i={5} text="Real" tone="rose" />
              <Word i={6} text="support." tone="rose" />
            </span>
          </h1>

          <p className="l-hero-copy-text l-rise" style={{ ["--d" as string]: "0.85s" }}>
            RUHIZ connects people facing real problems with people who understand, knowledge that helps, and resources that move conversations toward meaningful outcomes.
          </p>

          <div className="l-rise mt-8 flex flex-wrap gap-3" style={{ ["--d" as string]: "1s" }}>
            <Link href="/sign-up" className="l-btn l-btn-primary">
              Find Your Community <ArrowRight className="size-4" />
            </Link>
            <AnchorLink href="#how" className="l-btn l-btn-glass">
              Explore RUHIZ
            </AnchorLink>
          </div>

          <p className="l-assure l-rise" style={{ ["--d" as string]: "1.15s" }}>
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-400" />
            <span>Join with just an email. Your name is never public unless you choose to reveal it, and you can take part as Identity Saver with only a code.</span>
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}
