'use client';

export default function ExploreFeed() {
  const topics = [
    { name: 'Life', icon: '🌱', moments: 0, color: 'from-green-400 to-teal-400' },
    { name: 'Relationships', icon: '❤️', moments: 0, color: 'from-red-400 to-pink-400' },
    { name: 'School / College', icon: '🎓', moments: 0, color: 'from-blue-400 to-indigo-400' },
    { name: 'Career', icon: '💼', moments: 0, color: 'from-purple-400 to-violet-400' },
    { name: 'Mental Health', icon: '🧠', moments: 0, color: 'from-teal-400 to-cyan-400' },
    { name: 'Family', icon: '👨‍👩‍👧‍👦', moments: 0, color: 'from-orange-400 to-yellow-400' },
  ];

  const situations = [
    { name: 'Figuring things out', icon: '🤔', moments: 0 },
    { name: 'New beginnings', icon: '🌅', moments: 0 },
    { name: 'Feeling lost', icon: '🧭', moments: 0 },
    { name: 'Career decisions', icon: '💼', moments: 0 },
    { name: 'Relationships', icon: '💕', moments: 0 },
    { name: 'Self-discovery', icon: '✨', moments: 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Explore</h1>
        <p className="text-gray-600">Discover moments, topics, and situations</p>
      </div>

      {/* Topics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Topics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topics.map((topic) => (
            <button
              key={topic.name}
              className="p-6 bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all text-left group"
            >
              <div className={`w-16 h-16 bg-gradient-to-br ${topic.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <span className="text-3xl">{topic.icon}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{topic.name}</h3>
              <p className="text-sm text-gray-500">{topic.moments} moments</p>
            </button>
          ))}
        </div>
      </div>

      {/* Situations */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Popular Situations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {situations.map((situation) => (
            <button
              key={situation.name}
              className="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{situation.icon}</span>
                <h3 className="font-semibold text-gray-900">{situation.name}</h3>
              </div>
              <p className="text-sm text-gray-500">{situation.moments} moments</p>
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">🔍</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Nothing to explore yet</h3>
        <p className="text-gray-600 mb-4">Be the first to share a moment</p>
      </div>
    </div>
  );
}
