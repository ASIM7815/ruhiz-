'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SetupProfilePage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setUserId(user.id);
        // Try to get username from user metadata if it exists
        if (user.user_metadata?.username) {
          setUsername(user.user_metadata.username);
        }
      }
    };
    getUser();
  }, [router, supabase.auth]);

  const validateUsername = (username: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  };

  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .ilike('username', username)
        .single();

      if (error && error.code === 'PGRST116') {
        return true; // Username is available
      }

      return !data;
    } catch (err) {
      console.error('Username check error:', err);
      return true;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!username) {
      setError('Please enter a username');
      setLoading(false);
      return;
    }

    if (!validateUsername(username)) {
      setError('Secret name must be 3-20 characters and contain only letters, numbers, and underscores');
      setLoading(false);
      return;
    }

    if (!userId) {
      setError('User session not found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        setError('That username is already taken');
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          username: username.trim(),
          display_name: username.trim(),
          created_at: new Date().toISOString(),
        });

      if (profileError) {
        setError('Failed to create profile. Please try again.');
      } else {
        router.push('/feed');
        router.refresh();
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
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

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            Complete Your Profile
          </h1>
          
          <p className="text-gray-600 text-center mb-2">
            Choose your unique Ruhiz secret name.
          </p>
          
          <p className="text-sm text-gray-500 text-center mb-8">
            Don't use your real name if you want privacy.
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
                  <span>Creating profile...</span>
                </>
              ) : (
                'Complete Setup'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
