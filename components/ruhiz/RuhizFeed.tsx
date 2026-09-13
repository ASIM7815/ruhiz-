'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import TopNav from './TopNav';
import LeftSidebar from './LeftSidebar';
import MainFeed from './MainFeed';
import RightSidebar from './RightSidebar';
import CreatePostModal from '../feed/CreatePostModal';

export default function RuhizFeed() {
  const [activeNav, setActiveNav] = useState('home');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handlePostCreated = () => {
    // Refresh feed after post is created
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9F7] flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-[#145C43] mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-[#718078]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F7]">
      <TopNav user={user} onLogout={handleLogout} />
      
      <div className="flex pt-[70px]">
        <LeftSidebar 
          activeNav={activeNav}
          onNavigate={setActiveNav}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          onCreatePost={() => setIsPostModalOpen(true)}
        />
        
        <main 
          className={`flex-1 transition-all duration-300 ${
            isRightSidebarOpen ? 'mr-[340px]' : 'mr-0'
          } ml-[240px] px-6 py-6`}
        >
          <MainFeed 
            isRightSidebarOpen={isRightSidebarOpen} 
            onToggleSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            user={user}
            activeNav={activeNav}
          />
        </main>
        
        <RightSidebar isOpen={isRightSidebarOpen} />
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
}
