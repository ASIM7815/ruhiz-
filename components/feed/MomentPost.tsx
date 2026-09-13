'use client';

import { useState, useRef } from 'react';

interface MomentPostProps {
  moment: any;
  onUpdate: (updates: any) => void;
}

export default function MomentPost({ moment, onUpdate }: MomentPostProps) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const handleLike = () => {
    onUpdate({
      isLiked: !moment.isLiked,
      likes: moment.isLiked ? moment.likes - 1 : moment.likes + 1,
    });
  };

  const handleSave = () => {
    onUpdate({
      isSaved: !moment.isSaved,
      saves: moment.isSaved ? moment.saves - 1 : moment.saves + 1,
    });
  };

  const handleBeenHere = () => {
    onUpdate({
      hasBeenHere: !moment.hasBeenHere,
      beenHere: moment.hasBeenHere ? moment.beenHere - 1 : moment.beenHere + 1,
    });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const newCommentObj = {
      id: `c${Date.now()}`,
      author: 'You',
      text: newComment,
    };
    
    onUpdate({
      comments: [...moment.comments, newCommentObj],
    });
    
    setNewComment('');
  };

  const handleShare = () => {
    onUpdate({
      shares: moment.shares + 1,
    });
    setShowShareMenu(false);
    alert('Moment shared!');
  };

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setVolume(vol);
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <article className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Post Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold">
            {moment.author.name[0]}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{moment.author.name}</h4>
            <p className="text-sm text-gray-500">{moment.author.time}</p>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-full">
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        <p className="text-gray-800 leading-relaxed">{moment.content}</p>
      </div>

      {/* Topics */}
      {moment.topics && moment.topics.length > 0 && (
        <div className="px-4 pb-3 flex gap-2">
          {moment.topics.map((topic: string) => (
            <span key={topic} className="px-3 py-1 bg-purple-50 text-purple-600 text-xs font-medium rounded-full">
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Video Player */}
      {moment.type === 'video' && (
        <div className="relative bg-black group">
          <video
            ref={videoRef}
            className="w-full aspect-video object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onClick={togglePlay}
          >
            <source src={moment.videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          {/* Video Controls Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
              {/* Progress Bar */}
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />

              {/* Controls */}
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <button onClick={togglePlay} className="hover:scale-110 transition-transform">
                    {isPlaying ? (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button onClick={toggleMute} className="hover:scale-110 transition-transform">
                      {isMuted ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                        </svg>
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  <span className="text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <button onClick={toggleFullscreen} className="hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Play button overlay when paused */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={togglePlay}
                className="w-20 h-20 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all"
              >
                <svg className="w-10 h-10 text-purple-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-4 py-3 flex items-center justify-between text-sm text-gray-600 border-t border-gray-100">
        <div className="flex items-center gap-4">
          <span>{moment.likes} likes</span>
          <span>{moment.comments.length} comments</span>
          {moment.beenHere > 0 && <span>{moment.beenHere} have been here</span>}
        </div>
        <div className="flex items-center gap-2">
          {moment.shares > 0 && <span>{moment.shares} shares</span>}
          {moment.saves > 0 && <span>{moment.saves} saved</span>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 flex items-center gap-2 border-t border-gray-100">
        <button
          onClick={handleLike}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${
            moment.isLiked
              ? 'bg-purple-50 text-purple-600'
              : 'hover:bg-gray-50 text-gray-600'
          }`}
        >
          <svg className={`w-5 h-5 ${moment.isLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-sm font-medium">Like</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-medium">Comment</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-sm font-medium">Share</span>
          </button>
          
          {showShareMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 w-48 z-10">
              <button onClick={handleShare} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm">
                Share to feed
              </button>
              <button onClick={handleShare} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm">
                Copy link
              </button>
              <button onClick={handleShare} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm">
                Share via message
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${
            moment.isSaved
              ? 'bg-purple-50 text-purple-600'
              : 'hover:bg-gray-50 text-gray-600'
          }`}
        >
          <svg className={`w-5 h-5 ${moment.isSaved ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span className="text-sm font-medium">Save</span>
        </button>

        <button
          onClick={handleBeenHere}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${
            moment.hasBeenHere
              ? 'bg-teal-50 text-teal-600'
              : 'hover:bg-gray-50 text-gray-600'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium">I've been here</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="px-4 py-3 border-t border-gray-100 space-y-3">
          {moment.comments.map((comment: any) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex-shrink-0"></div>
              <div className="flex-1">
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="font-semibold text-sm text-gray-900">{comment.author}</p>
                  <p className="text-sm text-gray-700">{comment.text}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Add Comment */}
          <div className="flex gap-3 pt-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex-shrink-0"></div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Write a comment..."
                className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
