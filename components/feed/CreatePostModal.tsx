'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import VideoUploader from './uploaders/VideoUploader';
import PhotoUploader from './uploaders/PhotoUploader';
import MomentComposer from './uploaders/MomentComposer';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

type PostType = 'video' | 'photo' | 'moment' | null;

export default function CreatePostModal({ isOpen, onClose, onPostCreated }: CreatePostModalProps) {
  const [selectedType, setSelectedType] = useState<PostType>(null);
  const supabase = createClient();

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedType(null);
    onClose();
  };

  const handlePostSuccess = () => {
    setSelectedType(null);
    onPostCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {!selectedType ? (
            // Type Selection Screen
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Create a Post</h2>
              <p className="text-gray-600 mb-8">What do you want to share today?</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Video Option */}
                <button
                  onClick={() => setSelectedType('video')}
                  className="group relative overflow-hidden rounded-2xl border-2 border-gray-200 hover:border-ruhiz-teal transition-all duration-300 p-6 text-center bg-gradient-to-br from-purple-50 to-pink-50 hover:shadow-lg"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Video</h3>
                      <p className="text-sm text-gray-600">Share a vibe</p>
                    </div>
                  </div>
                </button>

                {/* Photo Option */}
                <button
                  onClick={() => setSelectedType('photo')}
                  className="group relative overflow-hidden rounded-2xl border-2 border-gray-200 hover:border-ruhiz-teal transition-all duration-300 p-6 text-center bg-gradient-to-br from-blue-50 to-cyan-50 hover:shadow-lg"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Photo</h3>
                      <p className="text-sm text-gray-600">Capture the moment</p>
                    </div>
                  </div>
                </button>

                {/* Moment Option */}
                <button
                  onClick={() => setSelectedType('moment')}
                  className="group relative overflow-hidden rounded-2xl border-2 border-gray-200 hover:border-ruhiz-teal transition-all duration-300 p-6 text-center bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-lg"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Moment</h3>
                      <p className="text-sm text-gray-600">Write your story</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-8 p-4 bg-green-50 rounded-2xl border border-green-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">Safe Space Reminder</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Share authentically. Your mental health matters. Posts are visible to the Ruhiz community.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedType === 'video' ? (
            <VideoUploader onSuccess={handlePostSuccess} onCancel={() => setSelectedType(null)} />
          ) : selectedType === 'photo' ? (
            <PhotoUploader onSuccess={handlePostSuccess} onCancel={() => setSelectedType(null)} />
          ) : (
            <MomentComposer onSuccess={handlePostSuccess} onCancel={() => setSelectedType(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
