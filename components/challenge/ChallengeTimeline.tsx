'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Primitives';
import { Media } from '@/components/ui/Media';
import type { ChallengePostView } from '@/lib/duel/types';
import { formatTimeAgo } from '@/lib/format';

interface ChallengeTimelineProps {
  challengeId: string;
  durationDays: number;
  isParticipant: boolean;
  userId?: string;
  onCreatePost?: (dayNumber: number) => void;
}

export default function ChallengeTimeline({
  challengeId,
  durationDays,
  isParticipant,
  userId,
  onCreatePost,
}: ChallengeTimelineProps) {
  const [posts, setPosts] = useState<ChallengePostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPosts();
  }, [challengeId]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/challenge-posts?challengeId=${challengeId}`);
      if (!res.ok) throw new Error('Failed to load posts');
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  // Create day slots (1 to durationDays)
  const daySlots = Array.from({ length: durationDays }, (_, i) => i + 1);

  // Map posts by day number
  const postsByDay = new Map<number, ChallengePostView[]>();
  posts.forEach((post) => {
    const existing = postsByDay.get(post.dayNumber) || [];
    postsByDay.set(post.dayNumber, [...existing, post]);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadPosts}
          className="mt-4 px-4 py-2 bg-[var(--brand)] text-white rounded-lg hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Challenge Timeline</h3>

      {/* Timeline */}
      <div className="space-y-4">
        {daySlots.map((dayNum) => {
          const dayPosts = postsByDay.get(dayNum) || [];
          const hasPost = dayPosts.length > 0;
          const myPost = userId
            ? dayPosts.find((p) => p.userId === userId)
            : null;
          const canPost = isParticipant && !myPost;

          return (
            <div
              key={dayNum}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden"
            >
              {/* Day Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--hover)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--brand)] text-white flex items-center justify-center font-bold">
                    {dayNum}
                  </div>
                  <div>
                    <p className="font-semibold">Day {dayNum}</p>
                    {!hasPost && (
                      <p className="text-xs text-[var(--muted)]">No entries yet</p>
                    )}
                  </div>
                </div>

                {canPost && onCreatePost && (
                  <button
                    onClick={() => onCreatePost(dayNum)}
                    className="px-4 py-2 bg-[var(--brand)] text-white text-sm font-semibold rounded-lg hover:opacity-90 flex items-center gap-2"
                  >
                    <Icon name="plus" size={16} />
                    Post Day {dayNum}
                  </button>
                )}
              </div>

              {/* Posts */}
              {hasPost ? (
                <div className="divide-y divide-[var(--border)]">
                  {dayPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-[var(--muted)]">
                  <Icon name="calendar" size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {isParticipant
                      ? 'No entry for this day yet'
                      : 'Waiting for entries...'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: ChallengePostView }) {
  return (
    <div className="p-5">
      {/* Author */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
          style={{ backgroundColor: `hsl(${((post.username?.charCodeAt(0) || 0) * 137) % 360}, 70%, 50%)` }}
        >
          {post.displayName?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{post.displayName}</p>
          <p className="text-xs text-[var(--muted)]">
            @{post.username} · {formatTimeAgo(post.createdAt)}
          </p>
        </div>
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="mb-3 whitespace-pre-wrap">{post.caption}</p>
      )}

      {/* Media Grid */}
      {post.media && post.media.length > 0 && (
        <div
          className={`grid gap-2 mb-3 ${
            post.media.length === 1
              ? 'grid-cols-1'
              : post.media.length === 2
              ? 'grid-cols-2'
              : 'grid-cols-2'
          }`}
        >
          {post.media.slice(0, 4).map((item, i) => (
            <div
              key={item.id}
              className={`relative rounded-xl overflow-hidden bg-[var(--hover)] ${
                post.media.length === 3 && i === 0 ? 'col-span-2' : ''
              }`}
              style={{ aspectRatio: '1' }}
            >
              <Media
                type={item.mediaType}
                url={item.url}
                thumbnailUrl={item.thumbnailUrl}
                className="w-full h-full object-cover"
              />
              {post.media.length > 4 && i === 3 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xl font-bold">
                  +{post.media.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 text-[var(--muted)]">
        <button className="flex items-center gap-2 hover:text-red-400 transition-colors">
          <Icon name="heart" size={18} />
          <span className="text-sm">{post.likeCount || 0}</span>
        </button>
        <button className="flex items-center gap-2 hover:text-[var(--brand)] transition-colors">
          <Icon name="messageCircle" size={18} />
          <span className="text-sm">{post.commentCount || 0}</span>
        </button>
      </div>
    </div>
  );
}
