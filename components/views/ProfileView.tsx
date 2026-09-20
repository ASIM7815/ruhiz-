'use client';

import { useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, Badge, Cover, EmptyState, GhostButton, Modal, ModalHeader, PrimaryButton, Spinner } from '@/components/ui/Primitives';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import { fullDate } from '@/lib/format';
import { uploadMedia, validateUpload } from '@/lib/upload';

export default function ProfileView({ userId }: { userId?: string }) {
  const store = useStore();
  const { navigate } = useNav();
  const [editOpen, setEditOpen] = useState(false);

  const isMe = !userId || userId === store.db.meId;
  const profile = isMe ? store.me : store.getUser(userId!);

  const stats = useMemo(() => {
    const parts = store.db.participants.filter((p) => p.userId === (isMe ? store.db.meId : userId));
    return {
      active: parts.filter((p) => p.status === 'active').length,
      completed: parts.filter((p) => p.status === 'completed').length,
      bestStreak: parts.reduce((m, p) => Math.max(m, p.longestStreak), 0),
      created: store.db.challenges.filter((c) => c.creatorId === (isMe ? store.db.meId : userId)).length,
    };
  }, [store.db.participants, store.db.challenges, isMe, userId, store.db.meId]);

  const created = useMemo(
    () => store.db.challenges.filter((c) => c.creatorId === (isMe ? store.db.meId : userId)).map((c) => store.getView(c)),
    [store.db.challenges, isMe, userId, store, store.db.meId]
  );
  const joined = useMemo(
    () =>
      store.db.participants
        .filter((p) => p.userId === (isMe ? store.db.meId : userId))
        .map((p) => store.db.challenges.find((c) => c.id === p.challengeId))
        .filter(Boolean)
        .map((c) => store.getView(c!)),
    [store.db.participants, store.db.challenges, isMe, userId, store, store.db.meId]
  );

  if (!profile) return <EmptyState icon="user" title="Profile not found" />;

  const message = async () => {
    const id = await store.openThreadWith(profile.id);
    if (id) navigate('messages', id);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl overflow-hidden">
        <div className="h-36 sm:h-44 relative">
          {profile.cover ? (
            <Cover coverUrl={profile.cover} title={profile.name} />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(120deg, #0c1114 0%, hsl(${profile.avatarHue},40%,16%) 60%, #0c1114 100%)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
        <div className="px-5 sm:px-7 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            <div className="rounded-full border-4 border-[var(--card)] w-fit">
              <Avatar user={profile} size={88} />
            </div>
            <div className="flex-1 min-w-0 sm:pb-1">
              <h1 className="display text-xl sm:text-2xl text-[var(--text)] flex items-center gap-2">
                {profile.name}
                {profile.verified && <Icon name="badge" size={18} className="text-[var(--brand)]" />}
              </h1>
              <p className="text-sm text-[var(--muted)]">@{profile.username}</p>
            </div>
            <div className="flex gap-2 sm:pb-1">
              {isMe ? (
                <PrimaryButton onClick={() => setEditOpen(true)}>
                  <Icon name="edit" size={15} /> Edit profile
                </PrimaryButton>
              ) : (
                <>
                  <PrimaryButton onClick={() => void message()}>
                    <Icon name="chat" size={15} /> Message
                  </PrimaryButton>
                  <GhostButton onClick={() => store.blockUser(profile.id)}>
                    <Icon name="shield" size={15} /> Block
                  </GhostButton>
                </>
              )}
            </div>
          </div>

          {profile.bio && <p className="text-sm text-[var(--text)] mt-4 max-w-2xl leading-relaxed">{profile.bio}</p>}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-xs text-[var(--muted)]">
            {profile.location && (
              <span className="flex items-center gap-1"><Icon name="location" size={13} /> {profile.location}</span>
            )}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[var(--brand)] hover:underline">
                <Icon name="link" size={13} /> {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <span className="flex items-center gap-1"><Icon name="calendar" size={13} /> Joined {fullDate(profile.joined)}</span>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-5 max-w-md">
            <MiniStat value={stats.active} label="Active" />
            <MiniStat value={stats.completed} label="Won" />
            <MiniStat value={stats.bestStreak} label="Best streak" />
            <MiniStat value={stats.created} label="Created" />
          </div>
        </div>
      </div>

      {/* Created */}
      <section>
        <h2 className="display text-lg text-[var(--text)] mb-3 flex items-center gap-2">
          <Icon name="swords" size={17} className="text-[var(--brand)]" /> Created challenges
        </h2>
        {created.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{isMe ? 'You have not created a challenge yet.' : 'No challenges created yet.'}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {created.map((v) => (
              <ChallengeCard key={v.id} view={v} />
            ))}
          </div>
        )}
      </section>

      {/* Joined */}
      <section>
        <h2 className="display text-lg text-[var(--text)] mb-3 flex items-center gap-2">
          <Icon name="flame" size={17} className="text-[var(--brand)]" /> {isMe ? 'My duels' : 'Duels'}
          <Badge>{joined.length}</Badge>
        </h2>
        {joined.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No joined challenges yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {joined.map((v) => (
              <ChallengeCard key={v.id} view={v} />
            ))}
          </div>
        )}
      </section>

      {isMe && <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />}
    </div>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-xl py-2.5 text-center">
      <p className="display text-lg text-[var(--text)]">{value}</p>
      <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider">{label}</p>
    </div>
  );
}

/* ------------------------------ edit modal ------------------------------ */

function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const me = store.me!;
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio);
  const [location, setLocation] = useState(me.location);
  const [website, setWebsite] = useState(me.website);
  const [avatar, setAvatar] = useState<string | null>(me.avatar);
  const [cover, setCover] = useState<string | null>(me.cover);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined, kind: 'avatar' | 'cover') => {
    if (!file) return;
    const err = validateUpload(file, kind);
    if (err) return setError(err);
    setError(null);
    try {
      const res = await uploadMedia(file, kind);
      if (kind === 'avatar') setAvatar(res.key);
      else setCover(res.key);
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed.');
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const ok = await store.updateProfile({ name: name.trim() || username, username, bio: bio.trim(), location: location.trim(), website: website.trim(), avatar, cover });
    setBusy(false);
    if (ok) onClose();
    else setError('Could not save — username may be taken or too short.');
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="edit-profile" maxWidth="max-w-lg">
      <ModalHeader title="Edit profile" onClose={onClose} subtitle="How the community sees you" />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Avatar user={{ ...me, avatar, name }} size={72} />
          <div className="flex gap-2">
            <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0], 'avatar')} />
            <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0], 'cover')} />
            <GhostButton onClick={() => avatarRef.current?.click()}>
              <Icon name="camera" size={15} /> Avatar
            </GhostButton>
            <GhostButton onClick={() => coverRef.current?.click()}>
              <Icon name="image" size={15} /> Cover
            </GhostButton>
          </div>
        </div>

        <Field label="Display name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={cls} />
        </Field>
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} maxLength={20} className={cls} />
        </Field>
        <Field label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={160} className={cls + ' resize-none'} placeholder="What are you training for?" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={40} className={cls} />
          </Field>
          <Field label="Website">
            <input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={80} placeholder="https://" className={cls} />
          </Field>
        </div>

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <PrimaryButton onClick={() => void save()} disabled={busy} className="w-full">
          {busy ? <Spinner size={15} /> : <Icon name="check" size={15} />} Save changes
        </PrimaryButton>
      </div>
    </Modal>
  );
}

const cls =
  'w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
