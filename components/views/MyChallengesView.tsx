'use client';

import { useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { EmptyState, PrimaryButton, Segmented } from '@/components/ui/Primitives';
import ChallengeCard from '@/components/challenge/ChallengeCard';

type Tab = 'active' | 'completed' | 'created' | 'saved';

export default function MyChallengesView() {
  const store = useStore();
  const { navigate } = useNav();
  const [tab, setTab] = useState<Tab>('active');

  const lists: Record<Tab, ReturnType<typeof store.getView>[]> = {
    active: store.db.participants
      .filter((p) => p.status === 'active')
      .map((p) => store.db.challenges.find((c) => c.id === p.challengeId))
      .filter(Boolean)
      .map((c) => store.getView(c!)),
    completed: store.db.participants
      .filter((p) => p.status === 'completed')
      .map((p) => store.db.challenges.find((c) => c.id === p.challengeId))
      .filter(Boolean)
      .map((c) => store.getView(c!)),
    created: store.createdViews,
    saved: store.savedViews,
  };

  const current = lists[tab];

  const emptyCopy: Record<Tab, { title: string; desc: string }> = {
    active: { title: 'No active duels', desc: 'Join a challenge and your daily grind shows up here.' },
    completed: { title: 'No completions yet', desc: 'Finish every day of a challenge to earn its trophy.' },
    created: { title: 'You have not created a challenge', desc: 'Build the duel you wish existed and invite the community.' },
    saved: { title: 'Nothing saved', desc: 'Tap the bookmark on any challenge to keep it for later.' },
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-[var(--text)]">My Challenges</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Everything you are fighting, finished, built or keeping.</p>
        </div>
        <PrimaryButton onClick={() => navigate('create')}>+ New challenge</PrimaryButton>
      </div>

      <Segmented
        options={[
          { value: 'active' as Tab, label: `Active (${lists.active.length})` },
          { value: 'completed' as Tab, label: `Completed (${lists.completed.length})` },
          { value: 'created' as Tab, label: `Created (${lists.created.length})` },
          { value: 'saved' as Tab, label: `Saved (${lists.saved.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {current.length === 0 ? (
        <EmptyState
          icon={tab === 'saved' ? 'bookmark' : tab === 'completed' ? 'trophy' : tab === 'created' ? 'plus' : 'swords'}
          title={emptyCopy[tab].title}
          description={emptyCopy[tab].desc}
          action={
            tab === 'active' || tab === 'created' ? (
              <PrimaryButton onClick={() => navigate(tab === 'created' ? 'create' : 'explore')}>
                {tab === 'created' ? 'Create challenge' : 'Browse challenges'}
              </PrimaryButton>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {current.map((v) => (
            <ChallengeCard key={v.id} view={v} />
          ))}
        </div>
      )}
    </div>
  );
}
