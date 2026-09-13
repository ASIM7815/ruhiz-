'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function TopNavigation() {
  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40">
      <div className="h-16 px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/images/ruhizlogo-.png"
            alt="Ruhiz"
            width={120}
            height={40}
            className="h-10 w-auto"
          />
        </Link>

        {/* Search */}
        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search Ruhiz..."
              className="w-full px-4 py-2 pl-10 bg-gray-50 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 bg-purple-600 rounded-full"></span>
          </button>

          <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 bg-purple-600 rounded-full"></span>
          </button>

          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all"></div>
        </div>
      </div>
    </header>
  );
}
