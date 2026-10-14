import "server-only";
import type { Member, UserLite } from "@/lib/types";

/*
 * Identity privacy — the single place that decides what identity data leaves the database.
 *
 * Account level (profiles.identity_mode + revealed_at):
 *   hidden (default)  → only the public #CODE. No name, role, headline, photo, banner, bio, location or expertise.
 *   revealed          → set only through the consented reveal flow (PUT /api/me/identity).
 *
 * Item level (posts.identity_mode / contributions.identity_mode, chosen per item):
 *   An item shows the author's name only when BOTH the item says "revealer" AND the account is revealed now.
 *   An item posted as Identity Saver by an account that is revealed now is MASKED: not even the #CODE is
 *   returned, because the code would lead straight to the revealed profile.
 *
 * Everything is decided in SQL, so values that must stay private are never selected at all.
 */

/** SQL: the account behind alias `a` has a consented, complete reveal right now. */
export const accountRevealed = (a: string) => `(${a}.identity_mode = 'revealer' and ${a}.revealed_at is not null and ${a}.revealed_name <> '')`;

/** SQL: an item with identity expression `ctx` by account `a` must hide its author completely. */
export const itemMasked = (a: string, ctx: string) => `(${accountRevealed(a)} and ${ctx} <> 'revealer')`;

/**
 * SQL columns needed to build a UserLite. Use with a `profiles` alias.
 * @param identityExpr item-level identity expression ('saver' | 'revealer'); omit for account-level contexts
 *                     (profiles, people lists, messages, solutions), which follow the account setting only.
 */
export const userCols = (a: string, prefix: string, identityExpr?: string) => {
  const shown = identityExpr ? `(${accountRevealed(a)} and ${identityExpr} = 'revealer')` : accountRevealed(a);
  const masked = identityExpr ? itemMasked(a, identityExpr) : "false";
  return `
  case when ${masked} then null else ${a}.code end as ${prefix}code,
  ${shown} as ${prefix}shown,
  case when ${shown} then ${a}.headline else '' end as ${prefix}headline,
  case when ${shown} then ${a}.avatar_media_id end as ${prefix}avatar,
  case when ${shown} then ${a}.revealed_name end as ${prefix}rname,
  case when ${shown} then ${a}.revealed_role end as ${prefix}rrole,
  (not ${masked} and ${a}.last_seen_at > now() - interval '5 minutes' and coalesce((${a}.settings->>'showOnline')::boolean, true)) as ${prefix}online,
  (not ${masked} and exists(select 1 from support_credentials sc where sc.user_id = ${a}.user_id and sc.status = 'verified')) as ${prefix}pro`;
};

export const avatarUrl = (id: unknown) => (id ? `/api/media/${id}` : null);

export function toUser(r: Record<string, unknown>, prefix: string): UserLite {
  const code = r[`${prefix}code`];
  const shown = Boolean(r[`${prefix}shown`]) && Boolean(r[`${prefix}rname`]);
  return {
    code: code ? String(code).trim() : null,
    avatarUrl: shown ? avatarUrl(r[`${prefix}avatar`]) : null,
    headline: shown ? String(r[`${prefix}headline`] ?? "") : "",
    online: Boolean(r[`${prefix}online`]),
    revealed: shown ? { name: String(r[`${prefix}rname`]), role: String(r[`${prefix}rrole`] ?? "") } : null,
    verifiedProfessional: Boolean(r[`${prefix}pro`]),
  };
}

/** For account-level contexts (userCols without an item identity), where the code is never masked. */
export function toMember(r: Record<string, unknown>, prefix: string): Member {
  return { ...toUser(r, prefix), code: String(r[`${prefix}code`]).trim() };
}

export const ms = (v: unknown) => (v ? new Date(v as string).getTime() : 0);
export const msOrNull = (v: unknown) => (v ? new Date(v as string).getTime() : null);
