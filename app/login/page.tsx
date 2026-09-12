'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle login logic here
    console.log('Login submitted', { username, password });
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
              {/* Username Field */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
                  placeholder="Password"
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
                className="w-full py-4 bg-ruhiz-teal text-white font-semibold rounded-full hover:bg-opacity-90 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <span>Log In</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
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
