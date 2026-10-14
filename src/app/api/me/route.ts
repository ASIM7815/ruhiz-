import { z } from "zod";
import { body, route } from "@/server/http";
import { one, q } from "@/server/db";
import { badRequest, forbidden } from "@/server/errors";
import { profilePatch } from "@/server/schemas";
import { getMe } from "@/server/repo/profiles";
import { deleteAccount } from "@/server/repo/deletion";
import { drainStorageQueue } from "@/server/storage";

export const GET = route({}, async ({ viewer }) => getMe(viewer));

/** Update own profile. Ownership comes from the session, never from the request body. */
export const PATCH = route({}, async ({ req, viewer }) => {
  const p = await body(req, profilePatch);
  for (const [field, purpose, label] of [
    ["avatarMediaId", "avatar", "photo"],
    ["bannerMediaId", "banner", "banner"],
  ] as const) {
    const id = p[field];
    if (!id) continue;
    const m = await one(`select 1 from media where id = $1 and owner_id = $2 and purpose = $3 and status = 'ready'`, [id, viewer.id, purpose]);
    if (!m) throw badRequest(`That ${label} upload wasn't found.`);
  }
  // A revealed profile must keep a real description (it is one of the reveal's required details).
  if (p.bio !== undefined && viewer.identityMode === "revealer" && p.bio.length < 10)
    throw badRequest("While your identity is revealed your description needs at least 10 characters. Hide your identity first to clear it.");

  const old = await one<{ avatar_media_id: string | null; banner_media_id: string | null }>(`select avatar_media_id, banner_media_id from profiles where user_id = $1`, [viewer.id]);
  await q(
    `update profiles set
       headline = coalesce($2, headline), bio = coalesce($3, bio), location = coalesce($4, location),
       expertise = coalesce($5, expertise), can_help_with = coalesce($6, can_help_with),
       avatar_media_id = case when $7::boolean then $8::uuid else avatar_media_id end,
       banner_media_id = case when $9::boolean then $10::uuid else banner_media_id end
     where user_id = $1`,
    [
      viewer.id, p.headline ?? null, p.bio ?? null, p.location ?? null, p.expertise ?? null, p.canHelpWith ?? null,
      p.avatarMediaId !== undefined, p.avatarMediaId ?? null, p.bannerMediaId !== undefined, p.bannerMediaId ?? null,
    ],
  );
  // Replaced or removed photo/banner: delete the old object.
  const replaced = [
    p.avatarMediaId !== undefined && old?.avatar_media_id && old.avatar_media_id !== p.avatarMediaId ? old.avatar_media_id : null,
    p.bannerMediaId !== undefined && old?.banner_media_id && old.banner_media_id !== p.bannerMediaId ? old.banner_media_id : null,
  ].filter((x): x is string => Boolean(x));
  if (replaced.length) {
    await q(`insert into storage_gc (object_key, bucket, reason) select object_key, bucket, 'profile image replaced' from media where id = any($1::uuid[]) on conflict do nothing`, [replaced]);
    await q(`delete from media where id = any($1::uuid[]) and owner_id = $2`, [replaced, viewer.id]);
    drainStorageQueue().catch(() => {});
  }
  return getMe(viewer);
});

/** Self-service account deletion. The caller must type their own code to confirm. */
export const DELETE = route({ rateLimit: { key: "delete-account", limit: 5, windowSec: 3600 } }, async ({ req, viewer }) => {
  const { confirm } = await body(req, z.object({ confirm: z.string().trim() }).strict());
  if (confirm.toUpperCase().replace(/^#/, "") !== viewer.code) throw forbidden("Type your code exactly to confirm deletion.");
  await deleteAccount(viewer.id, "self-deleted");
  return { ok: true };
});
