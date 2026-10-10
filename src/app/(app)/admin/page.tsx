"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { BadgeCheck, ExternalLink, Flag, HardDrive, Loader2, ScrollText, Search, ShieldAlert, Trash, Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { useStore } from "@/store/store";
import { EmptyState, Tabs } from "@/components/ui/Primitives";

type Tab = "reports" | "users" | "credentials" | "audit";
type Report = { id: string; reason: string; details: string | null; status: string; createdAt: number; reporter: string; openCount: number; target: { kind: string; id: string; excerpt: string | null; author: string; href: string } };
type AdminUser = { code: string; headline: string; email: string; joinedAt: number; lastSeenAt: number; posts: number; contributions: number; openReports: number; isAdmin: boolean };
type Cred = { code: string; credentialType: string; issuingBody: string; registrationNumber: string; status: string; reviewNote: string | null; submittedAt: number };
type Audit = { entries: { id: string; admin: string; action: string; targetType: string; targetId: string; details: Record<string, unknown>; at: number }[]; storage: { configured: boolean; pendingDeletes: number } };

function Reports() {
  const { actions } = useStore();
  const [status, setStatus] = useState<"open" | "closed">("open");
  const { data, isLoading, error, mutate } = useSWR<Report[]>(`/api/admin/reports?status=${status}`);
  const act = (r: Report, action: "dismiss" | "resolve" | "remove_content" | "delete_account") => {
    const labels = { dismiss: "Dismiss report", resolve: "Mark resolved", remove_content: "Remove content", delete_account: "Delete account" };
    actions.openModal({
      type: "confirm",
      title: `${labels[action]}?`,
      text:
        action === "remove_content"
          ? `Permanently remove this ${r.target.kind} by #${r.target.author}. All open reports about it will be closed.`
          : action === "delete_account"
            ? `Permanently delete #${r.target.author}'s account and everything it created.`
            : "This closes the report. The content stays up.",
      confirmLabel: labels[action],
      danger: action === "remove_content" || action === "delete_account",
      requireReason: action === "delete_account",
      onConfirm: async (note) => {
        await api(`/api/admin/reports/${r.id}`, { method: "PATCH", body: { action, note: note || undefined } });
        actions.toast("Done", "info");
        mutate();
      },
    });
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["open", "closed"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} data-on={status === s} className="chip capitalize">
            {s}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : error ? (
        <p className="text-rose-300">{error.message}</p>
      ) : !data?.length ? (
        <EmptyState icon={Flag} title={status === "open" ? "No open reports" : "No closed reports"} text="Reports from members appear here." />
      ) : (
        data.map((r) => (
          <article key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge border-rose-400/30 bg-rose-500/10 capitalize text-rose-200">{r.reason.replace("-", " ")}</span>
              <span className="badge border-line bg-white/5 capitalize text-ink-2">{r.target.kind}</span>
              {r.openCount > 1 && <span className="badge border-amber-400/30 bg-amber-500/10 text-amber-200">{r.openCount} open reports</span>}
              <span className="ml-auto text-[0.76rem] text-faint">
                by <span className="code-font">#{r.reporter}</span> · {timeAgo(r.createdAt)}
              </span>
            </div>
            <p className="mt-2 text-[0.86rem] text-ink-2">
              <span className="code-font text-muted">#{r.target.author}</span> {r.target.excerpt ? `· “${r.target.excerpt}”` : ""}
            </p>
            {r.details && <p className="mt-1 text-[0.82rem] text-muted">Reporter's note: {r.details}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={r.target.href} className="btn btn-outline btn-sm">
                <ExternalLink className="size-3.5" /> View
              </Link>
              {r.status === "open" && (
                <>
                  <button onClick={() => act(r, "dismiss")} className="btn btn-ghost btn-sm">
                    Dismiss
                  </button>
                  <button onClick={() => act(r, "resolve")} className="btn btn-ghost btn-sm">
                    Resolve
                  </button>
                  {r.target.kind !== "user" && (
                    <button onClick={() => act(r, "remove_content")} className="btn btn-red btn-sm">
                      <Trash className="size-3.5" /> Remove content
                    </button>
                  )}
                  <button onClick={() => act(r, "delete_account")} className="btn btn-outline btn-sm text-rose-300">
                    <ShieldAlert className="size-3.5" /> Delete account
                  </button>
                </>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function UsersTab() {
  const { actions } = useStore();
  const [q, setQ] = useState("");
  const { data, isLoading, error, mutate } = useSWR<AdminUser[]>(`/api/admin/users?q=${encodeURIComponent(q)}`);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="Search by code or email" />
      </div>
      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : error ? (
        <p className="text-rose-300">{error.message}</p>
      ) : !data?.length ? (
        <EmptyState icon={Users} title="No members found" text="Try another code or email." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-[0.84rem]">
            <thead className="border-b border-line text-[0.72rem] uppercase tracking-wider text-faint">
              <tr>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5">Activity</th>
                <th className="px-4 py-2.5">Reports</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((u) => (
                <tr key={u.code}>
                  <td className="px-4 py-2.5">
                    <Link href={`/profile/${u.code}`} className="code-font font-semibold text-ink hover:underline">
                      #{u.code}
                    </Link>
                    {u.isAdmin && <span className="badge ml-2 border-amber-400/30 bg-amber-500/10 text-amber-200">Admin</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{u.email}</td>
                  <td className="px-4 py-2.5 text-muted">{timeAgo(u.joinedAt)}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {u.posts} posts · {u.contributions} contributions
                  </td>
                  <td className={cn("px-4 py-2.5", u.openReports ? "text-rose-300" : "text-faint")}>{u.openReports}</td>
                  <td className="px-4 py-2.5 text-right">
                    {!u.isAdmin && (
                      <button
                        onClick={() =>
                          actions.openModal({
                            type: "confirm",
                            title: `Delete #${u.code}?`,
                            text: "This permanently deletes the account and all of its content. This is recorded in the audit log.",
                            confirmLabel: "Delete account",
                            danger: true,
                            requireReason: true,
                            onConfirm: async (reason) => {
                              await api(`/api/admin/users/${u.code}`, { method: "DELETE", body: { reason } });
                              actions.toast(`#${u.code} deleted`, "info");
                              mutate();
                            },
                          })
                        }
                        className="btn btn-ghost btn-sm text-rose-300"
                      >
                        <Trash className="size-3.5" /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Credentials() {
  const { actions } = useStore();
  const { data, isLoading, mutate } = useSWR<Cred[]>("/api/admin/credentials");
  const [busy, setBusy] = useState<string | null>(null);
  const decide = async (code: string, decision: "verified" | "rejected") => {
    const note = decision === "rejected" ? window.prompt("Reason shown to the applicant (optional)") ?? undefined : undefined;
    setBusy(code);
    try {
      await api("/api/admin/credentials", { method: "PATCH", body: { code, decision, note } });
      actions.toast(decision === "verified" ? `#${code} verified` : `#${code} rejected`, "info");
      mutate();
    } catch (e) {
      actions.toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };
  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (!data?.length) return <EmptyState icon={BadgeCheck} title="No applications" text="Licensed-professional applications appear here for verification." />;
  return (
    <div className="space-y-3">
      <p className="text-[0.82rem] text-muted">Check each registration number against the issuing body's public register before approving.</p>
      {data.map((c) => (
        <article key={c.code} className="card flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <Link href={`/profile/${c.code}`} className="code-font font-semibold text-ink hover:underline">
              #{c.code}
            </Link>
            <p className="text-[0.86rem] text-ink-2">
              {c.credentialType} · {c.issuingBody} · <span className="code-font">{c.registrationNumber}</span>
            </p>
            <p className="text-[0.74rem] text-faint">
              Submitted {timeAgo(c.submittedAt)} · <span className="capitalize">{c.status}</span>
              {c.reviewNote ? ` · ${c.reviewNote}` : ""}
            </p>
          </div>
          {c.status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => decide(c.code, "rejected")} disabled={busy === c.code} className="btn btn-ghost btn-sm">
                Reject
              </button>
              <button onClick={() => decide(c.code, "verified")} disabled={busy === c.code} className="btn btn-blue btn-sm">
                {busy === c.code ? <Loader2 className="size-3.5 animate-spin" /> : "Verify"}
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function AuditTab() {
  const { actions } = useStore();
  const { data, isLoading, mutate } = useSWR<Audit>("/api/admin/audit");
  const [busy, setBusy] = useState(false);
  if (isLoading || !data) return <p className="text-muted">Loading…</p>;
  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <HardDrive className="size-5 text-brand-ink" />
        <p className="flex-1 text-[0.86rem] text-ink-2">
          Storage {data.storage.configured ? "connected" : <span className="text-amber-300">not configured</span>} · {data.storage.pendingDeletes} file deletions pending
        </p>
        {data.storage.pendingDeletes > 0 && data.storage.configured && (
          <button
            onClick={async () => {
              setBusy(true);
              await api("/api/admin/audit", { method: "POST", body: {} }).catch((e) => actions.toast(e.message, "error"));
              setBusy(false);
              mutate();
            }}
            className="btn btn-outline btn-sm"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Retry deletions"}
          </button>
        )}
      </div>
      {!data.entries.length ? (
        <EmptyState icon={ScrollText} title="No moderation actions yet" text="Every administrator action is recorded here." />
      ) : (
        <ul className="card divide-y divide-line">
          {data.entries.map((e) => (
            <li key={e.id} className="px-4 py-3 text-[0.84rem]">
              <span className="font-semibold text-ink">{e.action.replace(/_/g, " ")}</span> <span className="text-muted">on {e.targetType}</span> <span className="code-font text-faint">{e.targetId.slice(0, 12)}</span>
              <span className="block text-[0.74rem] text-faint">
                {e.admin} · {timeAgo(e.at)}
                {typeof e.details?.reason === "string" && e.details.reason ? ` · ${e.details.reason}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("reports");
  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <div>
        <h1 className="section-title flex items-center gap-2 text-[1.5rem]">
          <ShieldAlert className="size-6 text-accent" /> Moderation
        </h1>
        <p className="mt-1 text-[0.9rem] text-muted">Visible only to RUHIZ administrators. Every action is verified on the server and recorded in the audit log.</p>
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "reports", label: "Reports", icon: Flag },
          { id: "users", label: "Members", icon: Users },
          { id: "credentials", label: "Professional verification", icon: BadgeCheck },
          { id: "audit", label: "Audit log", icon: ScrollText },
        ]}
      />
      {tab === "reports" && <Reports />}
      {tab === "users" && <UsersTab />}
      {tab === "credentials" && <Credentials />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}
