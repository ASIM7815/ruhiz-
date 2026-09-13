'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (croppedImage: Blob) => void;
  cropShape?: 'rect' | 'round';
  aspect?: number;
  title?: string;
}

export default function ImageCropModal({
  isOpen,
  onClose,
  imageSrc,
  onSave,
  cropShape = 'round',
  aspect = 1,
  title = 'Crop Image',
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: any
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    setSaving(true);
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onSave(croppedImage);
    } catch (e) {
      console.error('Error cropping image:', e);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-4xl h-[90vh] bg-white rounded-3xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cropper Area */}
        <div className="flex-1 relative bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={cropShape === 'rect'}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            minZoom={1}
            maxZoom={3}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-4 bg-white border-t border-gray-200">
          {/* Zoom Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-900">Zoom</label>
              <span className="text-sm text-gray-600">{Math.round((zoom - 1) * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setZoom(Math.max(1, zoom - 0.1))}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <button
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-200">
            <p className="text-sm text-gray-700">
              📱 <strong>Mobile:</strong> Pinch to zoom, drag to reposition
              <br />
              🖱️ <strong>Desktop:</strong> Use slider to zoom, drag to reposition
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 px-6 bg-gradient-to-r from-ruhiz-teal to-green-500 text-white font-semibold rounded-full hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #145C43;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #145C43;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
