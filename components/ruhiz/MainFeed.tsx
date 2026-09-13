'use client';

import { useState } from 'react';
import WelcomeBanner from './WelcomeBanner';
import PostComposer from './PostComposer';
import CategoryFilters from './CategoryFilters';
import PostCard from './PostCard';
import ProfileView from './ProfileView';

interface MainFeedProps {
  isRightSidebarOpen: boolean;
  onToggleSidebar: () => void;
  user: any;
  activeNav?: string;
}

export default function MainFeed({ isRightSidebarOpen, onToggleSidebar, user, activeNav = 'home' }: MainFeedProps) {
  const [activeFilter, setActiveFilter] = useState('for-you');

  // Show Profile view when profile is selected
  if (activeNav === 'profile') {
    return <ProfileView user={user} isRightSidebarOpen={isRightSidebarOpen} onToggleSidebar={onToggleSidebar} />;
  }

  // Default Home feed
  return (
    <div className="max-w-[680px] mx-auto">
      {/* Sidebar Toggle Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 bg-white border border-[#E3EAE6] rounded-full hover:bg-[#F7F9F7] transition-colors"
          aria-label={isRightSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <svg 
            className={`w-5 h-5 text-[#18332A] transition-transform ${isRightSidebarOpen ? 'rotate-0' : 'rotate-180'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <WelcomeBanner />
      <PostComposer />
      <CategoryFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      
      <div className="space-y-6">
        <PostCard />
      </div>
    </div>
  );
}
