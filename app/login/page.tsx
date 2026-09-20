'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { StoreProvider, useStore } from '@/lib/duel/store';
import AuthLayout, { AuthError, AuthInput, AuthSuccess } from '@/components/auth/AuthLayout';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Primitives';

function LoginInner() {
  const store = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(searchParams?.get('verified') === 'true' ? 'Email confirmed — welcome back. Sign in to continue.' : '');

  useEffect(() => {
    if (store.hydrated && store.authed) router.replace('/feed');
  }, [store.hydrated, store.authed, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await store.signIn(email.trim(), password);
      router.replace('/feed');
    } catch (err: any) {
      setError(err?.message ?? 'Sign-in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Pick up your streaks where you left them.">
      <AuthError message={error} />
      <AuthSuccess message={success} />
      <form onSubmit={submit} noValidate>
        <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
        <AuthInput
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
          trailing={
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--text)]" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
            </button>
          }
        />
        <div className="flex justify-end -mt-1 mb-5">
          <Link href="/forgot-password" className="text-xs font-semibold text-[#16e08a] hover:underline">
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#16e08a] text-black font-bold text-sm hover:bg-[#0dbb72] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Spinner size={16} />} Sign in
        </button>
      </form>

      {store.dataMode === 'demo' && (
        <div className="mt-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 text-xs text-[var(--muted)] leading-relaxed">
          <p className="font-bold text-[var(--text)] mb-1 flex items-center gap-1.5">
            <Icon name="info" size={13} className="text-[#16e08a]" /> Preview mode
          </p>
          Accounts live in this browser until Supabase credentials are configured.{' '}
          <Link href="/signup" className="text-[#16e08a] font-semibold hover:underline">
            Create yours
          </Link>{' '}
          — it takes ten seconds.
        </div>
      )}

      <p className="text-center text-sm text-[var(--muted)] mt-7">
        New to DUEL?{' '}
        <Link href="/signup" className="text-[#16e08a] font-bold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <StoreProvider>
      <Suspense fallback={null}>
        <LoginInner />
      </Suspense>
    </StoreProvider>
  );
}
