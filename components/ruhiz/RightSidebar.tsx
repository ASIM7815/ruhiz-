'use client';

import { useState } from 'react';

interface RightSidebarProps {
  isOpen: boolean;
}

export default function RightSidebar({ isOpen }: RightSidebarProps) {
  const [following, setFollowing] = useState<{ [key: string]: boolean }>({
    sam: false,
    ayesha: false,
    rohan: false,
  });

  const handleFollow = (person: string) => {
    setFollowing({ ...following, [person]: !following[person] });
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed right-0 top-[70px] bottom-0 w-[340px] bg-white border-l border-[#E3EAE6] overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Today's Thought Card */}
        <div className="bg-gradient-to-br from-[#DCEDE4] to-[#F7F9F7] rounded-2xl p-5 border border-[#E3EAE6]">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-[#145C43]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <h3 className="font-semibold text-[#18332A]">Today's Thought</h3>
          </div>
          <p className="text-sm text-[#18332A] leading-relaxed italic mb-3">
            "It's okay to be a work in progress. You're still showing up, and that's what matters."
          </p>
          <div className="w-12 h-1 bg-[#145C43] rounded-full"></div>
        </div>

        {/* Trending Topics */}
        <div className="bg-white rounded-2xl border border-[#E3EAE6] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#145C43]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
              </svg>
              <h3 className="font-semibold text-[#18332A]">Trending Topics</h3>
            </div>
            <button className="text-sm text-[#145C43] hover:underline">See all</button>
          </div>
          
          <div className="space-y-3">
            {[
              { rank: 1, name: 'Mental Health', count: '1.2K moments' },
              { rank: 2, name: 'Overthinking', count: '892 moments' },
              { rank: 3, name: 'Self Improvement', count: '876 moments' },
              { rank: 4, name: 'Relationships', count: '740 moments' },
              { rank: 5, name: 'College Life', count: '612 moments' },
            ].map((topic) => (
              <button
                key={topic.rank}
                className="w-full flex items-center gap-3 hover:bg-[#F7F9F7] p-2 rounded-lg transition-colors"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-[#DCEDE4] text-[#145C43] rounded-full text-xs font-semibold flex-shrink-0">
                  {topic.rank}
                </span>
                <div className="flex-1 text-left">
                  <p className="font-medium text-[#18332A] text-sm">{topic.name}</p>
                  <p className="text-xs text-[#718078]">{topic.count}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* People You May Connect With */}
        <div className="bg-white rounded-2xl border border-[#E3EAE6] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#145C43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="font-semibold text-[#18332A]">People You May Connect With</h3>
            </div>
            <button className="text-sm text-[#145C43] hover:underline">See all</button>
          </div>
          
          <div className="space-y-4">
            {[
              { id: 'sam', name: 'Sam', subtitle: 'Similar interests' },
              { id: 'ayesha', name: 'Ayesha', subtitle: 'Mental Health - Life' },
              { id: 'rohan', name: 'Rohan', subtitle: 'Student - Tech' },
            ].map((person) => (
              <div key={person.id} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#8FC9A8] rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <p className="font-semibold text-[#18332A] text-sm">{person.name}</p>
                  <p className="text-xs text-[#718078]">{person.subtitle}</p>
                </div>
                <button
                  onClick={() => handleFollow(person.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    following[person.id]
                      ? 'bg-[#DCEDE4] text-[#145C43]'
                      : 'bg-[#145C43] text-white hover:bg-[#0B3D2E]'
                  }`}
                >
                  {following[person.id] ? 'Following' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Share Your Story Card */}
        <div className="relative bg-gradient-to-br from-[#DCEDE4] to-white rounded-2xl p-5 border border-[#E3EAE6] overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-semibold text-[#18332A] mb-2">Share Your Story</h3>
            <p className="text-sm text-[#18332A] mb-4">
              A safer, kinder space for your thoughts.
            </p>
            <button className="p-2 bg-[#145C43] text-white rounded-full hover:bg-[#0B3D2E] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
          <svg className="absolute bottom-0 right-0 w-24 h-24 text-[#145C43] opacity-10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          </svg>
        </div>
      </div>
    </aside>
  );
}
