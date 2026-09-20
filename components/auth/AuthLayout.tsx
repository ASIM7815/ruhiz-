'use client';

import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icons';

const PROOF = [
  { icon: 'flame', text: 'Daily check-ins build streaks you will not want to break.' },
  { icon: 'swords', text: 'Join community duels or create your own rules.' },
  { icon: 'trophy', text: 'Finish every day, earn the trophy, own the record.' },
];

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col lg:flex-row">
      {/* Brand panel */}
      <aside className="lg:w-[46%] xl:w-[42%] flex flex-col justify-between p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#16e08a]/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-[#16e08a]/5 blur-3xl" />
        <Link href="/" className="relative w-fit" aria-label="DUEL home">
          <Logo height={40} priority />
        </Link>

        <div className="relative py-10 lg:py-0">
          <h1 className="display text-4xl xl:text-5xl leading-[1.02] text-white">
            Challenge
            <br />
            a better
            <br />
            <span className="text-[#16e08a]">you.</span>
          </h1>
          <ul className="mt-8 space-y-3.5">
            {PROOF.map((p) => (
              <li key={p.icon} className="flex items-center gap-3 text-sm text-white/70">
                <span className="w-8 h-8 rounded-xl bg-[#16e08a]/15 text-[#16e08a] flex items-center justify-center flex-shrink-0">
                  <Icon name={p.icon} size={16} />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-white/40 tracking-[0.2em] uppercase">© 2026 DUEL</p>
      </aside>

      {/* Form panel */}
      <section className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-[var(--bg)]">
        <div className="w-full max-w-md fade-in">
          <h2 className="display text-2xl text-[var(--text)]">{title}</h2>
          <p className="text-sm text-[var(--muted)] mt-1.5 mb-7">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}

export function AuthInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  maxLength,
  error,
  trailing,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  error?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          className={`w-full bg-[var(--card)] border rounded-xl px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[#16e08a]/60 transition-shadow ${
            error ? 'border-[var(--danger)]' : 'border-[var(--border)]'
          } ${trailing ? 'pr-11' : ''}`}
        />
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-2.5 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-xl px-4 py-3 text-sm text-[var(--danger)]">
      <Icon name="warning" size={16} className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-2.5 bg-[#16e08a]/10 border border-[#16e08a]/30 rounded-xl px-4 py-3 text-sm text-[#16e08a]">
      <Icon name="check" size={16} className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
