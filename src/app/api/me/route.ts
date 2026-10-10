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
  if (p.avatarMediaId) {
    const m = await one(`select 1 from media where id = $1 and owner_id = $2 and purpose = 'avatar' and status = 'ready'`, [p.avatarMediaId, viewer.id]);
    if (!m) throw badRequest("That photo upload wasn't found.");
  }
  const old = await one<{ avatar_media_id: string | null }>(`select avatar_media_id from profiles where user_id = $1`, [viewer.id]);
  await q(
    `update profiles set
       headline = coalesce($2, headline), bio = coalesce($3, bio), location = coalesce($4, location),
       identity_mode = coalesce($5, identity_mode), revealed_name = coalesce($6, revealed_name), revealed_role = coalesce($7, revealed_role),
       expertise = coalesce($8, expertise), can_help_with = coalesce($9, can_help_with),
       avatar_media_id = case when $10::boolean then $11::uuid else avatar_media_id end
     where user_id = $1`,
    [
      viewer.id, p.headline ?? null, p.bio ?? null, p.location ?? null, p.identity ?? null, p.revealedName ?? null, p.revealedRole ?? null,
      p.expertise ?? null, p.canHelpWith ?? null, p.avatarMediaId !== undefined, p.avatarMediaId ?? null,
    ],
  );
  // Replaced avatar: remove the old object.
  if (p.avatarMediaId !== undefined && old?.avatar_media_id && old.avatar_media_id !== p.avatarMediaId) {
    await q(`insert into storage_gc (object_key, bucket, reason) select object_key, bucket, 'avatar replaced' from media where id = $1 on conflict do nothing`, [old.avatar_media_id]);
    await q(`delete from media where id = $1 and owner_id = $2`, [old.avatar_media_id, viewer.id]);
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
