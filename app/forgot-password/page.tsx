'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        if (resetError.message.includes('rate limit') || resetError.status === 429) {
          setError('Too many password reset attempts. Please try again later (wait 1 hour).');
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
              We sent a password recovery link to:
            </p>
            
            <p className="text-ruhiz-teal font-semibold mb-6">
              {email}
            </p>

            <p className="text-sm text-gray-500 mb-8">
              Click the link in the email to reset your Ruhiz password.
            </p>

            <Link
              href="/login"
              className="inline-block w-full py-3 bg-ruhiz-teal text-white font-semibold rounded-full hover:bg-opacity-90 transition-colors"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            Reset your Ruhiz password
          </h1>
          
          <p className="text-gray-600 text-center mb-8">
            Enter your email and we'll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                {error}
              </div>
            )}

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ruhiz-teal focus:border-transparent text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-ruhiz-teal text-white font-semibold rounded-full hover:bg-opacity-90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Sending reset link...</span>
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-ruhiz-teal hover:underline"
            >
              Back to login
            </Link>
          </div>
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
                Need help?
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                If you don't receive the email within a few minutes, check your spam folder or try again.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
