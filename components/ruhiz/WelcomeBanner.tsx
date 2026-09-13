'use client';

export default function WelcomeBanner() {
  return (
    <div 
      className="relative h-[240px] rounded-3xl overflow-hidden mb-6"
      style={{
        backgroundImage: 'url(/images/banner.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B3D2E]/80 via-[#0B3D2E]/60 to-transparent"></div>
      
      {/* Content */}
      <div className="relative h-full flex items-center px-12">
        <div className="flex-1">
          <p className="text-white/80 text-xs font-medium tracking-widest uppercase mb-3">
            GOOD TO SEE YOU HERE
          </p>
          <h1 className="text-white text-5xl font-serif mb-3" style={{ fontFamily: 'serif' }}>
            Welcome to Ruhiz!
          </h1>
          <p className="text-white/90 text-base mb-4">
            A safe space to share, ask, and grow together.
          </p>
          <div className="w-16 h-1 bg-[#8FC9A8] rounded-full"></div>
        </div>
        
        <div className="text-right text-white/70 italic text-sm" style={{ fontFamily: 'serif' }}>
          <p className="mb-1">Different people.</p>
          <p>Different stories.</p>
        </div>
      </div>
    </div>
  );
}
