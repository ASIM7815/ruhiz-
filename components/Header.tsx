import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
        {/* Logo - Big logo with compact navbar */}
        <Link href="/" className="flex items-center">
          <Image
            src="/images/ruhizlogo-.png"
            alt="Ruhiz"
            width={200}
            height={200}
            className="h-14 lg:h-16 w-auto object-contain"
          />
        </Link>

        {/* Navigation - Compact */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-gray-900 border-b-2 border-gray-900 pb-0.5">
            Home
          </Link>
          <Link href="/about" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            About
          </Link>
          <Link href="/how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            How It Works
          </Link>
          <Link href="/resources" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Resources
          </Link>
          <Link href="/community" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Community
          </Link>
        </nav>

        {/* Actions - Compact */}
        <div className="flex items-center gap-3">
          <button className="text-gray-600 hover:text-gray-900 p-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <Link
            href="/login"
            className="px-5 py-1.5 text-sm font-medium text-gray-900 border border-gray-300 rounded-full hover:border-gray-400 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="px-5 py-1.5 text-sm font-medium bg-ruhiz-teal text-white rounded-full hover:bg-opacity-90 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </header>
  );
}
