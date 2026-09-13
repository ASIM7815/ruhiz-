'use client';

import { NavigationItem } from './FeedLayout';

interface LeftSidebarProps {
  activeNav: NavigationItem;
  onNavigate: (nav: NavigationItem) => void;
  onCreateMoment: () => void;
}

export default function LeftSidebar({ activeNav, onNavigate, onCreateMoment }: LeftSidebarProps) {
  const navItems = [
    { id: 'home' as NavigationItem, label: 'Home', icon: '🏠' },
    { id: 'explore' as NavigationItem, label: 'Explore', icon: '🔍' },
    { id: 'journey' as NavigationItem, label: 'My Journey', icon: '📖' },
    { id: 'connections' as NavigationItem, label: 'Connections', icon: '👥' },
    { id: 'messages' as NavigationItem, label: 'Messages', icon: '💬', badge: 1 },
    { id: 'notifications' as NavigationItem, label: 'Notifications', icon: '🔔', badge: 3 },
    { id: 'saved' as NavigationItem, label: 'Saved', icon: '🔖' },
    { id: 'profile' as NavigationItem, label: 'Profile', icon: '👤' },
    { id: 'settings' as NavigationItem, label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
              activeNav === item.id
                ? 'bg-purple-50 text-purple-600 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Create Moment Button */}
      <button
        onClick={onCreateMoment}
        className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create Moment
      </button>

      {/* Create a Moment Panel */}
      <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <span>✨</span>
          Create a Moment
        </h3>
        <p className="text-xs text-gray-600 mb-3">
          Share your story, ask a question or explore what others are going through.
        </p>
        <button
          onClick={onCreateMoment}
          className="w-full text-sm px-4 py-2 bg-white text-purple-600 font-medium rounded-lg hover:bg-purple-100 transition-colors"
        >
          What's on your mind?
        </button>
      </div>
    </aside>
  );
}
