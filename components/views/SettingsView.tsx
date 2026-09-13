'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Toggle, Segmented, Avatar, Badge } from '@/components/ui/Primitives';
import { ConfirmModal } from '@/components/post/PostCard';
import { timeAgo } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/config';

type Section = 'account' | 'privacy' | 'notifications' | 'appearance' | 'security';

const SECTIONS: { id: Section; label: string; icon: string; desc: string }[] = [
  { id: 'account', label: 'Account', icon: 'user', desc: 'Name, username, email & account status' },
  { id: 'privacy', label: 'Privacy', icon: 'eye', desc: 'Who can see and reach you' },
  { id: 'notifications', label: 'Notifications', icon: 'bell', desc: 'What you get notified about' },
  { id: 'appearance', label: 'Appearance', icon: 'moon', desc: 'Theme, font size & motion' },
  { id: 'security', label: 'Security', icon: 'shield', desc: 'Password, 2FA & sessions' },
];

export default function SettingsView() {
  const [section, setSection] = useState<Section>('account');

  return (
    <div className="max-w-[820px] mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[var(--text)] mb-1">Settings</h1>
        <p className="text-sm text-[var(--muted)]">Manage your Ruhiz experience.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Section nav */}
        <div className="lg:w-[250px] flex-shrink-0">
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left whitespace-nowrap lg:whitespace-normal transition-all flex-shrink-0 ${
                  section === s.id ? 'bg-[var(--brand)] text-white shadow-sm' : 'bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--brand)]'
                }`}
              >
                <Icon name={s.icon} size={18} className={section === s.id ? '' : 'text-[var(--brand)]'} />
                <span>
                  <span className="block text-sm font-semibold">{s.label}</span>
                  <span className={`hidden lg:block text-xs ${section === s.id ? 'text-white/75' : 'text-[var(--muted)]'}`}>{s.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Section body */}
        <div className="flex-1 min-w-0 fade-in" key={section}>
          {section === 'account' && <AccountSection />}
          {section === 'privacy' && <PrivacySection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'security' && <SecuritySection />}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 mb-4">
      {title && <h3 className="font-bold text-[var(--text)] mb-4">{title}</h3>}
      {children}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-[var(--border)] last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
        {hint && <p className="text-xs text-[var(--muted)] mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 bg-[var(--card-2)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 placeholder:text-[var(--muted)]';

/* ------------------------------ Account ------------------------------ */

function AccountSection() {
  const store = useStore();
  const { me } = store;
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [email, setEmail] = useState(store.authEmail ?? 'sam@ruhiz.app');
  const [confirm, setConfirm] = useState<'deactivate' | 'delete' | null>(null);

  const save = () => {
    const uname = username.trim().toLowerCase();
    if (name.trim().length < 2) return store.toast('Display name is too short', 'error');
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) return store.toast('Invalid username format', 'error');
    store.updateProfile({ name: name.trim(), username: uname });
    store.toast('Account details saved');
  };

  return (
    <>
      <Card title="Account details">
        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} maxLength={40} />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">Username</span>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">@</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputCls} pl-8`} maxLength={20} />
            </div>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputCls} />
            <span className="block text-[11px] text-[var(--muted)] mt-1">
              {store.demoMode ? 'Demo mode — email changes are local only. Connect Supabase auth to verify emails.' : 'Managed by Supabase Auth.'}
            </span>
          </label>
          <button onClick={save} className="px-5 py-2.5 bg-[var(--brand)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--brand-dark)]">
            Save changes
          </button>
        </div>
      </Card>

      <Card title="Danger zone">
        <Row label="Reset demo data" hint="Restore sample posts, messages and settings">
          <button
            onClick={() => {
              store.resetDemo();
              store.toast('Demo data restored ✨');
            }}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--card-2)]"
          >
            Reset
          </button>
        </Row>
        <Row label="Deactivate account" hint="Temporarily hide your profile">
          <button onClick={() => setConfirm('deactivate')} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-amber-600 hover:bg-amber-500/10">
            Deactivate
          </button>
        </Row>
        <Row label="Delete account" hint="Permanently remove your Ruhiz presence">
          <button onClick={() => setConfirm('delete')} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
            Delete
          </button>
        </Row>
      </Card>

      {confirm === 'deactivate' && (
        <ConfirmModal
          title="Deactivate your account?"
          body="Your profile will be hidden until you log back in. Your moments stay safe."
          confirmLabel="Deactivate"
          onConfirm={() => store.toast('Account deactivated in demo — log in again to reactivate', 'info')}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && <DeleteAccountModal onClose={() => setConfirm(null)} />}
    </>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [typed, setTyped] = useState('');
  return (
    <ConfirmModal
      title="Delete your account?"
      body="This clears all local demo data, including posts, messages and settings. This cannot be undone."
      confirmLabel="Delete forever"
      danger
      confirmDisabled={typed.trim().toUpperCase() !== 'DELETE'}
      onConfirm={() => {
        store.resetDemo();
        store.toast('All demo data deleted', 'info');
      }}
      onClose={onClose}
    >
      <div className="mt-3">
        <p className="text-xs text-[var(--muted)] mb-1.5">Type <b>DELETE</b> to confirm:</p>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputCls} placeholder="DELETE" />
      </div>
    </ConfirmModal>
  );
}

