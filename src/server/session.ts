import "server-only";
import { randomInt } from "node:crypto";
import { auth } from "./auth";
import { one, q } from "./db";
import { ApiError, forbidden, unauthorized } from "./errors";

/**
 * Administrators are rows in `user_roles` (role 'admin'), granted only by a migration or the
 * server-side `npm run admin:grant` script. Nothing the browser sends can grant or claim it,
 * and the account's email must still be verified in Neon Auth.
 */
const ADMIN_SQL = `exists(select 1 from user_roles r where r.user_id = u.id and r.role = 'admin') and u."emailVerified"`;

export interface Viewer {
  id: string;
  code: string;
  email: string;
  isAdmin: boolean;
  location: string;
  identityMode: "saver" | "revealer";
  settings: Record<string, unknown>;
  onboarded: boolean;
}

interface ViewerRow {
  id: string;
  email: string;
  email_verified: boolean;
  banned: boolean | null;
  is_admin: boolean;
  code: string | null;
  location: string | null;
  identity_mode: "saver" | "revealer" | null;
  revealed_at: string | null;
  settings: Record<string, unknown> | null;
  onboarded: boolean | null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreading

function newCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

async function loadViewerRow(userId: string) {
  return one<ViewerRow>(
    `select u.id, u.email, u."emailVerified" as email_verified, u.banned, ${ADMIN_SQL} as is_admin,
            p.code, p.location, p.identity_mode, p.revealed_at, p.settings, p.onboarded
       from neon_auth."user" u left join profiles p on p.user_id = u.id
      where u.id = $1`,
    [userId],
  );
}

/** Returns the signed-in viewer, creating their RUHIZ profile on first use. Null when signed out. */
export async function getViewer(): Promise<Viewer | null> {
  const { data: session, error } = await auth().getSession();
  // A transport/upstream failure is not "signed out": surface it so users aren't bounced to sign-in.
  if (error && (error.status === 0 || error.status >= 500 || String(error.code).startsWith("NETWORK"))) {
    throw new ApiError(503, "The sign-in service is unreachable. Please try again.", "AUTH_UNAVAILABLE");
  }
  const userId = session?.user?.id;
  if (!userId) return null;

  // Identity comes from the database row, not from the (cached) session payload.
  let row = await loadViewerRow(userId);
  if (!row || row.banned) return null; // deleted or banned account with a still-cached cookie
  if (!row.email_verified) throw new ApiError(403, "Please verify your email address to continue.", "EMAIL_NOT_VERIFIED");

  if (!row.code) {
    for (let attempt = 0; attempt < 6 && !row?.code; attempt++) {
      try {
        await q(`insert into profiles (user_id, code) values ($1, $2) on conflict (user_id) do nothing`, [userId, newCode()]);
      } catch (e) {
        // Unique violation on code: retry with a new one. FK violation: user vanished.
        if ((e as { code?: string }).code !== "23505") return null;
      }
      row = await loadViewerRow(userId);
    }
    if (!row?.code) return null;
  }

  // Presence, throttled to one write every two minutes.
  q(`update profiles set last_seen_at = now() where user_id = $1 and last_seen_at < now() - interval '2 minutes'`, [userId]).catch(() => {});

  return {
    id: row.id,
    code: row.code,
    email: row.email,
    isAdmin: Boolean(row.is_admin),
    location: row.location ?? "",
    // Hidden unless the account went through the consented reveal flow.
    identityMode: row.identity_mode === "revealer" && row.revealed_at ? "revealer" : "saver",
    settings: row.settings ?? {},
    onboarded: Boolean(row.onboarded),
  };
}

/** True when the account holds the explicit admin role (and is still email-verified). */
export async function isAdminUser(userId: string) {
  const row = await one<{ is_admin: boolean }>(`select ${ADMIN_SQL} as is_admin from neon_auth."user" u where u.id = $1`, [userId]);
  return Boolean(row?.is_admin);
}

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw unauthorized();
  return v;
}

/** Re-checks admin status against the database on every call. */
export async function requireAdmin(): Promise<Viewer> {
  const v = await requireViewer();
  const row = await one<{ is_admin: boolean }>(`select ${ADMIN_SQL} as is_admin from neon_auth."user" u where u.id = $1`, [v.id]);
  if (!row?.is_admin) throw forbidden("Administrator access only.");
  return v;
}

export async function audit(admin: Viewer, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  await q(
    `insert into admin_audit_log (admin_user_id, admin_email, action, target_type, target_id, details) values ($1, $2, $3, $4, $5, $6)`,
    [admin.id, admin.email, action, targetType, targetId, JSON.stringify(details)],
  );
}
