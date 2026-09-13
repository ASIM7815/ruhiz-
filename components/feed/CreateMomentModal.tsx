'use client';

import { useState, useRef } from 'react';

interface CreateMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateMoment: (moment: any) => void;
}

export default function CreateMomentModal({ isOpen, onClose, onCreateMoment }: CreateMomentModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'photo' | 'video' | 'question'>('text');
  const [content, setContent] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [audience, setAudience] = useState('everyone');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const topics = ['Life', 'Relationships', 'School / College', 'Career', 'Mental Health', 'Family', 'Self-improvement'];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!content.trim() && !mediaFile) return;

    const newMoment = {
      id: `user-${Date.now()}`,
      author: {
        name: 'You',
        avatar: null,
        time: 'Just now',
      },
      content: content.trim(),
      type: activeTab === 'video' ? 'video' : activeTab === 'photo' ? 'image' : 'text',
      videoUrl: activeTab === 'video' && mediaPreview ? mediaPreview : undefined,
      imageUrl: activeTab === 'photo' && mediaPreview ? mediaPreview : undefined,
      topics: selectedTopics,
      likes: 0,
      comments: [],
      shares: 0,
      saves: 0,
      beenHere: 0,
      isLiked: false,
      isSaved: false,
      hasBeenHere: false,
    };

    onCreateMoment(newMoment);
    handleClose();
  };

  const handleClose = () => {
    setContent('');
    setSelectedTopics([]);
    setAudience('everyone');
    setMediaPreview(null);
    setMediaFile(null);
    setActiveTab('text');
    onClose();
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Create Moment</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('text')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Text
            </button>
            <button
              onClick={() => setActiveTab('photo')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'photo'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Photo
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'video'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Video
            </button>
            <button
              onClick={() => setActiveTab('question')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'question'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Question
            </button>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full"></div>
            <div>
              <p className="font-semibold text-gray-900">You</p>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="text-sm text-gray-600 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="everyone">Everyone</option>
                <option value="connections">Connections only</option>
                <option value="private">Only me</option>
              </select>
            </div>
          </div>

          {/* Text Input */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              activeTab === 'question'
                ? "What's your question?"
                : "What's happening with you?"
            }
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            rows={6}
          />

          {/* Media Upload */}
          {(activeTab === 'photo' || activeTab === 'video') && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={activeTab === 'photo' ? 'image/*' : 'video/*'}
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {mediaPreview ? (
                <div className="relative">
                  {activeTab === 'photo' ? (
                    <img src={mediaPreview} alt="Preview" className="w-full rounded-xl" />
                  ) : (
                    <video src={mediaPreview} controls className="w-full rounded-xl" />
                  )}
                  <button
                    onClick={() => {
                      setMediaPreview(null);
                      setMediaFile(null);
                    }}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-12 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors flex flex-col items-center justify-center gap-3"
                >
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {activeTab === 'photo' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    )}
                  </svg>
                  <div className="text-center">
                    <p className="text-gray-700 font-medium">
                      Click to upload {activeTab}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      or drag and drop
                    </p>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Topics */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Add topics (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedTopics.includes(topic)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-6 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() && !mediaFile}
            className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Share Moment
          </button>
        </div>
      </div>
    </div>
  );
}
