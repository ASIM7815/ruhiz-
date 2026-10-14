import "server-only";
import type { HelpType, Me, Profile } from "@/lib/types";
import { resolveSettings } from "@/lib/settings";
import { one } from "../db";
import { accountRevealed, avatarUrl, itemMasked, ms, toMember, userCols } from "../mappers";
import type { Viewer } from "../session";

export async function getMe(viewer: Viewer): Promise<Me> {
  const r = await one<Record<string, unknown>>(
    `select p.*, ${accountRevealed("p")} as revealed_now,
            (select count(*) from user_supports where supported_id = p.user_id) as supporters,
            (select count(*) from user_supports where supporter_id = p.user_id) as supporting
       from profiles p where p.user_id = $1`,
    [viewer.id],
  );
  if (!r) throw new Error("profile missing");
  return {
    code: String(r.code).trim(),
    email: viewer.email,
    avatarUrl: avatarUrl(r.avatar_media_id),
    bannerUrl: avatarUrl(r.banner_media_id),
    headline: String(r.headline),
    bio: String(r.bio),
    location: String(r.location),
    identity: r.revealed_now ? "revealer" : "saver",
    revealedName: String(r.revealed_name),
    revealedRole: String(r.revealed_role),
    revealedAt: r.revealed_now ? ms(r.revealed_at) : null,
    expertise: r.expertise as string[],
    canHelpWith: r.can_help_with as HelpType[],
    onboarded: Boolean(r.onboarded),
    isAdmin: viewer.isAdmin,
    supporters: Number(r.supporters),
    supporting: Number(r.supporting),
    settings: resolveSettings(r.settings),
    joinedAt: ms(r.created_at),
  };
}

/**
 * A member's profile as `viewer` may see it. While the account is hidden, other people get only the
 * code and non-identifying data; name, role, headline, bio, location, expertise, photo and banner are
 * not even selected. The owner always sees their own details (flagged with `ownerView`).
 * Identity Saver items of a revealed account are excluded from every count and list here.
 */
export async function getProfileByCode(viewer: Viewer, code: string): Promise<Profile | null> {
  const open = `(${accountRevealed("p")} or p.user_id = $1)`;
  const publicPost = `(p.user_id = $1 or not ${itemMasked("p", "x.identity_mode")})`;
  const r = await one<Record<string, unknown>>(
    `select p.user_id, p.created_at, p.can_help_with, ${accountRevealed("p")} as revealed_now,
            case when ${open} then p.bio else '' end as bio,
            case when ${open} then p.location else '' end as location,
            case when ${open} then p.expertise else '{}'::text[] end as expertise,
            case when ${open} then p.headline else '' end as own_headline,
            case when ${open} then p.avatar_media_id end as own_avatar,
            case when ${open} then p.banner_media_id end as own_banner,
            ${userCols("p", "u_")},
            (select count(*) from user_supports where supported_id = p.user_id) as supporters,
            (select count(*) from user_supports where supporter_id = p.user_id) as supporting,
            exists(select 1 from user_supports where supporter_id = $1 and supported_id = p.user_id) as supported_by_me,
            (select count(*) from solutions where author_id = p.user_id) as solutions,
            (select count(*) from help_offers where user_id = p.user_id) as helped,
            (select count(*) from posts x where x.author_id = p.user_id and ${publicPost}) as n_posts,
            (select count(*) from posts x where x.author_id = p.user_id and x.kind = 'photo' and ${publicPost}) as n_photos,
            (select count(*) from posts x where x.author_id = p.user_id and x.kind = 'video' and ${publicPost}) as n_videos,
            (select count(*) from posts x where x.author_id = p.user_id and x.kind = 'thought' and ${publicPost}) as n_thoughts,
            (select count(*) from contributions x where x.author_id = p.user_id and ${publicPost}) as n_contrib
       from profiles p where p.code = $2`,
    [viewer.id, code],
  );
  if (!r) return null;
  const isMe = r.user_id === viewer.id;
  const base = toMember(r, "u_");
  return {
    ...base,
    // The owner sees their own photo and headline even while hidden; everyone else gets the public view.
    avatarUrl: isMe ? avatarUrl(r.own_avatar) : base.avatarUrl,
    headline: isMe ? String(r.own_headline ?? "") : base.headline,
    bannerUrl: avatarUrl(r.own_banner),
    bio: String(r.bio),
    location: String(r.location),
    identity: r.revealed_now ? "revealer" : "saver",
    expertise: r.expertise as string[],
    canHelpWith: r.can_help_with as HelpType[],
    supporters: Number(r.supporters),
    supporting: Number(r.supporting),
    joinedAt: ms(r.created_at),
    impact: { solutions: Number(r.solutions), helped: Number(r.helped) },
    counts: { posts: Number(r.n_posts), photos: Number(r.n_photos), videos: Number(r.n_videos), thoughts: Number(r.n_thoughts), contributions: Number(r.n_contrib) },
    isMe,
    ownerView: isMe && !r.revealed_now,
    supportedByMe: Boolean(r.supported_by_me),
  };
}

export async function userIdByCode(code: string) {
  const r = await one<{ user_id: string }>(`select user_id from profiles where code = $1`, [code]);
  return r?.user_id ?? null;
}
