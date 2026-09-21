'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StoreProvider } from '@/lib/duel/store';
import AuthLayout, { AuthError, AuthInput, AuthSuccess } from '@/components/auth/AuthLayout';
import { Spinner } from '@/components/ui/Primitives';
import { isSupabaseConfigured } from '@/lib/config';

function ForgotInner() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        throw new Error('Password recovery needs the configured Supabase backend.');
      }
      const { createClient } = await import('@/lib/supabase/client');
      const { error: err } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw new Error(err.message);
      setSuccess('Recovery email sent. Follow the link to set a new password.');
    } catch (err: any) {
      setError(err?.message ?? 'Could not start recovery.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="We will get you back into your duels.">
      <AuthError message={error} />
      <AuthSuccess message={success} />
      <form onSubmit={submit} noValidate>
        <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#16e08a] text-black font-bold text-sm hover:bg-[#0dbb72] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Spinner size={16} />} Send recovery email
        </button>
      </form>
      <p className="text-center text-sm text-[var(--muted)] mt-7">
        Remembered it?{' '}
        <Link href="/login" className="text-[#16e08a] font-bold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function ForgotPasswordPage() {
  return (
    <StoreProvider>
      <ForgotInner />
    </StoreProvider>
  );
}
