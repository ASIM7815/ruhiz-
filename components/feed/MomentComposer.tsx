'use client';

interface MomentComposerProps {
  onCreateMoment: () => void;
}

export default function MomentComposer({ onCreateMoment }: MomentComposerProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* User Avatar and Input */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex-shrink-0"></div>
        <button
          onClick={onCreateMoment}
          className="flex-1 text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
        >
          What's happening with you?
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCreateMoment}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 hover:bg-purple-50 rounded-lg transition-colors group"
        >
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm text-gray-600 group-hover:text-purple-600">Photo</span>
        </button>

        <button
          onClick={onCreateMoment}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 hover:bg-purple-50 rounded-lg transition-colors group"
        >
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-sm text-gray-600 group-hover:text-purple-600">Video</span>
        </button>

        <button
          onClick={onCreateMoment}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 hover:bg-purple-50 rounded-lg transition-colors group"
        >
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-sm text-gray-600 group-hover:text-purple-600">Moment</span>
        </button>

        <button
          onClick={onCreateMoment}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 hover:bg-purple-50 rounded-lg transition-colors group"
        >
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-gray-600 group-hover:text-purple-600">Question</span>
        </button>
      </div>
    </div>
  );
}
