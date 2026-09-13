'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import ImageCropModal from '@/components/profile/ImageCropModal';

interface ProfileViewProps {
  user: any;
  isRightSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function ProfileView({ user, isRightSidebarOpen, onToggleSidebar }: ProfileViewProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState('');
  const [cropType, setCropType] = useState<'profile' | 'cover'>('profile');
  const [uploading, setUploading] = useState(false);
  
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const coverPhotoInputRef = useRef<HTMLInputElement>(null);
  
  const supabase = createClient();

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = (type: 'profile' | 'cover') => {
    setCropType(type);
    if (type === 'profile') {
      profilePhotoInputRef.current?.click();
    } else {
      coverPhotoInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    setUploading(true);
    setCropModalOpen(false);

    try {
      const file = new File([croppedBlob], `${cropType}-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'photo');

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const { url: imageUrl } = await uploadResponse.json();

      const updateField = cropType === 'profile' ? 'avatar_url' : 'cover_url';
      const { error } = await supabase
        .from('profiles')
        .update({ [updateField]: imageUrl })
        .eq('user_id', user.id);

      if (error) throw error;

      await loadProfile();
      alert(`${cropType === 'profile' ? 'Profile' : 'Cover'} photo updated successfully!`);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      setImageToCrop('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-12 w-12 text-[#145C43]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Sidebar Toggle Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 bg-white border border-[#E3EAE6] rounded-full hover:bg-[#F7F9F7] transition-colors"
          aria-label={isRightSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <svg 
            className={`w-5 h-5 text-[#18332A] transition-transform ${isRightSidebarOpen ? 'rotate-0' : 'rotate-180'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Cover Image with Profile Photo Overlay */}
      <div className="relative w-full h-[200px] bg-gradient-to-r from-purple-400 via-pink-300 to-orange-300 rounded-t-2xl overflow-hidden">
        {profile?.cover_url ? (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-purple-300 via-pink-200 to-orange-200">
            <div className="text-right pr-8">
              <p className="text-white text-2xl italic font-light leading-tight">Some</p>
              <p className="text-white text-2xl italic font-light leading-tight">Struggles</p>
              <p className="text-white text-2xl italic font-light leading-tight">Brighter</p>
              <p className="text-white text-2xl italic font-light leading-tight">Tomorrows</p>
            </div>
          </div>
        )}
        
        {/* Edit Cover Button */}
        <button
          onClick={() => handlePhotoSelect('cover')}
          disabled={uploading}
          className="absolute top-3 right-3 px-4 py-2 bg-white/90 hover:bg-white text-[#18332A] rounded-lg font-medium flex items-center gap-2 shadow-md transition-colors disabled:opacity-50 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Edit Cover
        </button>

        {/* Profile Photo */}
        <div className="absolute -bottom-16 left-6">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-white bg-white overflow-hidden shadow-xl">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
            
            {/* Camera Icon on Profile Photo */}
            <button
              onClick={() => handlePhotoSelect('profile')}
              disabled={uploading}
              className="absolute bottom-1 right-1 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center border border-[#E3EAE6] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5 text-[#18332A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Profile Info Card */}
      <div className="bg-white rounded-b-2xl border-x border-b border-[#E3EAE6] pt-20 pb-6 px-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-[#18332A]">
                {profile?.display_name || profile?.username || 'Asim Saad'}
              </h1>
              <svg className="w-5 h-5 text-[#2D9CDB]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[#718078] text-sm mb-3">@{profile?.username || 'asimsaad'}</p>
            <p className="text-[#18332A] text-sm leading-relaxed mb-3">
              {profile?.bio || 'Building a kinder internet with Ruhiz. Sharing thoughts, struggles and progress. People • Ideas • Growth 🌱'}
            </p>
            <div className="flex items-center gap-4 text-xs text-[#718078]">
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Hyderabad, India</span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Joined Jan 2024</span>
              </div>
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-lg font-bold text-[#18332A]">2.4K</div>
                <div className="text-xs text-[#718078]">Supporters</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[#18332A]">183</div>
                <div className="text-xs text-[#718078]">Supporting</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-5 py-2 bg-[#145C43] text-white font-medium rounded-lg hover:bg-[#0B3D2E] transition-colors text-sm">
                Edit Profile
              </button>
              <button className="w-9 h-9 border border-[#E3EAE6] rounded-lg flex items-center justify-center hover:bg-[#F7F9F7] transition-colors">
                <svg className="w-4 h-4 text-[#18332A]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-[#E3EAE6] pt-3 mt-4">
          <div className="flex gap-8">
            {['Posts', 'Photos', 'Videos', 'Moments', 'Saved'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={`pb-3 font-medium transition-colors relative text-sm ${
                  activeTab === tab.toLowerCase()
                    ? 'text-[#145C43]'
                    : 'text-[#718078] hover:text-[#18332A]'
                }`}
              >
                {tab}
                {activeTab === tab.toLowerCase() && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#145C43]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {/* Sample Post Cards */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E3EAE6] p-3 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400"></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#18332A] truncate">{profile?.username || 'Asim Saad'}</p>
                <p className="text-xs text-[#718078]">2d ago • {i === 1 ? 'Video' : i === 2 ? 'Moment' : 'Photo'}</p>
              </div>
              <button className="text-[#718078] hover:text-[#18332A]">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
            <div className="aspect-square bg-gradient-to-br from-orange-200 via-pink-200 to-purple-200 rounded-lg"></div>
          </div>
        ))}
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={profilePhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={coverPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Image Crop Modal */}
      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false);
          setImageToCrop('');
        }}
        imageSrc={imageToCrop}
        onSave={handleCroppedImage}
        cropShape={cropType === 'profile' ? 'round' : 'rect'}
        aspect={cropType === 'profile' ? 1 : 16 / 9}
        title={`Crop ${cropType === 'profile' ? 'Profile' : 'Cover'} Photo`}
      />
    </div>
  );
}
