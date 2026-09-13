'use client';

import { useState } from 'react';

export default function Settings() {
  const [activeSection, setActiveSection] = useState('account');

  const sections = [
    { id: 'account', name: 'Account', icon: '👤' },
    { id: 'privacy', name: 'Privacy & Safety', icon: '🔒' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'appearance', name: 'Appearance', icon: '🎨' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeSection === section.id
                    ? 'bg-purple-50 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{section.icon}</span>
                <span className="font-medium">{section.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {activeSection === 'account' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        defaultValue="you"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        defaultValue="you@example.com"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bio
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Tell us about yourself..."
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <button className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors">
                      Save Changes
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Danger Zone</h3>
                  <button className="px-4 py-2 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors">
                    Delete Account
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'privacy' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">Privacy & Safety</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Private Account</h4>
                      <p className="text-sm text-gray-600">Only connections can see your moments</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Show Journey</h4>
                      <p className="text-sm text-gray-600">Let connections see your journey</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Allow Messages</h4>
                      <p className="text-sm text-gray-600">Who can send you messages</p>
                    </div>
                    <select className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option>Everyone</option>
                      <option>Connections only</option>
                      <option>No one</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Likes</h4>
                      <p className="text-sm text-gray-600">When someone likes your moment</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Comments</h4>
                      <p className="text-sm text-gray-600">When someone comments on your moment</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium text-gray-900">New Connections</h4>
                      <p className="text-sm text-gray-600">When someone connects with you</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Messages</h4>
                      <p className="text-sm text-gray-600">When you receive a new message</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">Appearance</h2>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Theme</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <button className="p-4 border-2 border-purple-600 rounded-lg text-center">
                        <div className="w-full h-16 bg-white rounded mb-2"></div>
                        <span className="text-sm font-medium">Light</span>
                      </button>
                      <button className="p-4 border-2 border-gray-200 rounded-lg text-center hover:border-gray-300">
                        <div className="w-full h-16 bg-gray-900 rounded mb-2"></div>
                        <span className="text-sm font-medium">Dark</span>
                      </button>
                      <button className="p-4 border-2 border-gray-200 rounded-lg text-center hover:border-gray-300">
                        <div className="w-full h-16 bg-gradient-to-r from-white to-gray-900 rounded mb-2"></div>
                        <span className="text-sm font-medium">Auto</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Font Size</h4>
                    <input
                      type="range"
                      min="12"
                      max="20"
                      defaultValue="16"
                      className="w-full accent-purple-600"
                    />
                    <div className="flex justify-between text-sm text-gray-600 mt-2">
                      <span>Small</span>
                      <span>Medium</span>
                      <span>Large</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
