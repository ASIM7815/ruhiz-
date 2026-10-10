import "server-only";
import type { UserLite } from "@/lib/types";

/** SQL columns needed to build a UserLite. Use with a `profiles` alias. */
export const userCols = (a: string, prefix: string, identityExpr?: string) => `
  ${a}.code as ${prefix}code, ${a}.headline as ${prefix}headline, ${a}.avatar_media_id as ${prefix}avatar,
  ${a}.revealed_name as ${prefix}rname, ${a}.revealed_role as ${prefix}rrole,
  ${identityExpr ?? `${a}.identity_mode`} as ${prefix}ident,
  (${a}.last_seen_at > now() - interval '5 minutes' and coalesce((${a}.settings->>'showOnline')::boolean, true)) as ${prefix}online,
  exists(select 1 from support_credentials sc where sc.user_id = ${a}.user_id and sc.status = 'verified') as ${prefix}pro`;

export const avatarUrl = (id: unknown) => (id ? `/api/media/${id}` : null);

export function toUser(r: Record<string, unknown>, prefix: string): UserLite {
  const revealed = r[`${prefix}ident`] === "revealer" && r[`${prefix}rname`] ? { name: String(r[`${prefix}rname`]), role: String(r[`${prefix}rrole`] ?? "") } : null;
  return {
    code: String(r[`${prefix}code`]).trim(),
    avatarUrl: avatarUrl(r[`${prefix}avatar`]),
    headline: String(r[`${prefix}headline`] ?? ""),
    online: Boolean(r[`${prefix}online`]),
    revealed,
    verifiedProfessional: Boolean(r[`${prefix}pro`]),
  };
}

export const ms = (v: unknown) => (v ? new Date(v as string).getTime() : 0);
export const msOrNull = (v: unknown) => (v ? new Date(v as string).getTime() : null);
