'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface TopNavProps {
  user: any;
  onLogout: () => void;
}

export default function TopNav({ user, onLogout }: TopNavProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 bg-[#145C43] h-[70px] z-50 border-b border-[#0B3D2E]">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/images/ruhizlogo-.png"
            alt="Ruhiz"
            width={100}
            height={32}
            className="h-8 w-auto brightness-0 invert"
          />
        </Link>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-12">
          <div className="relative">
            <svg 
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#718078]"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search people, topics or moments..."
              className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <button className="relative p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          <button className="relative p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 bg-[#8FC9A8] rounded-full cursor-pointer hover:ring-2 hover:ring-white/30 transition-all flex items-center justify-center text-white font-semibold"
            >
              {user?.user_metadata?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-[#E3EAE6] py-2 w-64 z-50">
                <div className="px-4 py-3 border-b border-[#E3EAE6]">
                  <p className="font-semibold text-[#18332A]">{user?.user_metadata?.username || 'User'}</p>
                  <p className="text-sm text-[#718078]">{user?.email}</p>
                </div>
                <button className="w-full px-4 py-2 text-left text-sm text-[#18332A] hover:bg-[#F7F9F7] flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-[#18332A] hover:bg-[#F7F9F7] flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
                <div className="border-t border-[#E3EAE6] mt-2"></div>
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
