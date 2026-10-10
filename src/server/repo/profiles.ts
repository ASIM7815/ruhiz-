import "server-only";
import type { HelpType, Me, Profile } from "@/lib/types";
import { resolveSettings } from "@/lib/settings";
import { one } from "../db";
import { avatarUrl, ms, toUser, userCols } from "../mappers";
import type { Viewer } from "../session";

export async function getMe(viewer: Viewer): Promise<Me> {
  const r = await one<Record<string, unknown>>(
    `select p.*, (select count(*) from user_supports where supported_id = p.user_id) as supporters,
            (select count(*) from user_supports where supporter_id = p.user_id) as supporting
       from profiles p where p.user_id = $1`,
    [viewer.id],
  );
  if (!r) throw new Error("profile missing");
  return {
    code: String(r.code).trim(),
    email: viewer.email,
    avatarUrl: avatarUrl(r.avatar_media_id),
    headline: String(r.headline),
    bio: String(r.bio),
    location: String(r.location),
    identity: r.identity_mode as Me["identity"],
    revealedName: String(r.revealed_name),
    revealedRole: String(r.revealed_role),
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

export async function getProfileByCode(viewer: Viewer, code: string): Promise<Profile | null> {
  const r = await one<Record<string, unknown>>(
    `select p.user_id, p.bio, p.location, p.identity_mode, p.expertise, p.can_help_with, p.created_at,
            ${userCols("p", "u_")},
            (select count(*) from user_supports where supported_id = p.user_id) as supporters,
            (select count(*) from user_supports where supporter_id = p.user_id) as supporting,
            exists(select 1 from user_supports where supporter_id = $1 and supported_id = p.user_id) as supported_by_me,
            (select count(*) from posts where author_id = p.user_id and intent = 'problem' and status = 'solved') as solved,
            (select count(*) from solutions where author_id = p.user_id) as solutions,
            (select count(*) from help_offers where user_id = p.user_id) as helped,
            (select count(*) from posts where author_id = p.user_id) as n_posts,
            (select count(*) from posts where author_id = p.user_id and kind = 'photo') as n_photos,
            (select count(*) from posts where author_id = p.user_id and kind = 'video') as n_videos,
            (select count(*) from posts where author_id = p.user_id and kind = 'thought') as n_thoughts,
            (select count(*) from contributions where author_id = p.user_id) as n_contrib
       from profiles p where p.code = $2`,
    [viewer.id, code],
  );
  if (!r) return null;
  const isMe = r.user_id === viewer.id;
  return {
    ...toUser(r, "u_"),
    bio: String(r.bio),
    location: String(r.location),
    identity: r.identity_mode as Profile["identity"],
    expertise: r.expertise as string[],
    canHelpWith: r.can_help_with as HelpType[],
    supporters: Number(r.supporters),
    supporting: Number(r.supporting),
    joinedAt: ms(r.created_at),
    impact: { solved: Number(r.solved), solutions: Number(r.solutions), helped: Number(r.helped) },
    counts: { posts: Number(r.n_posts), photos: Number(r.n_photos), videos: Number(r.n_videos), thoughts: Number(r.n_thoughts), contributions: Number(r.n_contrib) },
    isMe,
    supportedByMe: Boolean(r.supported_by_me),
  };
}

export async function userIdByCode(code: string) {
  const r = await one<{ user_id: string }>(`select user_id from profiles where code = $1`, [code]);
  return r?.user_id ?? null;
}
