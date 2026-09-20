'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StoreProvider, useStore } from '@/lib/duel/store';
import AuthLayout, { AuthError, AuthInput } from '@/components/auth/AuthLayout';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Primitives';

function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function SignupInner() {
  const store = useStore();
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (store.hydrated && store.authed) router.replace('/feed');
  }, [store.hydrated, store.authed, router]);

  const score = passwordScore(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Tell us your name (2+ characters).';
    if (username && username.replace(/[^a-zA-Z0-9_]/g, '').length < 3) errs.username = 'Username needs 3+ characters (letters, numbers, underscore).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (score < 2) errs.password = 'Use at least 8 characters with a mix of cases or numbers.';
    if (!agree) errs.agree = 'Please accept the community rules to continue.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setError('');
    try {
      const res = await store.signUp({ email: email.trim(), password, name: name.trim(), username: username.trim() });
      if (res.needsEmailConfirm) {
        router.replace(`/confirm-email?email=${encodeURIComponent(email.trim())}`);
      } else {
        router.replace('/feed');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Free forever. Your first streak starts today.">
      <AuthError message={error} />
      <form onSubmit={submit} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <AuthInput label="Full name" value={name} onChange={setName} placeholder="Alex Runner" autoComplete="name" error={errors.name} />
          <AuthInput label="Username" value={username} onChange={(v) => setUsername(v.replace(/[^a-zA-Z0-9_]/g, ''))} placeholder="alex_runs" autoComplete="username" maxLength={20} error={errors.username} />
        </div>
        <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" error={errors.email} />
        <AuthInput
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          placeholder="8+ characters"
          autoComplete="new-password"
          error={errors.password}
          trailing={
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--text)]" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
            </button>
          }
        />
        {password && (
          <div className="flex gap-1.5 -mt-2 mb-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? (score >= 4 ? 'bg-[#16e08a]' : score >= 2 ? 'bg-amber-400' : 'bg-red-400') : 'bg-[var(--border)]'}`} />
            ))}
          </div>
        )}

        <label className="flex items-start gap-3 mb-5 cursor-pointer select-none">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#16e08a]" />
          <span className="text-xs text-[var(--muted)] leading-relaxed">
            I agree to play fair: real check-ins, respect for other challengers, and no spam. These are the DUEL community rules.
          </span>
        </label>
        {errors.agree && <p className="text-xs text-[var(--danger)] -mt-3 mb-4">{errors.agree}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#16e08a] text-black font-bold text-sm hover:bg-[#0dbb72] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Spinner size={16} />} Create account
        </button>
      </form>

      <p className="text-center text-sm text-[var(--muted)] mt-7">
        Already duelling?{' '}
        <Link href="/login" className="text-[#16e08a] font-bold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function SignupPage() {
  return (
    <StoreProvider>
      <SignupInner />
    </StoreProvider>
  );
}
