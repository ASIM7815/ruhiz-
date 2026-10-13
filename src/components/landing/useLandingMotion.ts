"use client";

import { useEffect, type RefObject } from "react";
import { setLenis } from "./scroll";

type Gsap = typeof import("gsap").gsap;
type ST = typeof import("gsap/ScrollTrigger").ScrollTrigger;

/**
 * All landing-page scroll behaviour lives here: smooth scrolling (Lenis), scroll-triggered
 * reveals, parallax and the pinned "how it works" sequence. It is mounted only by the public
 * landing page and removes everything it created on unmount, so the signed-in app and the auth
 * pages keep the browser's normal scrolling.
 *
 * With `prefers-reduced-motion` nothing here runs, and content simply stays in place.
 */
export function useLandingMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const html = document.documentElement;
    html.classList.add("landing-js");
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("lenis")]);
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);

        const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
        setLenis(lenis);
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        const mm = gsap.matchMedia();
        const ctx = gsap.context(() => {
          setupReveals(gsap, ScrollTrigger, root);
          setupParallax(gsap, root);
          setupJourney(gsap, ScrollTrigger, mm, root);
        }, root);

        const refresh = () => ScrollTrigger.refresh();
        window.addEventListener("load", refresh);
        document.fonts?.ready.then(refresh).catch(() => {});
        (window as unknown as { __landingReady?: boolean }).__landingReady = true;

        cleanup = () => {
          window.removeEventListener("load", refresh);
          mm.revert();
          ctx.revert();
          ScrollTrigger.getAll().forEach((t) => t.kill());
          gsap.ticker.remove(tick);
          gsap.ticker.lagSmoothing(500, 33);
          lenis.destroy();
          setLenis(null);
        };
      } catch {
        // If the animation libraries fail to load, show the page normally instead of leaving content hidden.
        html.classList.remove("landing-js");
      }
    })();

    return () => {
      disposed = true;
      cleanup();
      html.classList.remove("landing-js");
      delete (window as unknown as { __landingReady?: boolean }).__landingReady;
    };
  }, [rootRef]);
}

function setupReveals(gsap: Gsap, ScrollTrigger: ST, root: HTMLElement) {
  const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
  ScrollTrigger.batch(els, {
    start: "top 90%",
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: 1.05, ease: "power3.out", stagger: 0.09, overwrite: true, clearProps: "transform" }),
  });
}

function setupParallax(gsap: Gsap, root: HTMLElement) {
  // Background blobs drift across the whole page.
  root.querySelectorAll<HTMLElement>("[data-drift]").forEach((el) => {
    const amount = Number(el.dataset.drift) || 120;
    gsap.to(el, { y: amount, ease: "none", scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.6 } });
  });
  // Section-level depth: each element moves at its own speed while its section crosses the screen.
  root.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
    const speed = Number(el.dataset.parallax) || 0.15;
    gsap.fromTo(
      el,
      { y: () => -speed * 160 },
      { y: () => speed * 160, ease: "none", scrollTrigger: { trigger: el.closest("section") ?? el, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } },
    );
  });
  // Hero content eases away as you scroll past it.
  const hero = root.querySelector<HTMLElement>("[data-hero]");
  const copy = root.querySelector<HTMLElement>("[data-hero-copy]");
  const visual = root.querySelector<HTMLElement>("[data-hero-visual]");
  if (hero && copy) gsap.to(copy, { y: -60, opacity: 0.35, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
  if (hero && visual) gsap.to(visual, { y: 90, scale: 0.94, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
}

/** Desktop: pin the section and let scroll drive the four steps. Smaller screens show all steps stacked. */
function setupJourney(gsap: Gsap, ScrollTrigger: ST, mm: ReturnType<Gsap["matchMedia"]>, root: HTMLElement) {
  const sec = root.querySelector<HTMLElement>("[data-journey]");
  if (!sec) return;
  const steps = Number(sec.dataset.steps) || 4;
  mm.add("(min-width: 1024px)", () => {
    ScrollTrigger.create({
      trigger: sec,
      start: "top top",
      end: () => `+=${Math.round(window.innerHeight * 0.85 * steps)}`,
      pin: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const s = self.progress * (steps - 1);
        sec.style.setProperty("--s", s.toFixed(3));
        sec.style.setProperty("--p", self.progress.toFixed(3));
        sec.dataset.step = String(Math.round(s));
      },
    });
    return () => {
      sec.style.removeProperty("--s");
      sec.style.removeProperty("--p");
      sec.dataset.step = "0";
    };
  });
}
