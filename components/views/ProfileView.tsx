'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, Badge, FollowButton, Modal, ModalHeader, PrimaryButton, GhostButton, EmptyState } from '@/components/ui/Primitives';
import PostCard from '@/components/post/PostCard';
import ImageCropModal from '@/components/profile/ImageCropModal';
import { uploadMedia, blobToFile, fileToDataURL } from '@/lib/upload';
import { R2Image, R2Video, useMediaUrl } from '@/components/ui/Media';
import { fullDate, compactCount, initials } from '@/lib/format';
import { ME_ID } from '@/lib/data/sample';
import type { UserProfile } from '@/lib/types';

type ProfileTab = 'posts' | 'photos' | 'videos' | 'moments' | 'saved';

export default function ProfileView({ userId, onCreate }: { userId?: string; onCreate: () => void }) {
  const store = useStore();
  const { navigate } = useNav();
  const isOwn = !userId || userId === ME_ID;
  const user: UserProfile = isOwn ? store.me : store.getUser(userId);

  const [tab, setTab] = useState<ProfileTab>('posts');
  const [editOpen, setEditOpen] = useState(false);
  const [peopleModal, setPeopleModal] = useState<'supporters' | 'supporting' | null>(null);
  const [cropTarget, setCropTarget] = useState<'avatar' | 'cover' | null>(null);
  const [cropSrc, setCropSrc] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [, setProgress] = useState(0);
  const [lightbox, setLightbox] = useState<{ ref: string; kind: 'image' | 'video' } | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const userPosts = useMemo(
    () =>
      store.posts
        .filter((p) => p.userId === user.id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [store.posts, user.id]
  );
  const savedPosts = useMemo(() => store.posts.filter((p) => p.savedByMe), [store.posts]);
  const photos = userPosts.filter((p) => p.image);
  const videos = userPosts.filter((p) => p.video);
  const moments = userPosts.filter((p) => !p.image && !p.video);

  const supporters = store.followers.map((id) => store.getUser(id));
  const supporting = store.following.map((id) => store.getUser(id));

  /* --------------------- media upload + crop flow --------------------- */
  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>, target: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return store.toast('Please choose an image file', 'error');
    if (file.size > 10 * 1024 * 1024) return store.toast('Image must be under 10 MB', 'error');
    setCropSrc(await fileToDataURL(file));
    setCropTarget(target);
  };

  const onCropped = async (blob: Blob) => {
    if (!cropTarget) return;
    setUploadingImage(true);
    try {
      const file = await blobToFile(blob, `${cropTarget}-${Date.now()}.jpg`);
      const { key, storage } = await uploadMedia(file, cropTarget === 'avatar' ? 'avatar' : 'cover', setProgress);
      if (cropTarget === 'avatar') store.updateProfile({ avatar: key });
      else store.updateProfile({ cover: key });
      store.toast(storage === 'r2' ? `${cropTarget === 'avatar' ? 'Profile photo' : 'Cover'} updated ✨` : 'Updated! (demo storage)', 'success');
    } catch {
      store.toast('Could not update image', 'error');
    } finally {
      setUploadingImage(false);
      setCropTarget(null);
    }
  };

  const shareProfile = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/feed#profile-${user.username}`);
      store.toast('Profile link copied 🔗');
    } catch {
      store.toast('Could not copy link', 'error');
    }
  };

  const tabs: { id: ProfileTab; label: string; count: number }[] = [
    { id: 'posts', label: 'Posts', count: userPosts.length },
    { id: 'photos', label: 'Photos', count: photos.length },
    { id: 'videos', label: 'Videos', count: videos.length },
    { id: 'moments', label: 'Moments', count: moments.length },
    ...(isOwn ? [{ id: 'saved' as ProfileTab, label: 'Saved', count: savedPosts.length }] : []),
  ];

  const resolvedCover = useMediaUrl(user.cover);
  const coverStyle: React.CSSProperties = resolvedCover
    ? { backgroundImage: `url(${resolvedCover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(120deg, hsl(${user.avatarHue}, 38%, 32%), hsl(${(user.avatarHue + 60) % 360}, 40%, 22%))` };

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl overflow-hidden mb-5">
        {/* Cover */}
        <div className="relative h-40 sm:h-52">
          <div className="absolute inset-0" style={coverStyle} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          {isOwn && (
            <>
              <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => onFilePicked(e, 'cover')} />
              <button
                onClick={() => coverInput.current?.click()}
                className="absolute bottom-3 right-3 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/55 text-white text-xs font-semibold hover:bg-black/75 transition-colors backdrop-blur-sm"
              >
                <Icon name="camera" size={15} />
                {uploadingImage ? 'Uploading…' : 'Edit cover'}
              </button>
            </>
          )}
        </div>

        {/* Avatar + header info */}
        <div className="px-5 sm:px-7 pb-6">
          <div className="flex items-end justify-between -mt-12 sm:-mt-14 mb-4">
            <div className="relative">
              <div className="ring-4 ring-[var(--card)] rounded-full">
                <Avatar user={user} size={104} />
              </div>
              {isOwn && (
                <>
                  <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(e) => onFilePicked(e, 'avatar')} />
                  <button
                    onClick={() => avatarInput.current?.click()}
                    className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-[var(--brand)] text-white flex items-center justify-center ring-4 ring-[var(--card)] hover:bg-[var(--brand-dark)] transition-colors"
                    aria-label="Change profile photo"
                  >
                    <Icon name="camera" size={16} />
                  </button>
                </>
              )}
            </div>

            <div className="flex gap-2 pb-1">
              {isOwn ? (
                <>
                  <GhostButton onClick={shareProfile}>
                    <Icon name="share" size={15} /> Share
                  </GhostButton>
                  <PrimaryButton onClick={() => setEditOpen(true)}>
                    <Icon name="pen" size={15} /> Edit profile
                  </PrimaryButton>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      void store.openThreadWith(user.id).then((threadId) => navigate('messages', threadId));
                    }}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--card-2)] transition-colors"
                  >
                    Message
                  </button>
                  <FollowButton
                    following={store.isFollowing(user.id)}
                    onToggle={() => {
                      store.toggleFollow(user.id);
                      store.toast(store.isFollowing(user.id) ? `Stopped supporting ${user.name}` : `You're now supporting ${user.name} 💚`);
                    }}
                  />
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--text)]">{user.name}</h1>
            {user.verified && <Icon name="badge" size={20} className="text-[var(--brand)]" />}
            {isOwn && <Badge>Demo account</Badge>}
          </div>
          <p className="text-sm text-[var(--muted)]">@{user.username}</p>
          {user.bio && <p className="text-sm text-[var(--text)] mt-3 leading-relaxed max-w-lg whitespace-pre-wrap">{user.bio}</p>}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-sm text-[var(--muted)]">
            {user.location && (
              <span className="flex items-center gap-1.5"><Icon name="location" size={14} /> {user.location}</span>
            )}
            {user.website && (
              <span className="flex items-center gap-1.5"><Icon name="link" size={14} /> {user.website}</span>
            )}
            <span className="flex items-center gap-1.5"><Icon name="calendar" size={14} /> Joined {fullDate(user.joined)}</span>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-4 pt-4 border-t border-[var(--border)]">
            <Stat label="Moments" value={userPosts.length} />
            <button onClick={() => setPeopleModal('supporters')} className="text-left group">
              <Stat label="Supporters" value={supporters.length} hover />
            </button>
            <button onClick={() => setPeopleModal('supporting')} className="text-left group">
              <Stat label="Supporting" value={supporting.length} hover />
            </button>
          </div>
        </div>
      </div>

      {/* Quick links (handy on mobile where sidebar is hidden) */}
      {isOwn && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { id: 'journey', label: 'My Journey', icon: 'journey' },
            { id: 'connections', label: 'Connections', icon: 'people' },
            { id: 'saved', label: 'Saved', icon: 'bookmark' },
            { id: 'settings', label: 'Settings', icon: 'settings' },
          ].map((q) => (
            <button
              key={q.id}
              onClick={() => navigate(q.id as 'journey' | 'connections' | 'saved' | 'settings')}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl px-4 py-3.5 flex items-center gap-2.5 text-left hover:border-[var(--brand)] transition-colors"
            >
              <span className="w-8 h-8 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center flex-shrink-0">
                <Icon name={q.icon} size={16} />
              </span>
              <span className="text-sm font-semibold text-[var(--text)]">{q.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-5 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap px-3 ${
              tab === t.id ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--card-2)]'
            }`}
          >
            {t.label} <span className="opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'posts' &&
        (userPosts.length === 0 ? (
          <EmptyState
            icon="pen"
            title={isOwn ? 'You haven’t shared anything yet' : `${user.name.split(' ')[0]} hasn’t shared anything yet`}
            description={isOwn ? 'Your photos, videos and moments will appear here.' : 'Support them to hear about it first when they do.'}
            action={
              isOwn ? (
                <PrimaryButton onClick={onCreate}><Icon name="plus" size={16} /> Create your first post</PrimaryButton>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-5">
            {userPosts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        ))}

      {tab === 'moments' &&
        (moments.length === 0 ? (
          <EmptyState icon="pen" title="No written moments" description="Text-only moments will show up here." />
        ) : (
          <div className="space-y-5">
            {moments.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        ))}

      {tab === 'saved' && isOwn &&
        (savedPosts.length === 0 ? (
          <EmptyState icon="bookmark" title="Nothing saved yet" description="Bookmark moments you love and find them here." />
        ) : (
          <div className="space-y-5">
            {savedPosts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        ))}

      {(tab === 'photos' || tab === 'videos') && (
        <MediaGrid
          posts={tab === 'photos' ? photos : videos}
          kind={tab}
          onOpen={(ref, kind) => setLightbox({ ref, kind })}
          onCreate={onCreate}
          isOwn={isOwn}
        />
      )}

      {/* Modals */}
      {editOpen && isOwn && <EditProfileModal onClose={() => setEditOpen(false)} />}
      {peopleModal && <PeopleModal kind={peopleModal} onClose={() => setPeopleModal(null)} />}
      <ImageCropModal
        isOpen={!!cropTarget}
        onClose={() => setCropTarget(null)}
        imageSrc={cropSrc}
        onSave={onCropped}
        cropShape={cropTarget === 'avatar' ? 'round' : 'rect'}
        aspect={cropTarget === 'cover' ? 16 / 5.2 : 1}
        title={cropTarget === 'avatar' ? 'Crop profile photo' : 'Crop cover photo'}
      />

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {lightbox.kind === 'video' ? (
            <div className="max-w-4xl w-full pop-in" onClick={(e) => e.stopPropagation()}>
              <R2Video mediaKey={lightbox.ref} className="w-full max-h-[90vh] rounded-lg bg-black" />
            </div>
          ) : (
            <div className="pop-in" onClick={(e) => e.stopPropagation()}>
              <R2Image mediaKey={lightbox.ref} alt="" className="max-w-full max-h-[90vh] rounded-lg object-contain" />
            </div>
          )}
        </div>
      )}
      <span className="sr-only">{initials(user.name)}</span>
    </div>
  );
}

function Stat({ label, value, hover = false }: { label: string; value: number; hover?: boolean }) {
  return (
    <span>
      <span className={`block text-lg font-bold leading-none ${hover ? 'group-hover:text-[var(--brand)]' : ''} text-[var(--text)]`}>{compactCount(value)}</span>
      <span className="text-xs text-[var(--muted)]">{label}</span>
    </span>
  );
}

function MediaGrid({
  posts,
  kind,
  onOpen,
  onCreate,
  isOwn,
}: {
  posts: import('@/lib/types').Post[];
  kind: 'photos' | 'videos';
  /** Hands the stored media reference (URL *or* private R2 key) to the lightbox. */
  onOpen: (ref: string, kind: 'image' | 'video') => void;
  onCreate: () => void;
  isOwn: boolean;
}) {
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={kind === 'photos' ? 'image' : 'video'}
        title={`No ${kind} yet`}
        description={isOwn ? `Share your first ${kind === 'photos' ? 'photo' : 'video'} and it will appear in this gallery.` : 'Check back later.'}
        action={
          isOwn ? (
            <PrimaryButton onClick={onCreate}>
              <Icon name="plus" size={16} /> Share {kind === 'photos' ? 'a photo' : 'a video'}
            </PrimaryButton>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {posts.map((p) =>
        p.image ? (
          <button
            key={p.id}
            onClick={() => onOpen(p.image!, 'image')}
            className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border)] group"
          >
            <R2Image mediaKey={p.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          </button>
        ) : (
          <button
            key={p.id}
            onClick={() => p.video && onOpen(p.video, 'video')}
            className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border)] bg-black group"
            aria-label="Play video"
          >
            <R2Video
              mediaKey={p.video}
              className="w-full h-full object-cover pointer-events-none"
              controls={false}
              muted
            />
            <span className="absolute inset-0 flex items-center justify-center text-white/90 group-hover:scale-110 transition-transform">
              <Icon name="play" size={38} />
            </span>
          </button>
        )
      )}
    </div>
  );
}

/* ---------------------------- Edit profile ---------------------------- */

function EditProfileModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const { me, users } = store;
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio);
  const [location, setLocation] = useState(me.location);
  const [website, setWebsite] = useState(me.website);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError('');
    const uname = username.trim().toLowerCase();
    if (name.trim().length < 2) return setError('Display name needs at least 2 characters.');
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) return setError('Username must be 3–20 characters: letters, numbers, underscores.');
    const taken = Object.values(users).some((u) => u.id !== me.id && u.username.toLowerCase() === uname);
    if (taken) return setError(`@${uname} is already taken.`);
    setSaving(true);
    store.updateProfile({ name: name.trim(), username: uname, bio: bio.trim(), location: location.trim(), website: website.trim() });
    // Supabase profile sync when configured
    try {
      const { isSupabaseConfigured } = await import('@/lib/config');
      if (isSupabaseConfigured) {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').upsert({
            user_id: user.id,
            username: uname,
            display_name: name.trim(),
            bio: bio.trim(),
            avatar_url: me.avatar,
          }, { onConflict: 'user_id' });
        }
      }
    } catch {
      /* best-effort */
    }
    setSaving(false);
    store.toast('Profile saved ✨');
    onClose();
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader title="Edit profile" subtitle="Tell the community who you are" onClose={onClose} />
      <div className="p-6 space-y-4">
        <Field label="Display name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} maxLength={40} />
        </Field>
        <Field label="Username">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">@</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputCls} pl-8`} maxLength={20} />
          </div>
        </Field>
        <Field label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={160} className={`${inputCls} resize-none`} placeholder="A sentence or two about you…" />
          <p className="text-right text-[11px] text-[var(--muted)] mt-1">{bio.length}/160</p>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Location">
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} maxLength={40} />
          </Field>
          <Field label="Website">
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} maxLength={60} />
          </Field>
        </div>
        {error && <p className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-4 py-2.5">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

const inputCls =
  'w-full px-4 py-2.5 bg-[var(--card-2)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 placeholder:text-[var(--muted)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">{label}</span>
      {children}
    </label>
  );
}

