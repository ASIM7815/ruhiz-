'use client';

import { useRef, useState } from 'react';
import { useImageUpload } from '@/lib/hooks/useImageUpload';

interface ImageUploadProps {
  onUploadComplete?: (url: string) => void;
  onError?: (error: string) => void;
}

export default function ImageUpload({ onUploadComplete, onError }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const { uploadImage, uploading, progress } = useImageUpload();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      const errorMsg = 'Please select an image file';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      const errorMsg = 'Image must be less than 5MB';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setError('');
    const result = await uploadImage(file);

    if (result.success && result.url) {
      onUploadComplete?.(result.url);
    } else {
      const errorMsg = result.error || 'Upload failed';
      setError(errorMsg);
      onError?.(errorMsg);
      setPreview(null);
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-2xl hover:border-ruhiz-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <svg className="animate-spin h-6 w-6 text-ruhiz-teal" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-gray-600">Uploading... {progress}%</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-600">Click to upload image</span>
            <span className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</span>
          </div>
        )}
      </button>

      {preview && !uploading && (
        <div className="mt-4">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-2xl"
          />
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
