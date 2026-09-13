'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MomentComposerProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const EMOJI_LIST = ['😊', '💙', '✨', '🌟', '💕', '🔥', '💪', '🌈', '☀️', '🌙', '💭', '🎨', '📝', '🎯', '💡'];

export default function MomentComposer({ onSuccess, onCancel }: MomentComposerProps) {
  const [content, setContent] = useState('');
  const [fontSize, setFontSize] = useState('text-base');
  const [fontStyle, setFontStyle] = useState('normal');
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const supabase = createClient();

  const fontSizes = [
    { label: 'Small', value: 'text-sm', size: 'text-sm' },
    { label: 'Normal', value: 'text-base', size: 'text-base' },
    { label: 'Large', value: 'text-lg', size: 'text-lg' },
    { label: 'XL', value: 'text-xl', size: 'text-xl' },
  ];

  const fontStyles = [
    { label: 'Normal', value: 'normal' },
    { label: 'Bold', value: 'bold' },
    { label: 'Italic', value: 'italic' },
  ];

  const insertEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handlePublish = async () => {
    if (!content.trim()) {
      setError('Please write something');
      return;
    }

    if (content.length < 10) {
      setError('Your moment should be at least 10 characters');
      return;
    }

    setPublishing(true);
    setError('');

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        return;
      }

      // Create post in database
      const { error: dbError } = await supabase
        .from('moments')
        .insert({
          user_id: user.id,
          content: content,
          created_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;

      onSuccess();
    } catch (err) {
      console.error('Publish error:', err);
      setError('Failed to publish moment. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Write a Moment</h2>
        <p className="text-gray-600">Share your thoughts, feelings, or story</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {!showPreview ? (
        <>
          {/* Formatting Toolbar */}
          <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
            {/* Font Size */}
            <div className="flex gap-1">
              {fontSizes.map((size) => (
                <button
                  key={size.value}
                  onClick={() => setFontSize(size.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    fontSize === size.value
                      ? 'bg-ruhiz-teal text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>

            <div className="w-px h-8 bg-gray-300" />

            {/* Font Style */}
            <div className="flex gap-1">
              {fontStyles.map((style) => (
                <button
                  key={style.value}
                  onClick={() => setFontStyle(style.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    fontStyle === style.value
                      ? 'bg-ruhiz-teal text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  } ${style.value === 'bold' ? 'font-bold' : ''} ${style.value === 'italic' ? 'italic' : ''}`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            <div className="w-px h-8 bg-gray-300" />

            {/* Emoji Picker */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-100 transition-colors"
              >
                😊 Emoji
              </button>
              
              {showEmojiPicker && (
                <div className="absolute top-full mt-2 left-0 z-10 p-3 bg-white rounded-2xl shadow-lg border border-gray-200 grid grid-cols-5 gap-2">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="text-2xl hover:scale-125 transition-transform p-2"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Content Editor */}
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind? Share your story, thoughts, or feelings... 💭"
              maxLength={5000}
              rows={12}
              className={`w-full px-6 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ruhiz-teal focus:border-transparent resize-none ${fontSize} ${
                fontStyle === 'bold' ? 'font-bold' : ''
              } ${fontStyle === 'italic' ? 'italic' : ''}`}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-500">Write from your heart</p>
              <p className="text-xs text-gray-500">{content.length}/5000</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-2xl border border-green-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm mb-1">Pro Tip</h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Take your time. Break your thoughts into paragraphs. Use emojis to express emotions. Be authentic.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Preview */}
          <div className="p-6 bg-gradient-to-br from-gray-50 to-green-50 rounded-2xl border-2 border-green-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">👀</span>
              <h3 className="font-bold text-gray-900">Preview</h3>
            </div>
            <div
              className={`whitespace-pre-wrap ${fontSize} ${
                fontStyle === 'bold' ? 'font-bold' : ''
              } ${fontStyle === 'italic' ? 'italic' : ''} text-gray-800 leading-relaxed`}
            >
              {content}
            </div>
          </div>
        </>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={publishing}
          className="flex-1 py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        
        <button
          onClick={() => setShowPreview(!showPreview)}
          disabled={!content.trim() || publishing}
          className="flex-1 py-3 px-6 border-2 border-ruhiz-teal text-ruhiz-teal font-semibold rounded-full hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          {showPreview ? '← Edit' : 'Preview'}
        </button>
        
        <button
          onClick={handlePublish}
          disabled={!content.trim() || publishing}
          className="flex-1 py-3 px-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {publishing ? 'Publishing...' : 'Publish Moment'}
        </button>
      </div>
    </div>
  );
}
