'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function EmailVerifiedPage() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const verifyAndRedirect = async () => {
      try {
        // Get the current session after email verification
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          setStatus('error');
          setErrorMessage('Unable to verify your email. Please try again.');
          return;
        }

        // User is authenticated, email is verified
        const user = session.user;
        
        // Show success briefly
        setStatus('success');

        // Wait 1.5 seconds to show success message
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Check if user has a Ruhiz profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('username, display_name')
          .eq('user_id', user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          // Profile doesn't exist - redirect to profile setup
          router.push('/setup-profile');
          return;
        }

        if (profileError) {
          // Error checking profile, but profile might not exist - go to setup
          console.error('Profile check error:', profileError);
          router.push('/setup-profile');
          return;
        }

        if (!profile || !profile.username) {
          // Profile exists but incomplete - redirect to profile setup
          router.push('/setup-profile');
          return;
        }

        // Profile exists and is complete - redirect to feed
        router.push('/feed');
        router.refresh();

      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setErrorMessage('Something went wrong. Please try logging in.');
      }
    };

    verifyAndRedirect();
  }, [router, supabase]);

  if (status === 'verifying') {
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
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="animate-spin w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Verifying your email...
            </h1>
            
            <p className="text-gray-600">
              Please wait while we confirm your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Email verified successfully!
            </h1>
            
            <p className="text-gray-600 mb-4">
              Your email has been confirmed.
            </p>

            <p className="text-sm text-gray-500">
              Redirecting you...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
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
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Verification failed
          </h1>
          
          <p className="text-gray-600 mb-6">
            {errorMessage}
          </p>

          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full py-3 bg-ruhiz-teal text-white font-semibold rounded-full hover:bg-opacity-90 transition-colors"
            >
              Go to Login
            </Link>
            
            <Link
              href="/signup"
              className="block w-full py-3 bg-white border-2 border-ruhiz-teal text-ruhiz-teal font-semibold rounded-full hover:bg-ruhiz-teal hover:text-white transition-colors"
            >
              Sign Up Again
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
