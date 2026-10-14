import { z } from "zod";
import { body, code6, route } from "@/server/http";
import { one } from "@/server/db";
import { badRequest, forbidden, notFound } from "@/server/errors";
import { audit, isAdminUser } from "@/server/session";
import { deleteAccount } from "@/server/repo/deletion";

/** Delete another member's account. Admin only; admin accounts are protected. */
export const DELETE = route<{ code: string }>({ access: "admin", rateLimit: { key: "admin-delete-user", limit: 60, windowSec: 3600 } }, async ({ req, viewer, params }) => {
  const parsed = code6.safeParse(params.code);
  if (!parsed.success) throw notFound("No user with that code.");
  const { reason } = await body(req, z.object({ reason: z.string().trim().min(3).max(300) }).strict());
  const u = await one<{ user_id: string }>(
    `select p.user_id from profiles p join neon_auth."user" u on u.id = p.user_id where p.code = $1`,
    [parsed.data],
  );
  if (!u) throw notFound("No user with that code.");
  if (u.user_id === viewer.id) throw badRequest("Use Settings → Delete account to delete your own account.");
  if (await isAdminUser(u.user_id)) throw forbidden("Administrator accounts can't be deleted by another administrator.");
  await deleteAccount(u.user_id, "deleted by moderator");
  await audit(viewer, "delete_account", "user", u.user_id, { code: parsed.data, reason });
  return { ok: true };
});
