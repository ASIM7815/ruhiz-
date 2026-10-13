import type Lenis from "lenis";

/** The landing page's smooth-scroll instance. Null everywhere else, so no other route is affected. */
let instance: Lenis | null = null;

export const setLenis = (l: Lenis | null) => {
  instance = l;
};
export const getLenis = () => instance;

/** Scrolls to a section id; uses the smooth scroller when active, otherwise the browser's own scrolling. */
export function scrollToSection(hash: string, offset = -88) {
  const el = document.querySelector<HTMLElement>(hash);
  if (!el) return;
  if (instance) instance.scrollTo(el, { offset, duration: 1.3 });
  else el.scrollIntoView({ behavior: "auto", block: "start" });
  history.replaceState(null, "", hash);
  // Move keyboard focus with the view so screen-reader and keyboard users land in the section.
  el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}
