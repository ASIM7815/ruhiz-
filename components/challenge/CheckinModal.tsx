'use client';

import { useState } from 'react';
import type { ChallengeView } from '@/lib/duel/types';
import { useStore } from '@/lib/duel/store';
import { Icon } from '@/components/ui/Icons';
import { Modal, ModalHeader, PrimaryButton, Spinner } from '@/components/ui/Primitives';

export default function CheckinModal({ view, open, onClose }: { view: ChallengeView; open: boolean; onClose: () => void }) {
  const { checkin } = useStore();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const part = view.participation;
  const nextDay = (part?.completedDays ?? 0) + 1;

  const submit = async () => {
    setBusy(true);
    const ck = await checkin(view.id, note);
    setBusy(false);
    if (ck) {
      setNote('');
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="checkin-title" maxWidth="max-w-md">
      <ModalHeader title="Daily check-in" onClose={onClose} subtitle={view.title} />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-4">
          <span className="w-12 h-12 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center display text-lg">
            {nextDay}
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Day {nextDay} of {view.durationDays}</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">{view.dailyTask || 'Log today’s win to keep your streak alive.'}</p>
          </div>
        </div>

        <div>
          <label htmlFor="checkin-note" className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
            Today’s note (optional)
          </label>
          <textarea
            id="checkin-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="What did you get done today?"
            className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60 resize-none"
          />
          <p className="text-[11px] text-[var(--muted)] text-right">{note.length}/500</p>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <Icon name="flame" size={14} className="text-[var(--brand)]" />
          Checking in today extends your streak to {(part?.currentStreak ?? 0) + 1} days.
        </div>

        <PrimaryButton onClick={submit} disabled={busy} className="w-full">
          {busy ? <Spinner size={16} /> : <Icon name="check" size={16} strokeWidth={3} />}
          {busy ? 'Logging…' : 'Log check-in'}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
