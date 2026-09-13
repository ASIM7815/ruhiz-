'use client';

import { useState } from 'react';

export default function Notifications() {
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      type: 'like',
      user: 'Alex Johnson',
      content: 'liked your moment',
      time: '2h ago',
      isRead: false,
    },
    {
      id: '2',
      type: 'comment',
      user: 'Sarah Khan',
      content: 'commented on your moment: "Great perspective!"',
      time: '5h ago',
      isRead: false,
    },
    {
      id: '3',
      type: 'connection',
      user: 'Mike Chen',
      content: 'sent you a connection request',
      time: '1d ago',
      isRead: true,
    },
  ]);

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'connection':
        return '👥';
      case 'beenhere':
        return '📍';
      default:
        return '🔔';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h1>
          <p className="text-gray-600">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-sm text-purple-600 hover:underline font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            onClick={() => markAsRead(notification.id)}
            className={`w-full p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors text-left ${
              !notification.isRead ? 'bg-purple-50' : ''
            }`}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-xl flex-shrink-0">
              {getIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900">
                <span className="font-semibold">{notification.user}</span>{' '}
                {notification.content}
              </p>
              <p className="text-sm text-gray-500 mt-1">{notification.time}</p>
            </div>
            {!notification.isRead && (
              <div className="w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
            )}
          </button>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔔</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications yet</h3>
          <p className="text-gray-600">When you get notifications, they'll show up here</p>
        </div>
      )}
    </div>
  );
}
