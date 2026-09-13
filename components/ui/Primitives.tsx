'use client';

import React, { useEffect } from 'react';
import { Icon } from './Icons';
import { initials } from '@/lib/format';
import type { UserProfile } from '@/lib/types';

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
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`relative rounded-full overflow-hidden flex-shrink-0 ${ring ? 'ring-2 ring-[var(--card)]' : ''} ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      {user.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white font-semibold select-none"
          style={{
            background: `linear-gradient(135deg, hsl(${hue}, 42%, 52%), hsl(${(hue + 40) % 360}, 45%, 38%))`,
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
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className={`w-full ${maxWidth} max-h-[92vh] overflow-y-auto bg-[var(--card)] rounded-t-3xl sm:rounded-3xl shadow-2xl slide-up`}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose, subtitle }: { title: string; onClose: () => void; subtitle?: string }) {
  return (
    <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[var(--border)] sticky top-0 bg-[var(--card)] z-10 rounded-t-3xl">
      <div>
        <h3 className="text-lg font-bold text-[var(--text)]">{title}</h3>
        {subtitle && <p className="text-sm text-[var(--muted)] mt-0.5">{subtitle}</p>}
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
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--brand-soft)] flex items-center justify-center text-[var(--brand)]">
        <Icon name={icon} size={28} />
      </div>
      <h3 className="text-lg font-bold text-[var(--text)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--muted)] max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ------------------------------ Skeleton ----------------------------- */

export function PostSkeleton() {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-[var(--card-2)]" />
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-[var(--card-2)]" />
          <div className="h-2.5 w-20 rounded bg-[var(--card-2)]" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 w-full rounded bg-[var(--card-2)]" />
        <div className="h-3 w-4/5 rounded bg-[var(--card-2)]" />
      </div>
      <div className="h-48 rounded-xl bg-[var(--card-2)]" />
    </div>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
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
    <div className="inline-flex bg-[var(--card-2)] rounded-xl p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            value === o.value
              ? 'bg-[var(--card)] text-[var(--brand)] shadow-sm'
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
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>;
}

/* ------------------------------- Spinner ----------------------------- */

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
    >
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
      className={`px-5 py-2.5 bg-[var(--brand)] text-white font-semibold rounded-xl hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 text-sm ${className}`}
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

/* ------------------------------ FollowBtn ---------------------------- */

export function FollowButton({
  following,
  onToggle,
  small = false,
}: {
  following: boolean;
  onToggle: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={`${small ? 'px-3.5 py-1.5 text-xs' : 'px-4 py-2 text-sm'} rounded-xl font-semibold transition-all ${
        following
          ? 'bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--border)]'
          : 'bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]'
      }`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
