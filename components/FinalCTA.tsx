import Link from 'next/link';

export default function FinalCTA() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-teal-700 via-teal-600 to-teal-800 opacity-90" />
      
      {/* Overlay pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.4"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
      }} />
      
      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <h2 className="text-5xl lg:text-6xl font-playfair font-bold text-white mb-6">
          Your Story Matters
        </h2>
        <p className="text-xl text-white/90 mb-10">
          Take the first step towards a brighter, healthier you.
        </p>
        
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-10 py-5 bg-white text-ruhiz-teal font-semibold rounded-full hover:shadow-2xl transition-all text-lg"
        >
          Join Ruhiz Today
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        
        {/* Handwritten note */}
        <div className="mt-16 text-right max-w-md ml-auto">
          <p className="text-3xl font-serif italic text-white/90" style={{ fontFamily: 'Caveat, cursive' }}>
            A kinder
          </p>
          <p className="text-3xl font-serif italic text-white/90" style={{ fontFamily: 'Caveat, cursive' }}>
            tomorrow
          </p>
          <p className="text-3xl font-serif italic text-white/90" style={{ fontFamily: 'Caveat, cursive' }}>
            is possible ♡
          </p>
        </div>
      </div>
    </section>
  );
}
