'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function PostCard() {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(124);
  const [saved, setSaved] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const handleSave = () => {
    setSaved(!saved);
  };

  return (
    <article className="bg-white rounded-2xl border border-[#E3EAE6] overflow-hidden">
      {/* Post Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#8FC9A8] rounded-full flex items-center justify-center text-white font-semibold text-lg">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-[#18332A]">Alex</h4>
              <svg className="w-4 h-4 text-[#718078]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <p className="text-sm text-[#718078]">2h ago</p>
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-[#F7F9F7] rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-[#718078]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[#E3EAE6] py-2 w-48 z-10">
              <button className="w-full px-4 py-2 text-left text-sm text-[#18332A] hover:bg-[#F7F9F7]">
                Edit post
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-[#18332A] hover:bg-[#F7F9F7]">
                Delete post
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-[#18332A] hover:bg-[#F7F9F7]">
                Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div className="px-5 pb-4">
        <p className="text-[#18332A] leading-relaxed mb-3">
          Sometimes a peaceful evening is all you need. 💚
        </p>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-[#DCEDE4] text-[#145C43] text-xs font-medium rounded-full">
            Life
          </span>
          <span className="px-3 py-1 bg-[#DCEDE4] text-[#145C43] text-xs font-medium rounded-full">
            Mental Health
          </span>
        </div>
      </div>

      {/* Post Image */}
      <div className="relative w-full aspect-[16/10]">
        <Image
          src="/images/ruhizhero.png"
          alt="Post image"
          fill
          className="object-cover"
        />
      </div>

      {/* Post Actions */}
      <div className="p-5 border-t border-[#E3EAE6]">
        <div className="flex items-center gap-6">
          <button
            onClick={handleLike}
            className="flex items-center gap-2 hover:text-[#145C43] transition-colors group"
          >
            <svg 
              className={`w-5 h-5 ${liked ? 'fill-[#145C43] text-[#145C43]' : 'text-[#718078]'}`}
              fill={liked ? 'currentColor' : 'none'}
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className={`text-sm font-medium ${liked ? 'text-[#145C43]' : 'text-[#718078]'}`}>
              {likeCount}
            </span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 hover:text-[#145C43] transition-colors group"
          >
            <svg className="w-5 h-5 text-[#718078] group-hover:text-[#145C43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-medium text-[#718078] group-hover:text-[#145C43]">18</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="flex items-center gap-2 hover:text-[#145C43] transition-colors group"
            >
              <svg className="w-5 h-5 text-[#718078] group-hover:text-[#145C43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="text-sm font-medium text-[#718078] group-hover:text-[#145C43]">Share</span>
            </button>
            {showShareMenu && (
              <div className="absolute left-0 bottom-full mb-2 bg-white rounded-lg shadow-lg border border-[#E3EAE6] py-2 w-48 z-10">
                <button className="w-full px-4 py-2 text-left text-sm text-[#18332A] hover:bg-[#F7F9F7]">
                  Share to feed
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-[#18332A] hover:bg-[#F7F9F7]">
                  Copy link
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-[#18332A] hover:bg-[#F7F9F7]">
                  Share via message
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            className="ml-auto flex items-center gap-2 hover:text-[#145C43] transition-colors group"
          >
            <svg 
              className={`w-5 h-5 ${saved ? 'fill-[#145C43] text-[#145C43]' : 'text-[#718078]'}`}
              fill={saved ? 'currentColor' : 'none'}
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className={`text-sm font-medium ${saved ? 'text-[#145C43]' : 'text-[#718078]'}`}>
              Save
            </span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="px-5 pb-5 border-t border-[#E3EAE6] pt-4">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-[#8FC9A8] rounded-full flex-shrink-0"></div>
              <div className="flex-1">
                <div className="bg-[#F7F9F7] rounded-2xl px-4 py-3">
                  <p className="font-semibold text-sm text-[#18332A]">Sarah</p>
                  <p className="text-sm text-[#18332A]">Beautiful! Where is this?</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-[#8FC9A8] rounded-full flex-shrink-0"></div>
              <input
                type="text"
                placeholder="Write a comment..."
                className="flex-1 px-4 py-2 bg-[#F7F9F7] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#145C43]"
              />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
