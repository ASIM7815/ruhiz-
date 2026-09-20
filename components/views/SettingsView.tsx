'use client';

import { useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { GhostButton, PrimaryButton, Segmented, Toggle } from '@/components/ui/Primitives';

export default function SettingsView() {
  const store = useStore();
  const { navigate } = useNav();
  const s = store.db.settings;
  const [confirmReset, setConfirmReset] = useState(false);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(store.db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'duel-data-export.json';
    a.click();
    URL.revokeObjectURL(url);
    store.toast('Data export downloaded.', 'info');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-[var(--text)]">Settings</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Appearance, notifications, privacy and security.</p>
      </div>

      <Card title="Appearance" icon="sun">
        <Row label="Theme" hint="Dark is the house style — light mode for daylight grinds.">
          <Segmented
            options={[{ value: 'dark' as const, label: 'Dark' }, { value: 'light' as const, label: 'Light' }, { value: 'system' as const, label: 'System' }]}
            value={s.theme}
            onChange={(v) => store.updateSettings({ theme: v })}
          />
        </Row>
        <Row label="Text size">
          <Segmented
            options={[{ value: 'compact' as const, label: 'Compact' }, { value: 'standard' as const, label: 'Standard' }, { value: 'large' as const, label: 'Large' }]}
            value={s.fontSize}
            onChange={(v) => store.updateSettings({ fontSize: v })}
          />
        </Row>
        <Row label="Reduce motion" hint="Disable animations and transitions.">
          <Toggle checked={s.reduceMotion} onChange={(v) => store.updateSettings({ reduceMotion: v })} label="Reduce motion" />
        </Row>
      </Card>

      <Card title="Notifications" icon="bell">
        <Row label="Likes" hint="Someone likes your challenge.">
          <Toggle checked={s.notifLikes} onChange={(v) => store.updateSettings({ notifLikes: v })} label="Like notifications" />
        </Row>
        <Row label="Comments" hint="Replies and comments on your challenges.">
          <Toggle checked={s.notifComments} onChange={(v) => store.updateSettings({ notifComments: v })} label="Comment notifications" />
        </Row>
        <Row label="New participants" hint="Someone joins a challenge you created.">
          <Toggle checked={s.notifJoins} onChange={(v) => store.updateSettings({ notifJoins: v })} label="Join notifications" />
        </Row>
        <Row label="Messages">
          <Toggle checked={s.notifMessages} onChange={(v) => store.updateSettings({ notifMessages: v })} label="Message notifications" />
        </Row>
        <Row label="Streak alerts" hint="Daily reminders and streak milestones.">
          <Toggle checked={s.notifStreaks} onChange={(v) => store.updateSettings({ notifStreaks: v })} label="Streak notifications" />
        </Row>
        <Row label="Email digest">
          <Segmented
            options={[{ value: 'off' as const, label: 'Off' }, { value: 'daily' as const, label: 'Daily' }, { value: 'weekly' as const, label: 'Weekly' }]}
            value={s.emailDigest}
            onChange={(v) => store.updateSettings({ emailDigest: v })}
          />
        </Row>
      </Card>

      <Card title="Privacy" icon="shield">
        <Row label="Profile visibility">
          <Segmented
            options={[{ value: 'public' as const, label: 'Public' }, { value: 'connections' as const, label: 'Connections' }, { value: 'private' as const, label: 'Private' }]}
            value={s.profileVisibility}
            onChange={(v) => store.updateSettings({ profileVisibility: v })}
          />
        </Row>
        <Row label="Allow messages from">
          <Segmented
            options={[{ value: 'everyone' as const, label: 'Everyone' }, { value: 'connections' as const, label: 'Connections' }, { value: 'none' as const, label: 'No one' }]}
            value={s.allowMessagesFrom}
            onChange={(v) => store.updateSettings({ allowMessagesFrom: v })}
          />
        </Row>
        <Row label="Show activity status" hint="Let others see when you are active.">
          <Toggle checked={s.showActivityStatus} onChange={(v) => store.updateSettings({ showActivityStatus: v })} label="Activity status" />
        </Row>
        <Row label="Read receipts">
          <Toggle checked={s.showReadReceipts} onChange={(v) => store.updateSettings({ showReadReceipts: v })} label="Read receipts" />
        </Row>
        <Row label="Blocked users" hint={s.blocked.length ? `${s.blocked.length} blocked` : 'Nobody blocked.'}>
          <div className="flex flex-wrap gap-2 justify-end max-w-[60%]">
            {s.blocked.length === 0 && <span className="text-xs text-[var(--muted)]">—</span>}
            {s.blocked.map((id) => (
              <button key={id} onClick={() => store.unblockUser(id)} className="px-2.5 py-1 rounded-full bg-[var(--danger-soft)] text-[var(--danger)] text-xs font-semibold hover:opacity-80">
                {store.getUser(id).username} ✕
              </button>
            ))}
          </div>
        </Row>
      </Card>

      <Card title="Security" icon="lock">
        <Row label="Two-factor authentication" hint="Add a verification step at sign-in.">
          <Toggle checked={s.twoFactor} onChange={(v) => store.updateSettings({ twoFactor: v })} label="Two-factor authentication" />
        </Row>
        <Row label="Login alerts" hint="Email me when a new device signs in.">
          <Toggle checked={s.loginAlerts} onChange={(v) => store.updateSettings({ loginAlerts: v })} label="Login alerts" />
        </Row>
        <Row label="Current session" hint="This device · signed in with DUEL">
          <span className="text-xs font-semibold text-[var(--brand)] flex items-center gap-1">
            <Icon name="check" size={13} /> Active
          </span>
        </Row>
      </Card>

      <Card title="Data & account" icon="settings">
        <Row label="Export my data" hint="Download everything DUEL stores about you.">
          <GhostButton onClick={exportData}>
            <Icon name="upload" size={15} className="rotate-180" /> Export JSON
          </GhostButton>
        </Row>
        {store.dataMode === 'demo' && (
          <Row label="Reset local data" hint="Clears this browser's DUEL database and restores the seed community.">
            {confirmReset ? (
              <div className="flex gap-2">
                <PrimaryButton
                  onClick={() => {
                    void store.resetLocal();
                    setConfirmReset(false);
                  }}
                  className="!bg-[var(--danger)] !text-white"
                >
                  Confirm reset
                </PrimaryButton>
                <GhostButton onClick={() => setConfirmReset(false)}>Cancel</GhostButton>
              </div>
            ) : (
              <GhostButton onClick={() => setConfirmReset(true)}>
                <Icon name="refresh" size={15} /> Reset
              </GhostButton>
            )}
          </Row>
        )}
        <Row label="Sign out" hint="Ends your session on this device.">
          <GhostButton onClick={() => void store.signOut().then(() => navigate('home'))}>
            <Icon name="logout" size={15} /> Log out
          </GhostButton>
        </Row>
      </Card>

      <p className="text-center text-[11px] text-[var(--muted)] pb-4">
        DUEL · Challenge A Better You · data mode: {store.dataMode}
      </p>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <h2 className="display text-sm text-[var(--text)] px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
        <Icon name={icon} size={16} className="text-[var(--brand)]" /> {title}
      </h2>
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
        {hint && <p className="text-xs text-[var(--muted)] mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
