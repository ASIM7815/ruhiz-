'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/backend/api';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Check if coming from email verification
  useEffect(() => {
    if (searchParams?.get('verified') === 'true') {
      setSuccessMessage('✅ Email confirmed! You can now log in with your credentials.');
      // Clear the message after 6 seconds
      setTimeout(() => setSuccessMessage(''), 6000);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate inputs
    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      console.log('[Login] Attempting sign in...')
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        console.error('[Login] Sign in error:', {
          message: signInError.message,
          status: signInError.status,
        })
        
        // User-friendly error messages
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Email or password is incorrect.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please verify your email before continuing.');
        } else if (signInError.message.includes('rate limit') || signInError.status === 429) {
          setError('Too many login attempts. Please try again later (wait 1 hour).');
        } else {
          setError('Something went wrong. Please try again.');
        }
        return;
      }

      if (data.user) {
        console.log('[Login] Sign in successful:', {
          userId: data.user.id,
          email: data.user.email,
        })

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const sessionUser = sessionData.session?.user;
        if (sessionError || !sessionUser) {
          console.error('[Login] Session check failed:', sessionError);
          setError('Signed in, but Ruhiz could not read your session. Please try again.');
          return;
        }

        try {
          const profile = await ensureProfile(supabase, sessionUser);
          console.log('[Login] Profile ready:', profile.username);
        } catch (profileErr: any) {
          console.error('[Login] Profile check failed:', profileErr);
          setError(profileErr?.message ? `Profile error: ${profileErr.message}` : 'Signed in, but your Ruhiz profile could not be loaded.');
          return;
        }

        console.log('[Login] Redirecting to /feed')
        router.replace('/feed');
        router.refresh();
      }
    } catch (err: any) {
      console.error('[Login] Exception:', err)
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image (Narrower width) */}
      <div className="hidden lg:flex lg:w-[40%] relative">
        <Image
          src="/images/loginboy.png"
          alt="Login background"
          fill
          className="object-cover"
          priority
          quality={100}
          sizes="40vw"
        />
        {/* Handwritten text overlay */}
        <div className="absolute top-1/4 left-12 text-left">
        
          
         
        </div>
        {/* Bottom tagline */}
        <div className="absolute bottom-8 left-12">
          <p className="text-sm text-gray-600 tracking-widest uppercase">
            REAL PEOPLE.
          </p>
          <p className="text-sm text-gray-600 tracking-widest uppercase">
            BRIGHTER TOMORROWS.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form (Wider to compensate) */}
      <div className="w-full lg:w-[60%] flex flex-col bg-white">
        {/* Top right - Sign Up link (Green button) */}
        <div className="flex justify-end items-center gap-3 px-8 py-6">
          <span className="text-gray-600 text-sm">New to Ruhiz?</span>
          <Link
            href="/signup"
            className="px-6 py-2 bg-ruhiz-teal text-white font-medium rounded-full hover:bg-opacity-90 transition-colors text-sm shadow-md"
          >
            Sign Up
          </Link>
        </div>

        {/* Login Form Container */}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-md">
            {/* Logo */}
            <Link href="/" className="flex justify-center mb-8">
              <Image
                src="/images/ruhizlogo-.png"
                alt="Ruhiz"
                width={200}
                height={200}
                className="w-auto h-24 cursor-pointer hover:opacity-90 transition-opacity"
              />
            </Link>

            {/* Tagline */}
            <div className="text-center mb-8">
              <p className="text-sm text-gray-500 tracking-wide">
                Real People. Brighter Tomorrows.
              </p>
            </div>

            {/* Welcome Back */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-playfair font-bold text-gray-900 mb-3">
                Welcome Back
              </h1>
              <p className="text-gray-600">
                Continue your journey. We're glad you're here.
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Success Message */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-2xl text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{successMessage}</span>
                </div>
              )}
              
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                  {error}
                </div>
              )}

              {/* Email Field */}
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

              {/* Password Field */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (Ruhiz password, not email password)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ruhiz-teal focus:border-transparent text-gray-900 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                * Use the password you created for Ruhiz, not your email password.
              </p>

              {/* Forgot Password */}
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-ruhiz-teal hover:text-ruhiz-teal/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Log In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-ruhiz-teal text-white font-semibold rounded-full hover:bg-opacity-90 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Logging in...</span>
                  </>
                ) : (
                  <>
                    <span>Log In</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>


            {/* Privacy Card */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 mt-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Your privacy matters.
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Share, connect, and feel supported — without revealing your real identity.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Tagline */}
            <div className="text-center mt-8">
              <p className="text-sm text-gray-500 italic" style={{ fontFamily: 'Caveat, cursive' }}>
                A kinder tomorrow is possible ♡
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
