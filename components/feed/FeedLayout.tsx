'use client';

import { useState } from 'react';
import TopNavigation from './TopNavigation';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import MainFeed from './MainFeed';
import CreateMomentModal from './CreateMomentModal';

export type NavigationItem = 'home' | 'explore' | 'journey' | 'connections' | 'messages' | 'notifications' | 'saved' | 'profile' | 'settings';

export default function FeedLayout() {
  const [activeNav, setActiveNav] = useState<NavigationItem>('home');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [userMoments, setUserMoments] = useState<any[]>([]);

  const handleCreateMoment = (moment: any) => {
    setUserMoments([moment, ...userMoments]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation />
      
      <LeftSidebar
        activeNav={activeNav}
        onNavigate={setActiveNav}
        onCreateMoment={() => setIsCreateModalOpen(true)}
      />

      <main
        className={`pt-16 transition-all duration-300 ${
          isRightSidebarOpen ? 'ml-64 mr-80' : 'ml-64'
        }`}
      >
        <MainFeed
          activeNav={activeNav}
          userMoments={userMoments}
          onUpdateMoments={setUserMoments}
          onCreateMoment={() => setIsCreateModalOpen(true)}
        />
      </main>

      <RightSidebar
        isOpen={isRightSidebarOpen}
        onToggle={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
      />

      {/* Reopen Right Sidebar Button */}
      {!isRightSidebarOpen && (
        <button
          onClick={() => setIsRightSidebarOpen(true)}
          className="fixed right-4 top-20 p-3 bg-white shadow-lg rounded-full hover:bg-gray-50 transition-colors z-30 border border-gray-200"
          aria-label="Open sidebar"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around px-2 py-2">
          <button
            onClick={() => setActiveNav('home')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeNav === 'home' ? 'text-purple-600' : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill={activeNav === 'home' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium">Home</span>
          </button>

          <button
            onClick={() => setActiveNav('explore')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeNav === 'explore' ? 'text-purple-600' : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs font-medium">Explore</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex flex-col items-center gap-1 px-4 py-2 -mt-6"
          >
            <div className="w-14 h-14 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </button>

          <button
            onClick={() => setActiveNav('connections')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeNav === 'connections' ? 'text-purple-600' : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs font-medium">Connect</span>
          </button>

          <button
            onClick={() => setActiveNav('profile')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeNav === 'profile' ? 'text-purple-600' : 'text-gray-600'
            }`}
          >
            <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full"></div>
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </nav>

      <CreateMomentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateMoment={handleCreateMoment}
      />

      {/* Mobile CSS */}
      <style jsx global>{`
        @media (max-width: 768px) {
          main {
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding-bottom: 80px;
          }
          
          aside {
            display: none;
          }

          body {
            overflow-x: hidden;
          }
        }
      `}</style>
    </div>
  );
}
