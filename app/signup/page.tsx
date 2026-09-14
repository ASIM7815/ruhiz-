'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ensureProfile, isMissingSchema } from '@/lib/backend/api';

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  // Validate username format
  const validateUsername = (username: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  };

  // Check if username is available
  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    const { data: available, error: rpcError } = await supabase
      .rpc('is_username_available', { p_username: username });

    if (!rpcError && typeof available === 'boolean') {
      return available;
    }

    if (rpcError && !isMissingSchema(rpcError)) throw rpcError;

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .ilike('username', username)
      .maybeSingle();

    if (error) throw error;
    return !data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate all fields
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    // Validate username format
    if (!validateUsername(username)) {
      setError('Secret name must be 3-20 characters and contain only letters, numbers, and underscores');
      setLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError('Your password must be at least 8 characters');
      setLoading(false);
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      console.log('[Signup] Starting signup process...')
      
      const trimmedUsername = username.trim();

      const usernameAvailable = await checkUsernameAvailability(trimmedUsername);
      if (!usernameAvailable) {
        setError('That secret name is already taken. Please choose another.');
        return;
      }

      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: trimmedUsername,
            display_name: trimmedUsername,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/verified`,
        },
      });

      if (signUpError) {
        console.error('[Signup] Sign up error (full):', signUpError)
        console.error('[Signup] Sign up error details:', {
          message: signUpError.message,
          status: signUpError.status,
          name: signUpError.name,
          cause: signUpError.cause,
        })
        
        // User-friendly error messages
        if (signUpError.message?.includes('already registered')) {
          setError('An account with this email already exists. Try logging in.');
        } else if (signUpError.message?.includes('Password')) {
          setError('Your password must be at least 8 characters');
        } else if (signUpError.message?.includes('rate limit') || signUpError.status === 429) {
          setError('Too many attempts from this email. Please try again later (wait 1 hour).');
        } else if (signUpError.message?.includes('sending confirmation email') || signUpError.message?.includes('email')) {
          setError('Email service not configured. Please ask admin to set up Resend SMTP in Supabase, or disable email confirmation for testing.');
        } else if (signUpError.message) {
          setError(`Error: ${signUpError.message}`);
        } else {
          setError('Something went wrong. Please check your Supabase configuration and try again.');
        }
        return;
      }

      if (data.user) {
        console.log('[Signup] User created:', {
          userId: data.user.id,
          email: data.user.email,
          emailConfirmed: data.user.email_confirmed_at,
          needsConfirmation: !data.user.email_confirmed_at
        });
        
        // Check if email confirmation is required
        if (data.user.identities && data.user.identities.length === 0) {
          setError('An account with this email already exists. Try logging in.');
          return;
        }

        // Skip profile creation - will be created when user first logs in
        // Check if email confirmation is needed
        if (!data.user.email_confirmed_at) {
          console.log('[Signup] Redirecting to confirm-email page')
          // Redirect to email confirmation page
          router.push(`/confirm-email?email=${encodeURIComponent(email)}`);
        } else {
          console.log('[Signup] Email already confirmed, redirecting to feed')
          try {
            await ensureProfile(supabase, data.user);
          } catch (profileErr: any) {
            console.error('[Signup] Profile creation failed:', profileErr);
            setError(profileErr?.message ? `Profile error: ${profileErr.message}` : 'Your account was created, but your Ruhiz profile could not be created.');
            return;
          }
          router.replace('/feed');
        }
      }
    } catch (err: any) {
      console.error('[Signup] Exception:', err);
      console.error('[Signup] Error details:', {
        message: err.message,
        status: err.status,
        statusText: err.statusText,
      });
      
      if (err.message?.includes('relation "profiles" does not exist')) {
        setError('Database not set up. Please contact support.');
      } else if (err.message) {
        setError(`Error: ${err.message}`);
      } else {
        setError('Something went wrong. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image */}
      <div className="hidden lg:flex lg:w-[40%] relative">
        <Image
          src="/images/signup-sideimage.png"
          alt="Signup background"
          fill
          className="object-cover"
          priority
          sizes="40vw"
        />
        <div className="absolute bottom-8 left-12">
          <p className="text-sm text-gray-600 tracking-widest uppercase">
            REAL PEOPLE.
          </p>
          <p className="text-sm text-gray-600 tracking-widest uppercase">
            BRIGHTER TOMORROWS.
          </p>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="w-full lg:w-[60%] flex flex-col bg-white">
        <div className="flex justify-end items-center gap-3 px-8 py-6">
          <span className="text-gray-600 text-sm">Already have an account?</span>
          <Link
            href="/login"
            className="px-6 py-2 bg-ruhiz-teal text-white font-medium rounded-full hover:bg-opacity-90 transition-colors text-sm shadow-md"
          >
            Log In
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-md">
            <Link href="/" className="flex justify-center mb-8">
              <Image
                src="/images/ruhizlogo-.png"
                alt="Ruhiz"
                width={200}
                height={200}
                className="w-auto h-24 cursor-pointer hover:opacity-90 transition-opacity"
              />
            </Link>

            <div className="text-center mb-8">
              <p className="text-sm text-gray-500 tracking-wide">
                Real People. Brighter Tomorrows.
              </p>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-4xl font-playfair font-bold text-gray-900 mb-3">
                Create Your Account
              </h1>
              <p className="text-gray-600">
                Join a safe space where you can be yourself.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                  {error}
                </div>
              )}

              {/* Secret Name Field */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Secret Name (e.g., QuietMoon)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ruhiz-teal focus:border-transparent text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                * Don't use your real name if you want privacy. Choose a unique identity.
              </p>

              {/* Email Field */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  placeholder="Email (e.g., user@gmail.com)"
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
                  placeholder="Password (Ruhiz password, not Gmail)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
                * This is your Ruhiz password, not your email password. Choose something secure.
              </p>

              {/* Confirm Password Field */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-12 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ruhiz-teal focus:border-transparent text-gray-900 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
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

              {/* Create Account Button */}
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
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
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
