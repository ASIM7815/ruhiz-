import { body, route } from "@/server/http";
import { q } from "@/server/db";
import { resolveSettings, settingsSchema } from "@/lib/settings";

export const PATCH = route({}, async ({ req, viewer }) => {
  const patch = await body(req, settingsSchema);
  const next = resolveSettings({ ...viewer.settings, ...patch, notify: { ...(viewer.settings.notify as object), ...(patch.notify ?? {}) } });
  await q(`update profiles set settings = $2 where user_id = $1`, [viewer.id, JSON.stringify(next)]);
  return next;
});
