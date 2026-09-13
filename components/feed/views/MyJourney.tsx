'use client';

import { useState } from 'react';

export default function MyJourney() {
  const [hasJourney, setHasJourney] = useState(false);

  if (!hasJourney) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Journey</h1>
          <p className="text-gray-600">Track your personal growth and experiences</p>
        </div>

        {/* Empty State */}
        <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-100 p-12 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">🏔️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Start Your Journey</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            A journey is your personal space to document experiences, track your growth, and reflect on where you've been.
          </p>
          <button
            onClick={() => setHasJourney(true)}
            className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors"
          >
            Create My First Journey
          </button>
        </div>

        {/* Journey Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-6 bg-white rounded-xl border border-gray-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">📝</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Document</h3>
            <p className="text-sm text-gray-600">Write about your experiences and feelings</p>
          </div>
          <div className="p-6 bg-white rounded-xl border border-gray-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">📈</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Track Growth</h3>
            <p className="text-sm text-gray-600">See how far you've come over time</p>
          </div>
          <div className="p-6 bg-white rounded-xl border border-gray-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Private</h3>
            <p className="text-sm text-gray-600">Your journey is completely private to you</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Journey</h1>
          <p className="text-gray-600">Your personal growth timeline</p>
        </div>
        <button className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors">
          Add Entry
        </button>
      </div>

      {/* Journey Timeline */}
      <div className="space-y-4">
        <div className="relative pl-8 pb-8 border-l-2 border-purple-200">
          <div className="absolute left-0 top-0 w-4 h-4 -ml-[9px] bg-purple-600 rounded-full"></div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Today</span>
              <button className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Started my journey</h3>
            <p className="text-gray-600">Excited to document my growth and experiences on Ruhiz!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
