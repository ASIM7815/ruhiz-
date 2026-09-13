'use client';

import { useState } from 'react';
import MomentComposer from '../MomentComposer';
import MomentPost from '../MomentPost';

interface HomeFeedProps {
  userMoments: any[];
  onUpdateMoments: (moments: any[]) => void;
  onCreateMoment: () => void;
}

export default function HomeFeed({ userMoments, onUpdateMoments, onCreateMoment }: HomeFeedProps) {
  // Demo moments
  const [demoMoments] = useState([
    {
      id: '1',
      author: {
        name: 'Alex',
        avatar: null,
        time: '2h ago',
      },
      content: 'Sometimes a peaceful evening is all you need. 🧡',
      type: 'video',
      videoUrl: '/demo-videos/sunset.mp4',
      topics: ['Life', 'Mental Health'],
      likes: 12,
      comments: [
        { id: 'c1', author: 'Sarah', text: 'Beautiful! Where is this?' },
      ],
      shares: 0,
      saves: 0,
      beenHere: 27,
      isLiked: false,
      isSaved: false,
      hasBeenHere: false,
    },
    {
      id: '2',
      author: {
        name: 'Sarah Khan',
        avatar: null,
        time: '5h ago',
      },
      content: 'Feeling really overwhelmed with studies and life in general. Just needed to get this off my chest.',
      type: 'text',
      topics: ['School / College', 'Mental Health'],
      likes: 45,
      comments: [
        { id: 'c2', author: 'Mike', text: 'You got this! Take it one day at a time.' },
        { id: 'c3', author: 'Emma', text: 'Sending positive vibes your way ❤️' },
      ],
      shares: 2,
      saves: 8,
      beenHere: 89,
      isLiked: false,
      isSaved: false,
      hasBeenHere: false,
    },
  ]);

  const allMoments = [...userMoments, ...demoMoments];

  const handleUpdateMoment = (momentId: string, updates: any) => {
    const updatedUserMoments = userMoments.map(m => 
      m.id === momentId ? { ...m, ...updates } : m
    );
    onUpdateMoments(updatedUserMoments);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100 flex items-start gap-3">
        <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xl">🦋</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">Welcome to Ruhiz!</h3>
          <p className="text-sm text-gray-600 mb-3">
            Be the first to share your story, ask a question or explore what others are going through.
          </p>
          <button 
            onClick={onCreateMoment}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create Moment
          </button>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Moment Composer */}
      <MomentComposer onCreateMoment={onCreateMoment} />

      {/* Moments Feed */}
      <div className="space-y-6">
        {allMoments.map((moment) => (
          <MomentPost
            key={moment.id}
            moment={moment}
            onUpdate={(updates) => handleUpdateMoment(moment.id, updates)}
          />
        ))}
      </div>

      {/* Load More */}
      {allMoments.length > 0 && (
        <div className="text-center py-6">
          <button className="px-6 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">
            Load more moments
          </button>
        </div>
      )}
    </div>
  );
}