/* ---------------------------- People modal ---------------------------- */

function PeopleModal({ kind, onClose }: { kind: 'supporters' | 'supporting'; onClose: () => void }) {
  const store = useStore();
  const { navigate } = useNav();
  const ids = kind === 'supporters' ? store.followers : store.following;
  const people = ids.map((id) => store.getUser(id));

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md">
      <ModalHeader
        title={kind === 'supporters' ? `Supporters (${people.length})` : `Supporting (${people.length})`}
        subtitle={kind === 'supporters' ? 'People who follow your journey' : 'People you follow'}
        onClose={onClose}
      />
      <div className="p-3 max-h-96 overflow-y-auto">
        {people.length === 0 && (
          <p className="text-sm text-[var(--muted)] text-center py-8">
            {kind === 'supporters' ? 'No supporters yet — keep sharing!' : 'You aren’t supporting anyone yet.'}
          </p>
        )}
        {people.map((u) => (
          <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--card-2)] transition-colors">
            <Avatar user={u} size={44} onClick={() => { onClose(); navigate('profile', u.id); }} />
            <div className="flex-1 min-w-0">
              <button onClick={() => { onClose(); navigate('profile', u.id); }} className="flex items-center gap-1 font-semibold text-sm text-[var(--text)] hover:underline">
                <span className="truncate">{u.name}</span>
                {u.verified && <Icon name="badge" size={13} className="text-[var(--brand)]" />}
              </button>
              <p className="text-xs text-[var(--muted)] truncate">@{u.username}</p>
            </div>
            <FollowButton
              small
              following={store.isFollowing(u.id)}
              onToggle={() => {
                store.toggleFollow(u.id);
                store.toast(store.isFollowing(u.id) ? `Stopped supporting ${u.name}` : `You're now supporting ${u.name} 💚`);
              }}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
