'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const supabase = createClient();

  const handleResend = async () => {
    setResending(true);
    setResendMessage('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verified`,
        },
      });

      if (error) {
        setResendMessage('Failed to resend email. Please try again.');
      } else {
        setResendMessage('Verification email sent! Check your inbox.');
      }
    } catch (err) {
      setResendMessage('Something went wrong. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9F7] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-8">
            <Image
              src="/images/ruhizlogo-.png"
              alt="Ruhiz"
              width={150}
              height={150}
              className="w-auto h-20"
            />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Check your email
          </h1>
          
          <p className="text-gray-600 mb-2">
            We've sent a verification link to:
          </p>
          
          <p className="text-ruhiz-teal font-semibold mb-6">
            {email}
          </p>

          <p className="text-sm text-gray-500 mb-8">
            Click the link in the email to verify your account and complete your signup.
          </p>

          {resendMessage && (
            <div className={`mb-6 px-4 py-3 rounded-2xl text-sm ${
              resendMessage.includes('sent') 
                ? 'bg-green-50 border border-green-200 text-green-700' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {resendMessage}
            </div>
          )}

          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full py-3 bg-white border-2 border-ruhiz-teal text-ruhiz-teal font-semibold rounded-full hover:bg-ruhiz-teal hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {resending ? 'Resending...' : 'Resend verification email'}
          </button>

          <a
            href={`https://mail.google.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full py-3 bg-ruhiz-teal text-white font-semibold rounded-full hover:bg-opacity-90 transition-colors"
          >
            Open email
          </a>
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 002 12a10 10 0 0010 10 10 10 0 0010-10A10 10 0 0012 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                Didn't receive the email?
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Check your spam folder or click "Resend verification email" above.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
