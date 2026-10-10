"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
}

const W = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-2xl", xl: "max-w-4xl" };

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, subtitle, icon, size = "md", children, footer, bodyClassName }: ModalProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-[#01040d]/75 backdrop-blur-sm anim-fade" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? id : undefined}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line-strong bg-[var(--card-solid)] shadow-[0_40px_80px_-20px_rgba(0,0,0,.9)] outline-none anim-scale sm:rounded-2xl",
          W[size],
        )}
      >
        {title && (
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            {icon && <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand-ink">{icon}</div>}
            <div className="min-w-0 flex-1">
              <h2 id={id} className="section-title text-[1.05rem]">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-[0.84rem] text-muted">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm -mr-1" aria-label="Close dialog">
              <X className="size-4.5" />
            </button>
          </div>
        )}
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", bodyClassName)}>{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-black/10 px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Side drawer used for mobile navigation and the contextual panel. */
export function Drawer({
  open,
  onClose,
  side = "left",
  children,
  label,
  className,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-[#01040d]/70 backdrop-blur-sm anim-fade" onClick={onClose} />
      <div
        className={cn(
          "absolute top-0 bottom-0 flex w-[min(86vw,330px)] flex-col overflow-y-auto border-line-strong bg-panel shadow-2xl",
          side === "left" ? "left-0 border-r anim-left" : "right-0 border-l anim-right",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
