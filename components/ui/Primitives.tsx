'use client';

import React, { useEffect } from 'react';
import { Icon } from './Icons';
import { initials } from '@/lib/format';
import { useMediaUrl } from './Media';
import type { UserProfile } from '@/lib/types';
import type { Category, Difficulty } from '@/lib/duel/types';

/* ------------------------------- Avatar ------------------------------ */

export function Avatar({
  user,
  size = 44,
  ring = false,
  onClick,
  className = '',
}: {
  user: Pick<UserProfile, 'avatar' | 'avatarHue' | 'name'>;
  size?: number;
  ring?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const hue = user.avatarHue ?? 152;
  const avatarUrl = useMediaUrl(user.avatar);
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`relative rounded-full overflow-hidden flex-shrink-0 ${ring ? 'ring-2 ring-[var(--brand)]' : ''} ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={user.name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white font-semibold select-none"
          style={{
            background: `linear-gradient(135deg, hsl(${hue}, 45%, 42%), hsl(${(hue + 40) % 360}, 50%, 28%))`,
            fontSize: size * 0.36,
          }}
        >
          {initials(user.name)}
        </div>
      )}
    </Comp>
  );
}

/* ------------------------------- Modal ------------------------------- */

export function Modal({
  open,
  onClose,
  children,
  maxWidth = 'max-w-lg',
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div className={`w-full ${maxWidth} max-h-[92vh] overflow-y-auto bg-[var(--card)] border border-[var(--border)] rounded-t-3xl sm:rounded-3xl shadow-2xl slide-up`}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose, subtitle }: { title: string; onClose: () => void; subtitle?: string }) {
  return (
    <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[var(--border)] sticky top-0 bg-[var(--card)] z-10 rounded-t-3xl">
      <div>
        <h3 className="text-lg font-bold text-[var(--text)] display">{title}</h3>
        {subtitle && <p className="text-sm text-[var(--muted)] mt-0.5 normal-case tracking-normal font-sans font-normal">{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        className="p-2 rounded-full hover:bg-[var(--card-2)] text-[var(--muted)] transition-colors"
        aria-label="Close"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

/* ----------------------------- EmptyState ---------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="fade-in bg-[var(--card)] border border-[var(--border)] rounded-2xl py-14 px-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--brand-soft)] flex items-center justify-center text-[var(--brand)]">
        <Icon name={icon} size={28} />
      </div>
      <h3 className="text-lg font-bold text-[var(--text)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--muted)] max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ------------------------------ Skeletons ----------------------------- */

export function CardSkeleton() {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden animate-pulse">
      <div className="h-36 bg-[var(--card-2)]" />
      <div className="p-5 space-y-3">
        <div className="h-4 w-2/3 rounded bg-[var(--card-2)]" />
        <div className="h-3 w-full rounded bg-[var(--card-2)]" />
        <div className="h-3 w-4/5 rounded bg-[var(--card-2)]" />
        <div className="flex gap-2 pt-1">
          <div className="h-6 w-20 rounded-full bg-[var(--card-2)]" />
          <div className="h-6 w-24 rounded-full bg-[var(--card-2)]" />
        </div>
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ------------------------------- Toggle ------------------------------ */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/* ----------------------------- Segmented ----------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex bg-[var(--card-2)] rounded-xl p-1 gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            value === o.value
              ? 'bg-[var(--brand)] text-black shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Badge ------------------------------ */

export function Badge({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'muted' | 'danger' }) {
  const cls =
    tone === 'brand'
      ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
      : tone === 'danger'
        ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
        : 'bg-[var(--card-2)] text-[var(--muted)]';
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>;
}

export function DifficultyBadge({ level }: { level: Difficulty }) {
  const map: Record<Difficulty, { label: string; cls: string }> = {
    easy: { label: 'Easy', cls: 'bg-[var(--brand-soft)] text-[var(--brand)]' },
    medium: { label: 'Medium', cls: 'bg-amber-500/15 text-amber-400' },
    hard: { label: 'Hard', cls: 'bg-red-500/15 text-red-400' },
  };
  const m = map[level] ?? map.medium;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

/* ------------------------------- Spinner ----------------------------- */

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------ Buttons ------------------------------ */

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = '',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2.5 bg-[var(--brand)] text-black font-bold rounded-xl hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 text-sm ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2.5 border border-[var(--border)] text-[var(--text)] font-medium rounded-xl hover:bg-[var(--card-2)] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm ${className}`}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Progress bar --------------------------- */

export function ProgressBar({ value, max, className = '', color }: { value: number; max: number; className?: string; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`h-2 rounded-full bg-[var(--card-2)] overflow-hidden ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color ?? 'linear-gradient(90deg, var(--brand-dark), var(--brand))' }}
      />
    </div>
  );
}

/* -------------------------------- Cover ------------------------------- */

/** Challenge cover: uploaded image, else a category-tinted gradient plate. */
export function Cover({
  coverUrl,
  category,
  title,
  className = '',
}: {
  coverUrl?: string | null;
  category?: Category;
  title?: string;
  className?: string;
}) {
  const url = useMediaUrl(coverUrl);
  const color = category?.color ?? '#16e08a';
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={title ?? 'Challenge cover'} className={`object-cover w-full h-full ${className}`} loading="lazy" />
    );
  }
  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{ background: `radial-gradient(120% 120% at 15% 0%, ${color}44 0%, ${color}14 45%, transparent 70%), linear-gradient(140deg, #10151a 0%, #0b0f13 60%, ${color}22 100%)` }}
    >
      <span className="text-4xl opacity-80 select-none">{category?.emoji ?? '🎯'}</span>
    </div>
  );
}
