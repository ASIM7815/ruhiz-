import { useState } from 'react';

interface UploadResult {
  success: boolean;
  url?: string;
  filename?: string;
  error?: string;
}

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadImage = async (file: File): Promise<UploadResult> => {
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress (since we can't track real upload progress easily)
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return {
        success: true,
        url: data.url,
        filename: data.filename,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return {
    uploadImage,
    uploading,
    progress,
  };
}