/* ------------------------------ Privacy ------------------------------ */

function PrivacySection() {
  const store = useStore();
  const { settings } = store;

  return (
    <>
      <Card title="Visibility">
        <Row label="Profile visibility" hint="Who can view your full profile">
          <select
            value={settings.profileVisibility}
            onChange={(e) => {
              store.updateSettings({ profileVisibility: e.target.value as typeof settings.profileVisibility });
              store.toast('Visibility updated', 'info');
            }}
            className="px-3 py-2 bg-[var(--card-2)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
          >
            <option value="public">Everyone</option>
            <option value="connections">Connections only</option>
            <option value="private">Only me</option>
          </select>
        </Row>
        <Row label="Show activity status" hint="Let others see when you’re online">
          <Toggle
            checked={settings.showActivityStatus}
            onChange={(v) => {
              store.updateSettings({ showActivityStatus: v });
              store.toast(v ? 'Activity status on' : 'Activity status hidden', 'info');
            }}
            label="Show activity status"
          />
        </Row>
        <Row label="Show read receipts" hint="Let senders know you’ve seen messages">
          <Toggle checked={settings.showReadReceipts} onChange={(v) => store.updateSettings({ showReadReceipts: v })} label="Read receipts" />
        </Row>
      </Card>

      <Card title="Messages">
        <Row label="Who can message you" hint="Messages from others go to requests first">
          <select
            value={settings.allowMessagesFrom}
            onChange={(e) => {
              store.updateSettings({ allowMessagesFrom: e.target.value as typeof settings.allowMessagesFrom });
              store.toast('Message preferences saved', 'info');
            }}
            className="px-3 py-2 bg-[var(--card-2)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
          >
            <option value="everyone">Everyone</option>
            <option value="connections">Connections only</option>
            <option value="none">No one</option>
          </select>
        </Row>
      </Card>

      <Card title={`Blocked people (${settings.blocked.length})`}>
        {settings.blocked.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">You haven’t blocked anyone. Blocked people can’t see or message you.</p>
        ) : (
          <div className="space-y-3">
            {settings.blocked.map((id) => {
              const u = store.getUser(id);
              return (
                <div key={id} className="flex items-center gap-3">
                  <Avatar user={u} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)] truncate">{u.name}</p>
                    <p className="text-xs text-[var(--muted)]">@{u.username}</p>
                  </div>
                  <button
                    onClick={() => {
                      store.unblockUser(id);
                      store.toast(`${u.name} unblocked`);
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--card-2)]"
                  >
                    Unblock
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

/* --------------------------- Notifications --------------------------- */

function NotificationsSection() {
  const store = useStore();
  const { settings } = store;

  const toggles: { key: keyof typeof settings; label: string; hint: string }[] = [
    { key: 'notifLikes', label: 'Likes', hint: 'When someone likes your moment' },
    { key: 'notifComments', label: 'Comments', hint: 'When someone replies to you' },
    { key: 'notifFollows', label: 'New supporters', hint: 'When someone starts following you' },
    { key: 'notifMessages', label: 'Messages', hint: 'New direct messages' },
    { key: 'notifMentions', label: 'Mentions', hint: 'When someone mentions you' },
  ];

  return (
    <>
      <Card title="Push notifications">
        {toggles.map((t) => (
          <Row key={t.key} label={t.label} hint={t.hint}>
            <Toggle
              checked={settings[t.key] as boolean}
              onChange={(v) => {
                store.updateSettings({ [t.key]: v } as Partial<typeof settings>);
                store.toast(`${t.label} notifications ${v ? 'on' : 'off'}`, 'info');
              }}
              label={t.label}
            />
          </Row>
        ))}
      </Card>
      <Card title="Email digest">
        <Row label="Community digest" hint="A summary of the best moments from your people">
          <select
            value={settings.emailDigest}
            onChange={(e) => {
              store.updateSettings({ emailDigest: e.target.value as typeof settings.emailDigest });
              store.toast('Digest preference saved', 'info');
            }}
            className="px-3 py-2 bg-[var(--card-2)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
          >
            <option value="off">Off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </Row>
      </Card>
    </>
  );
}

/* ----------------------------- Appearance ---------------------------- */

function AppearanceSection() {
  const store = useStore();
  const { settings } = store;

  const themes: { value: typeof settings.theme; label: string; icon: string; desc: string }[] = [
    { value: 'light', label: 'Light', icon: 'sun', desc: 'Ruhiz classic green & white' },
    { value: 'dark', label: 'Dark', icon: 'moon', desc: 'Easy on late-night eyes' },
    { value: 'system', label: 'System', icon: 'settings', desc: 'Follow your device' },
  ];

  return (
    <>
      <Card title="Theme">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                store.updateSettings({ theme: t.value });
                store.toast(`Theme: ${t.label}`, 'info');
              }}
              className={`rounded-2xl border-2 p-4 text-left transition-all ${
                settings.theme === t.value ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--border)] hover:border-[var(--brand-mid)]'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon name={t.icon} size={18} className="text-[var(--brand)]" />
                <span className="font-semibold text-sm text-[var(--text)]">{t.label}</span>
                {settings.theme === t.value && <Icon name="check" size={16} className="text-[var(--brand)] ml-auto" />}
              </div>
              {/* mini preview */}
              <div className={`h-14 rounded-lg border ${t.value === 'dark' ? 'bg-[#151d19] border-[#263830]' : 'bg-[#f7f9f7] border-[#e3eae6]'}`}>
                <div className={`h-4 rounded-t-lg ${t.value === 'dark' ? 'bg-[#0f1b16]' : 'bg-[#145c43]'}`} />
                <div className="p-1.5 space-y-1">
                  <div className={`h-1.5 w-3/4 rounded ${t.value === 'dark' ? 'bg-[#263830]' : 'bg-[#dcede4]'}`} />
                  <div className={`h-1.5 w-1/2 rounded ${t.value === 'dark' ? 'bg-[#263830]' : 'bg-[#dcede4]'}`} />
                </div>
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-2">{t.desc}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Text size">
        <div className="flex items-center gap-4">
          <Segmented
            options={[
              { value: 'compact' as const, label: 'Compact' },
              { value: 'standard' as const, label: 'Standard' },
              { value: 'large' as const, label: 'Large' },
            ]}
            value={settings.fontSize}
            onChange={(v) => {
              store.updateSettings({ fontSize: v });
              store.toast(`Text size: ${v}`, 'info');
            }}
          />
          <span className="text-sm text-[var(--muted)]">Applies everywhere instantly</span>
        </div>
      </Card>

      <Card title="Motion">
        <Row label="Reduce motion" hint="Minimise animations and transitions">
          <Toggle checked={settings.reduceMotion} onChange={(v) => store.updateSettings({ reduceMotion: v })} label="Reduce motion" />
        </Row>
      </Card>
    </>
  );
}

/* ------------------------------ Security ------------------------------ */

function SecuritySection() {
  const store = useStore();
  const { settings, sessions } = store;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const changePassword = async () => {
    if (next.length < 8) return store.toast('New password must be at least 8 characters', 'error');
    if (next !== confirmPw) return store.toast('Passwords don’t match', 'error');
    setBusy(true);
    if (isSupabaseConfigured) {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password: next });
        if (error) {
          store.toast(error.message, 'error');
          setBusy(false);
          return;
        }
        store.toast('Password updated 🔐');
      } catch {
        store.toast('Could not update password', 'error');
      }
    } else {
      await new Promise((r) => setTimeout(r, 900));
      store.toast('Password updated (demo mode) 🔐');
    }
    setBusy(false);
    setCurrent('');
    setNext('');
    setConfirmPw('');
  };

  return (
    <>
      <Card title="Change password">
        <div className="space-y-3.5">
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" className={inputCls} autoComplete="current-password" />
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="New password (min 8 characters)"
              className={`${inputCls} pr-11`}
              autoComplete="new-password"
            />
            <button onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[var(--muted)] hover:text-[var(--text)]" aria-label="Toggle password visibility">
              <Icon name={showPw ? 'eyeOff' : 'eye'} size={17} />
            </button>
          </div>
          <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm new password" className={inputCls} autoComplete="new-password" />
          <button
            onClick={changePassword}
            disabled={busy || !current || !next || !confirmPw}
            className="px-5 py-2.5 bg-[var(--brand)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--brand-dark)] disabled:opacity-40"
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
          {!isSupabaseConfigured && <p className="text-[11px] text-[var(--muted)]">Demo mode — connect Supabase Auth to change your real password.</p>}
        </div>
      </Card>

      <Card title="Two-factor authentication">
        <Row label="2FA" hint="Require a code from your phone when logging in">
          <Toggle
            checked={settings.twoFactor}
            onChange={(v) => {
              store.updateSettings({ twoFactor: v });
              store.toast(v ? 'Two-factor authentication enabled 🛡️' : 'Two-factor authentication disabled', v ? 'success' : 'info');
            }}
            label="Two-factor authentication"
          />
        </Row>
        <Row label="Login alerts" hint="Get notified about new sign-ins">
          <Toggle checked={settings.loginAlerts} onChange={(v) => store.updateSettings({ loginAlerts: v })} label="Login alerts" />
        </Row>
      </Card>

      <Card title="Active sessions">
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center flex-shrink-0">
                <Icon name={s.device.toLowerCase().includes('ios') ? 'phone' : 'settings'} size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
                  {s.device}
                  {s.current && <Badge>Current</Badge>}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {s.location} · {s.current ? 'Active now' : `Active ${timeAgo(s.lastActive)} ago`}
                </p>
              </div>
              {!s.current && (
                <button
                  onClick={() => {
                    store.revokeSession(s.id);
                    store.toast('Session revoked', 'info');
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
          {sessions.filter((s) => !s.current).length === 0 && (
            <p className="text-xs text-[var(--muted)]">No other active sessions.</p>
          )}
        </div>
      </Card>
    </>
  );
}
