'use client';

interface RightSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function RightSidebar({ isOpen, onToggle }: RightSidebarProps) {
  if (!isOpen) return null;

  const topics = [
    { name: 'Life', icon: '🌱', count: 0 },
    { name: 'Relationships', icon: '❤️', count: 0 },
    { name: 'School / College', icon: '🎓', count: 0 },
    { name: 'Career', icon: '💼', count: 0 },
    { name: 'Mental Health', icon: '🧠', count: 0 },
  ];

  const situations = [
    { name: 'Figuring things out', count: 0, icon: '🤔' },
    { name: 'New beginnings', count: 0, icon: '🌅' },
    { name: 'Relationships', count: 0, icon: '💕' },
    { name: 'Career decisions', count: 0, icon: '💼' },
  ];

  return (
    <aside className="fixed right-0 top-16 bottom-0 w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      {/* Close Button */}
      <button
        onClick={onToggle}
        className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Close sidebar"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="space-y-6 mt-8">
        {/* Your Journey */}
        <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-xl border border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Your Journey</h3>
            <button className="text-sm text-purple-600 hover:underline">View all</button>
          </div>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">🏔️</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">You haven't started your journey yet.</p>
            <button className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors">
              Start a Journey
            </button>
          </div>
        </div>

        {/* Explore Topics */}
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Explore topics</h3>
            <button className="text-sm text-purple-600 hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {topics.map((topic) => (
              <button
                key={topic.name}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{topic.icon}</span>
                  <span className="text-sm text-gray-700">{topic.name}</span>
                </div>
                <span className="text-xs text-gray-400">{topic.count} moments</span>
              </button>
            ))}
          </div>
        </div>

        {/* Popular Situations */}
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Popular situations</h3>
          <div className="space-y-2">
            {situations.map((situation) => (
              <button
                key={situation.name}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{situation.icon}</span>
                  <span className="text-sm text-gray-700">{situation.name}</span>
                </div>
                <span className="text-xs text-gray-400">{situation.count} moments</span>
              </button>
            ))}
          </div>
        </div>

        {/* Community Card */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl">👋</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">You're one of the first!</h3>
              <p className="text-xs text-gray-600">Help shape Ruhiz, more open and human internet.</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
