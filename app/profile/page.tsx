'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ImageCropModal from '@/components/profile/ImageCropModal';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Image upload states
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState('');
  const [cropType, setCropType] = useState<'profile' | 'cover'>('profile');
  const [uploading, setUploading] = useState(false);
  
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const coverPhotoInputRef = useRef<HTMLInputElement>(null);
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);

      // Load profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', currentUser.id)
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

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB');
      return;
    }

    // Create preview URL
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
      // Convert blob to file
      const file = new File([croppedBlob], `${cropType}-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });

      // Upload to R2
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

      // Update profile in database
      const updateField = cropType === 'profile' ? 'avatar_url' : 'cover_url';
      const { error } = await supabase
        .from('profiles')
        .update({ [updateField]: imageUrl })
        .eq('user_id', user.id);

      if (error) throw error;

      // Reload profile
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
      <div className="min-h-screen bg-[#F7F9F7] flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-[#145C43] mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-[#718078]">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F7]">
      {/* Cover Image */}
      <div className="relative w-full h-[300px] sm:h-[400px] bg-gradient-to-br from-orange-200 via-pink-200 to-purple-300 overflow-hidden">
        {profile?.cover_url ? (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white/80">
              <p className="text-2xl sm:text-4xl italic font-light mb-2">Some Struggles</p>
              <p className="text-2xl sm:text-4xl italic font-light">Brighter Tomorrows</p>
            </div>
          </div>
        )}
        
        {/* Edit Cover Button */}
        <button
          onClick={() => handlePhotoSelect('cover')}
          disabled={uploading}
          className="absolute top-4 right-4 px-4 py-2 bg-white/90 hover:bg-white text-gray-800 rounded-lg font-medium flex items-center gap-2 shadow-lg transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Edit Cover
        </button>
      </div>

      {/* Profile Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Profile Header */}
        <div className="relative -mt-20 sm:-mt-24">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
            {/* Profile Photo */}
            <div className="relative">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white bg-[#8FC9A8] overflow-hidden shadow-xl">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* Edit Profile Photo Button */}
              <button
                onClick={() => handlePhotoSelect('profile')}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-gray-100 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center sm:text-left mb-6">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {profile?.display_name || profile?.username || 'Anonymous'}
                </h1>
                <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-3">@{profile?.username || 'user'}</p>
              <p className="text-gray-700 mb-4 max-w-2xl">
                {profile?.bio || 'Building a kinder internet with Ruhiz. Sharing thoughts, struggles and progress. People • Ideas • Growth 🌱'}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500 justify-center sm:justify-start">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Joined {new Date(profile?.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Stats & Actions */}
            <div className="flex flex-col items-center sm:items-end gap-4">
              <div className="flex gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">2.4K</div>
                  <div className="text-sm text-gray-600">Supporters</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">183</div>
                  <div className="text-sm text-gray-600">Supporting</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="px-6 py-2 bg-[#145C43] text-white font-semibold rounded-lg hover:bg-[#0B3D2E] transition-colors"
                >
                  Edit Profile
                </button>
                <button className="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 border-b border-gray-200">
          <nav className="flex gap-8">
            {['Posts', 'Photos', 'Videos', 'Moments', 'Saved'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={`pb-4 font-semibold transition-colors relative ${
                  activeTab === tab.toLowerCase()
                    ? 'text-[#145C43]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
                {activeTab === tab.toLowerCase() && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#145C43] rounded-t-full" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Grid */}
        <div className="mt-8 pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Placeholder posts - replace with actual data */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gradient-to-br from-orange-200 to-pink-200 flex items-center justify-center">
                <p className="text-white text-center p-4">No posts yet</p>
              </div>
            </div>
          </div>
        </div>
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
