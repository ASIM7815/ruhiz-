'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const slides = [
    '/images/ruhizhero.png',
    '/images/slide2.png',
    '/images/slide3.png',
    '/images/slide4.png',
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(timer);
  }, [slides.length]);

  const scrollToFeatures = (e: React.MouseEvent) => {
    e.preventDefault();
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      {/* Slideshow Background */}
      {slides.map((slide, index) => (
        <div
          key={slide}
          className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
            index === currentSlide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={slide}
            alt={`Hero background ${index + 1}`}
            fill
            className="object-cover"
            priority={index === 0}
            quality={100}
          />
        </div>
      ))}
      
      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent z-10" />
      
      {/* Content */}
      <div className="relative z-20 w-full h-full min-h-screen flex items-center pt-16">
        <div className="max-w-7xl mx-auto px-6 py-20 w-full">
          <div className="max-w-2xl">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-playfair font-bold text-white leading-tight mb-6" style={{
              textShadow: '2px 2px 4px rgba(0,0,0,0.5), 0 0 20px rgba(0,0,0,0.3)'
            }}>
              A Safe Space<br />
              for Real Feelings
            </h1>
            
            <p className="text-base sm:text-lg text-white leading-relaxed mb-8 max-w-xl" style={{
              textShadow: '1px 1px 3px rgba(0,0,0,0.7)'
            }}>
              A supportive community where you can share your thoughts, photos, videos, and experiences — without judgment. Real people. Real conversations. A kinder tomorrow.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-ruhiz-teal text-white font-medium rounded-full hover:bg-opacity-90 transition-all shadow-xl hover:shadow-2xl"
              >
                <span>Join the Community</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <button
                onClick={scrollToFeatures}
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-gray-900 font-medium rounded-full border-2 border-white hover:bg-gray-50 transition-all shadow-xl cursor-pointer"
              >
                Learn How It Works
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentSlide 
                ? 'bg-white w-8' 
                : 'bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
