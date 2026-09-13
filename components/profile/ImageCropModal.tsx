'use client';

import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Modal, ModalHeader, PrimaryButton, GhostButton, Spinner } from '@/components/ui/Primitives';

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (croppedImage: Blob) => void;
  cropShape?: 'rect' | 'round';
  aspect?: number;
  title?: string;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? new Blob()), 'image/jpeg', 0.92);
  });
}

export default function ImageCropModal({
  isOpen,
  onClose,
  imageSrc,
  onSave,
  cropShape = 'round',
  aspect = 1,
  title = 'Crop image',
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onSave(blob);
      onClose();
    } catch {
      /* keep modal open on failure */
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} maxWidth="max-w-md">
      <ModalHeader title={title} subtitle="Drag to reposition, pinch or use the slider to zoom" onClose={onClose} />
      <div className="p-6">
        <div className="relative w-full h-72 bg-black rounded-2xl overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="mt-5">
          <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <span className="text-xs font-medium w-12">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--brand)]"
            />
            <span className="text-xs w-10 text-right">{zoom.toFixed(1)}×</span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <GhostButton onClick={onClose} className="flex-1">
            Cancel
          </GhostButton>
          <PrimaryButton onClick={handleSave} disabled={saving} className="flex-1">
            {saving && <Spinner size={14} />}
            {saving ? 'Saving…' : 'Apply crop'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
