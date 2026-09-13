'use client';

import { NavigationItem } from './FeedLayout';
import HomeFeed from './views/HomeFeed';
import ExploreFeed from './views/ExploreFeed';
import MyJourney from './views/MyJourney';
import Connections from './views/Connections';
import Messages from './views/Messages';
import Notifications from './views/Notifications';
import Saved from './views/Saved';
import Profile from './views/Profile';
import Settings from './views/Settings';

interface MainFeedProps {
  activeNav: NavigationItem;
  userMoments: any[];
  onUpdateMoments: (moments: any[]) => void;
  onCreateMoment: () => void;
}

export default function MainFeed({ activeNav, userMoments, onUpdateMoments, onCreateMoment }: MainFeedProps) {
  const renderView = () => {
    switch (activeNav) {
      case 'home':
        return <HomeFeed userMoments={userMoments} onUpdateMoments={onUpdateMoments} onCreateMoment={onCreateMoment} />;
      case 'explore':
        return <ExploreFeed />;
      case 'journey':
        return <MyJourney />;
      case 'connections':
        return <Connections />;
      case 'messages':
        return <Messages />;
      case 'notifications':
        return <Notifications />;
      case 'saved':
        return <Saved />;
      case 'profile':
        return <Profile />;
      case 'settings':
        return <Settings />;
      default:
        return <HomeFeed userMoments={userMoments} onUpdateMoments={onUpdateMoments} onCreateMoment={onCreateMoment} />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {renderView()}
    </div>
  );
}
