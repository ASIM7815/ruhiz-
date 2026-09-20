'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Logo from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Primitives';

export default function EmailVerifiedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setStatus('error');
          return;
        }
        setStatus('success');
        window.setTimeout(() => router.replace('/feed'), 1400);
      } catch {
        setStatus('error');
      }
    })();
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-5">
      <div className="w-full max-w-md text-center bg-[#101317] border border-white/10 rounded-3xl p-9">
        <Logo height={32} className="mx-auto mb-7" />
        {status === 'verifying' && (
          <>
            <Spinner size={30} className="text-[#16e08a] mx-auto mb-4" />
            <h1 className="display text-xl">Confirming your email…</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <span className="w-14 h-14 mx-auto rounded-2xl bg-[#16e08a]/15 text-[#16e08a] flex items-center justify-center mb-4">
              <Icon name="check" size={26} strokeWidth={3} />
            </span>
            <h1 className="display text-xl">Email verified</h1>
            <p className="text-sm text-white/55 mt-2">Your account is live. Taking you to your feed…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <span className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mb-4">
              <Icon name="warning" size={26} />
            </span>
            <h1 className="display text-xl">Verification incomplete</h1>
            <p className="text-sm text-white/55 mt-2 mb-6">We could not confirm a session. Sign in to continue.</p>
            <Link href="/login" className="inline-block px-6 py-3 rounded-xl bg-[#16e08a] text-black font-bold text-sm hover:bg-[#0dbb72] transition-colors">
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
