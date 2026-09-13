'use client';

export default function Saved() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Saved</h1>
        <p className="text-gray-600">Moments you've saved for later</p>
      </div>

      {/* Empty State */}
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">🔖</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved moments yet</h3>
        <p className="text-gray-600 mb-6">
          Save moments to easily find them later
        </p>
        <p className="text-sm text-gray-500">
          Tap the bookmark icon on any moment to save it here
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-100 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">💡</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">About Saved Moments</h3>
            <p className="text-sm text-gray-600">
              Save moments that resonate with you, inspire you, or that you want to revisit later. 
              Your saved moments are completely private—only you can see what you've saved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
