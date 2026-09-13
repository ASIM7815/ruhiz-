'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface VideoUploaderProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VideoUploader({ onSuccess, onCancel }: VideoUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Video must be less than 50MB');
      return;
    }

    setSelectedFile(file);
    setError('');

    // Create preview
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleUpload = async () => {
    if (!selectedFile || !caption.trim()) {
      setError('Please add a caption');
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        return;
      }

      setProgress(30);

      // Upload video
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', 'video');

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const { url: videoUrl } = await uploadResponse.json();
      setProgress(70);

      // Create post in database
      const { error: dbError } = await supabase
        .from('moments')
        .insert({
          user_id: user.id,
          content: caption,
          video_url: videoUrl,
          created_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;

      setProgress(100);
      onSuccess();
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload video. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Share a Video</h2>
        <p className="text-gray-600">Upload your video and add a caption</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!selectedFile ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-12 border-2 border-dashed border-gray-300 rounded-2xl hover:border-ruhiz-teal transition-colors bg-gray-50 hover:bg-green-50"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Click to select video</p>
              <p className="text-sm text-gray-500 mt-1">MP4, MOV, WebM up to 50MB</p>
            </div>
          </div>
        </button>
      ) : (
        <div className="space-y-4">
          {/* Video Preview */}
          <div className="relative rounded-2xl overflow-hidden bg-black">
            <video
              src={preview || ''}
              controls
              className="w-full max-h-96"
            />
            <button
              onClick={() => {
                setSelectedFile(null);
                setPreview(null);
              }}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Caption Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Caption *
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tell us about this video... ✨"
              maxLength={500}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ruhiz-teal focus:border-transparent resize-none text-gray-900"
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-500">Share what this moment means to you</p>
              <p className="text-xs text-gray-500">{caption.length}/500</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Uploading...</span>
            <span className="text-ruhiz-teal font-semibold">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ruhiz-teal to-green-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={uploading}
          className="flex-1 py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={!selectedFile || !caption.trim() || uploading}
          className="flex-1 py-3 px-6 bg-gradient-to-r from-ruhiz-teal to-green-500 text-white font-semibold rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Posting...' : 'Post Video'}
        </button>
      </div>
    </div>
  );
}
