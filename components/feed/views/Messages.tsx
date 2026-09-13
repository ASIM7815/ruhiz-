'use client';

import { useState } from 'react';

export default function Messages() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');

  const conversations = [
    {
      id: '1',
      name: 'Alex Johnson',
      lastMessage: 'Hey, how are you doing?',
      time: '2h ago',
      unread: 1,
      messages: [
        { id: 'm1', from: 'them', text: 'Hey, how are you doing?', time: '2h ago' },
      ],
    },
    {
      id: '2',
      name: 'Sarah Khan',
      lastMessage: 'Thanks for sharing that moment!',
      time: '1d ago',
      unread: 0,
      messages: [
        { id: 'm2', from: 'them', text: 'Thanks for sharing that moment!', time: '1d ago' },
      ],
    },
  ];

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Messages</h1>
        <p className="text-gray-600">Connect privately with your connections</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex" style={{ height: '600px' }}>
        {/* Conversations List */}
        <div className="w-80 border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search messages..."
              className="w-full px-4 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  selectedConversation === conv.id ? 'bg-purple-50' : ''
                }`}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {conv.name[0]}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-gray-900 truncate">{conv.name}</h4>
                    <span className="text-xs text-gray-500">{conv.time}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                </div>
                {conv.unread > 0 && (
                  <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 flex flex-col">
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedConv.name[0]}
                  </div>
                  <h3 className="font-semibold text-gray-900">{selectedConv.name}</h3>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-full">
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {selectedConv.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.from === 'them' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-2xl ${
                        msg.from === 'them'
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-purple-600 text-white'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <p className={`text-xs mt-1 ${msg.from === 'them' ? 'text-gray-500' : 'text-purple-200'}`}>
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    disabled={!messageText.trim()}
                    className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">💬</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a conversation</h3>
                <p className="text-gray-600">Choose a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
