'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthLayout, { AuthError, AuthSuccess } from '@/components/auth/AuthLayout';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Primitives';
import { isSupabaseConfigured } from '@/lib/config';

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleResend = async () => {
    setResending(true);
    setMessage('');
    setError('');
    try {
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const { createClient } = await import('@/lib/supabase/client');
      const { error: err } = await createClient().auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${redirectUrl}/auth/callback?next=/auth/verified` },
      });
      if (err) throw new Error(err.message);
      setMessage('Verification email sent — check your inbox.');
    } catch (err: any) {
      setError(err?.message ?? 'Could not resend the email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title="Confirm your email" subtitle="One click stands between you and your first challenge.">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-center mb-6">
        <span className="w-14 h-14 mx-auto rounded-2xl bg-[#16e08a]/15 text-[#16e08a] flex items-center justify-center mb-4">
          <Icon name="mail" size={26} />
        </span>
        <p className="text-sm text-[var(--text)] leading-relaxed">
          We sent a confirmation link to
          <br />
          <b className="text-[#16e08a]">{email || 'your email'}</b>
        </p>
        <p className="text-xs text-[var(--muted)] mt-3 leading-relaxed">
          Open it on this device to activate your account. The link expires in 24 hours.
        </p>
      </div>

      <AuthError message={error} />
      <AuthSuccess message={message} />

      {isSupabaseConfigured && (
        <button
          onClick={() => void handleResend()}
          disabled={resending || !email}
          className="w-full py-3 rounded-xl bg-[#16e08a] text-black font-bold text-sm hover:bg-[#0dbb72] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {resending && <Spinner size={16} />} Resend verification email
        </button>
      )}

      <p className="text-center text-sm text-[var(--muted)] mt-7">
        Wrong address?{' '}
        <Link href="/signup" className="text-[#16e08a] font-bold hover:underline">
          Sign up again
        </Link>{' '}
        ·{' '}
        <Link href="/login" className="text-[#16e08a] font-bold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
