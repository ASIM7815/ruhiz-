'use client';

export default function Connections() {
  const suggestions = [
    { name: 'Alex Johnson', mutualConnections: 0, status: 'suggested' },
    { name: 'Sarah Khan', mutualConnections: 0, status: 'suggested' },
    { name: 'Mike Chen', mutualConnections: 0, status: 'suggested' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Connections</h1>
        <p className="text-gray-600">Connect with people on similar journeys</p>
      </div>

      {/* Empty State */}
      <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-100 p-12 text-center">
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">👥</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No connections yet</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Connect with people who understand what you're going through
        </p>
      </div>

      {/* Suggested Connections */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Suggested for you</h2>
        <div className="space-y-4">
          {suggestions.map((person) => (
            <div
              key={person.name}
              className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                  {person.name[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{person.name}</h3>
                  <p className="text-sm text-gray-500">
                    {person.mutualConnections === 0
                      ? 'New to Ruhiz'
                      : `${person.mutualConnections} mutual connections`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors">
                  Connect
                </button>
                <button className="px-4 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors">
                  Ignore
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
