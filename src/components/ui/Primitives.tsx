"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";

/* ───────── Toggle ───────── */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} data-on={on} onClick={() => onChange(!on)} className="toggle" />;
}

/* ───────── Tabs ───────── */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  size = "md",
}: {
  tabs: { id: T; label: string; count?: number; icon?: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-line", className)}>
      {tabs.map((t) => {
        const on = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            data-on={on}
            onClick={() => onChange(t.id)}
            className={cn(
              "tab-underline inline-flex shrink-0 items-center gap-1.5 rounded-t-md px-3 font-semibold transition-colors",
              size === "sm" ? "h-9 text-[0.8rem]" : "h-11 text-[0.86rem]",
              on ? "text-ink" : "text-muted hover:text-ink-2",
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {t.label}
            {t.count !== undefined && (
              <span className={cn("rounded-md px-1.5 py-px text-[0.7rem] tabular-nums", on ? "bg-accent/15 text-rose-200" : "bg-white/5 text-faint")}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ───────── Segmented control ───────── */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { id: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-[10px] border border-line bg-black/20 p-0.5", className)} role="radiogroup">
      {options.map((o) => {
        const on = o.id === value;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.8rem] font-semibold transition-all",
              on ? "bg-elev-2 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.06)]" : "text-muted hover:text-ink-2",
            )}
          >
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────── Progress ───────── */
export function Progress({ value, tone = "blue", className }: { value: number; tone?: "blue" | "red" | "green"; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const bar = tone === "red" ? "from-[#ff4466] to-[#e3173f]" : tone === "green" ? "from-emerald-400 to-emerald-500" : "from-[#4b92ff] to-[#1e5ef0]";
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-white/[.06]", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ───────── Empty state ───────── */
export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  text: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="relative mb-5 grid size-16 place-items-center rounded-2xl border border-line-strong bg-gradient-to-b from-elev-2 to-elev">
        <Icon className="size-7 text-brand-ink" aria-hidden />
        <span className="absolute -right-1 -top-1 size-3 rounded-full bg-accent shadow-[0_0_12px_rgba(255,46,85,.8)]" />
      </div>
      <h3 className="section-title text-lg">{title}</h3>
      <div className="mt-1.5 max-w-md text-[0.9rem] leading-relaxed text-muted">{text}</div>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ───────── Dropdown menu ─────────
 * Rendered in a portal with fixed positioning, so a card's `overflow: hidden` can't clip it
 * (that clipping is what hid "Delete post" at the bottom of short posts). It opens upward when
 * there's more room above, scrolls when taller than the viewport, and is keyboard operable.
 */
export function Menu({
  trigger,
  children,
  align = "right",
  className,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const t = ref.current?.getBoundingClientRect();
      const m = menu.current;
      if (!t || !m) return;
      const gap = 8;
      const mh = m.scrollHeight;
      const mw = m.offsetWidth;
      const below = window.innerHeight - t.bottom - gap * 2;
      const above = t.top - gap * 2;
      const up = mh > below && above > below;
      const maxH = Math.max(140, up ? above : below);
      const left = Math.min(Math.max(gap, align === "right" ? t.right - mw : t.left), window.innerWidth - mw - gap);
      const top = up ? Math.max(gap, t.top - gap - Math.min(mh, maxH)) : t.bottom + gap;
      setPos({ top, left, maxH });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    // Focus the first item once positioned, for keyboard users.
    const id = window.setTimeout(() => items()[0]?.focus({ preventScroll: true }), 0);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector<HTMLElement>("button,[href]")?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const list = items();
        if (!list.length) return;
        e.preventDefault();
        const i = list.indexOf(document.activeElement as HTMLElement);
        list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length].focus();
      } else if (e.key === "Tab") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, maxHeight: pos?.maxH, visibility: pos ? "visible" : "hidden" }}
            className={cn(
              "z-[75] min-w-[13rem] overflow-y-auto overscroll-contain rounded-xl border border-line-strong bg-[var(--card-solid)] p-1.5 shadow-[0_24px_50px_-16px_rgba(0,0,0,.9)] anim-scale",
              className,
            )}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onClick,
  href,
  danger,
  hint,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  hint?: string;
}) {
  const cls = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.85rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand",
    danger ? "text-rose-300 hover:bg-rose-500/10 focus:bg-rose-500/10" : "text-ink-2 hover:bg-white/[.06] hover:text-ink focus:bg-white/[.06]",
  );
  const inner = (
    <>
      {Icon && <Icon className="size-4 shrink-0 opacity-80" aria-hidden />}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[0.72rem] text-faint">{hint}</span>}
    </>
  );
  if (href)
    return (
      <Link role="menuitem" href={href} onClick={onClick} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button role="menuitem" type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ───────── Toasts ───────── */
export function Toasts() {
  const { state, actions } = useStore();
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[90] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0" aria-live="polite">
      {state.toasts.map((t) => {
        const Icon = t.tone === "error" ? TriangleAlert : t.tone === "info" ? Info : CircleCheck;
        return (
          <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line-strong bg-[var(--elev)]/95 px-3.5 py-3 shadow-[0_20px_40px_-14px_rgba(0,0,0,.9)] backdrop-blur anim-up">
            <Icon className={cn("size-4.5 shrink-0", t.tone === "error" ? "text-rose-400" : t.tone === "info" ? "text-brand-ink" : "text-emerald-400")} />
            <p className="flex-1 text-[0.85rem] font-medium text-ink">{t.text}</p>
            {t.action && (
              <Link href={t.action.href} onClick={() => actions.dismissToast(t.id)} className="text-[0.8rem] font-semibold text-brand-ink hover:text-white">
                {t.action.label}
              </Link>
            )}
            <button onClick={() => actions.dismissToast(t.id)} className="rounded p-0.5 text-faint hover:text-ink" aria-label="Dismiss">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Card header ───────── */
export function CardTitle({
  icon: Icon,
  iconClass,
  title,
  action,
}: {
  icon: LucideIcon;
  iconClass?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
      <h3 className="flex items-center gap-2 font-display text-[0.95rem] font-bold tracking-tight text-ink">
        <Icon className={cn("size-[1.1rem]", iconClass ?? "text-accent")} aria-hidden />
        {title}
      </h3>
      {action}
    </div>
  );
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[0.8rem] font-semibold text-ink-2">{label}</span>
        {hint && <span className="text-[0.72rem] text-faint">{hint}</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-[0.76rem] text-rose-300" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
