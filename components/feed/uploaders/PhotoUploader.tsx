'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PhotoUploaderProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PhotoUploader({ onSuccess, onCancel }: PhotoUploaderProps) {
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
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
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

      // Upload photo
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', 'photo');

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const { url: imageUrl } = await uploadResponse.json();
      setProgress(70);

      // Create post in database
      const { error: dbError } = await supabase
        .from('moments')
        .insert({
          user_id: user.id,
          content: caption,
          image_url: imageUrl,
          created_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;

      setProgress(100);
      onSuccess();
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Share a Photo</h2>
        <p className="text-gray-600">Upload your photo and add a caption</p>
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
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!selectedFile ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-12 border-2 border-dashed border-gray-300 rounded-2xl hover:border-ruhiz-teal transition-colors bg-gray-50 hover:bg-blue-50"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Click to select photo</p>
              <p className="text-sm text-gray-500 mt-1">JPG, PNG, GIF up to 10MB</p>
            </div>
          </div>
        </button>
      ) : (
        <div className="space-y-4">
          {/* Photo Preview */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200">
            <img
              src={preview || ''}
              alt="Preview"
              className="w-full max-h-96 object-contain bg-gray-50"
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
              placeholder="What's the story behind this photo? 📸"
              maxLength={500}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ruhiz-teal focus:border-transparent resize-none text-gray-900"
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-500">Caption your moment</p>
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
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
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
          className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Posting...' : 'Post Photo'}
        </button>
      </div>
    </div>
  );
}
