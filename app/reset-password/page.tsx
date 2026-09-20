'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthLayout, { AuthError, AuthInput, AuthSuccess } from '@/components/auth/AuthLayout';
import { Spinner } from '@/components/ui/Primitives';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { error: err } = await createClient().auth.updateUser({ password });
      if (err) throw new Error(err.message);
      setSuccess('Password updated. Redirecting to sign in…');
      window.setTimeout(() => router.replace('/login?verified=true'), 1200);
    } catch (err: any) {
      setError(err?.message ?? 'Could not update the password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="This link came from your recovery email.">
      <AuthError message={error} />
      <AuthSuccess message={success} />
      <form onSubmit={submit} noValidate>
        <AuthInput label="New password" type="password" value={password} onChange={setPassword} placeholder="8+ characters" autoComplete="new-password" />
        <AuthInput label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat it" autoComplete="new-password" />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#16e08a] text-black font-bold text-sm hover:bg-[#0dbb72] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Spinner size={16} />} Update password
        </button>
      </form>
    </AuthLayout>
  );
}
