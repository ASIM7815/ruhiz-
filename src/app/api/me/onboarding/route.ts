import { body, route } from "@/server/http";
import { q } from "@/server/db";
import { badRequest } from "@/server/errors";
import { onboarding } from "@/server/schemas";
import { getMe } from "@/server/repo/profiles";

/** First-run profile setup. Chosen topics seed the For You interest scores. */
export const POST = route({}, async ({ req, viewer }) => {
  const p = await body(req, onboarding);
  if (p.avatarMediaId) {
    const rows = await q(`select 1 from media where id = $1 and owner_id = $2 and purpose = 'avatar' and status = 'ready'`, [p.avatarMediaId, viewer.id]);
    if (!rows.length) throw badRequest("That photo upload wasn't found.");
  }
  await q(
    `update profiles set headline = coalesce($2, headline), bio = coalesce($3, bio), location = coalesce($4, location),
            identity_mode = coalesce($5, identity_mode), can_help_with = coalesce($6, can_help_with),
            avatar_media_id = coalesce($7, avatar_media_id), onboarded = true
      where user_id = $1`,
    [viewer.id, p.headline ?? null, p.bio ?? null, p.location ?? null, p.identity ?? null, p.canHelpWith ?? null, p.avatarMediaId ?? null],
  );
  for (const cat of p.interests) {
    await q(`select ruhiz_add_interest($1, $2, 3)`, [viewer.id, cat]);
    await q(`insert into interaction_events (user_id, category_id, event_type, weight) values ($1, $2, 'interest', 3)`, [viewer.id, cat]);
  }
  return getMe({ ...viewer, onboarded: true });
});
