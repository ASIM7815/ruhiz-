import { z } from "zod";
import { body, parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { badRequest, forbidden, notFound } from "@/server/errors";
import { audit, isAdminIdentity } from "@/server/session";
import { deleteAccount, deletePost } from "@/server/repo/deletion";

const action = z
  .object({ action: z.enum(["dismiss", "resolve", "remove_content", "delete_account"]), note: z.string().trim().max(300).optional() })
  .strict();

/** Resolve a report, optionally removing the reported content or account. Admin only. */
export const PATCH = route<{ id: string }>({ access: "admin" }, async ({ req, viewer, params }) => {
  const id = parseId(params.id);
  const p = await body(req, action);
  const r = await one<{ post_id: string | null; contribution_id: string | null; solution_id: string | null; reported_user_id: string | null; status: string }>(
    `select post_id, contribution_id, solution_id, reported_user_id, status from reports where id = $1`,
    [id],
  );
  if (!r) throw notFound("Report not found.");

  if (p.action === "remove_content") {
    if (r.post_id) await deletePost(r.post_id, "removed by moderator");
    else if (r.contribution_id) await q(`delete from contributions where id = $1`, [r.contribution_id]);
    else if (r.solution_id) await q(`delete from solutions where id = $1`, [r.solution_id]);
    else throw badRequest("This report is about an account. Use delete account instead.");
  }
  if (p.action === "delete_account") {
    let uid = r.reported_user_id;
    if (!uid && r.post_id) uid = (await one<{ author_id: string }>(`select author_id from posts where id = $1`, [r.post_id]))?.author_id ?? null;
    if (!uid && r.contribution_id) uid = (await one<{ author_id: string }>(`select author_id from contributions where id = $1`, [r.contribution_id]))?.author_id ?? null;
    if (!uid && r.solution_id) uid = (await one<{ author_id: string }>(`select author_id from solutions where id = $1`, [r.solution_id]))?.author_id ?? null;
    if (!uid) throw notFound("The account no longer exists.");
    const u = await one<{ email: string; email_verified: boolean }>(`select email, "emailVerified" as email_verified from neon_auth."user" where id = $1`, [uid]);
    if (u && isAdminIdentity(u.email, u.email_verified)) throw forbidden("Administrator accounts can't be deleted from moderation.");
    await deleteAccount(uid, "deleted by moderator");
    await audit(viewer, "delete_account", "user", uid, { via: "report", reportId: id, note: p.note ?? null });
  }

  // Closing one report closes the other open reports about the same target.
  await q(
    `update reports set status = $2, resolved_by = $3, resolved_at = now()
      where status = 'open' and (id = $1
         or ($4::uuid is not null and post_id = $4) or ($5::uuid is not null and contribution_id = $5)
         or ($6::uuid is not null and solution_id = $6) or ($7::uuid is not null and reported_user_id = $7))`,
    [id, p.action === "dismiss" ? "dismissed" : "resolved", viewer.id, r.post_id, r.contribution_id, r.solution_id, r.reported_user_id],
  );
  if (p.action !== "delete_account") await audit(viewer, `report_${p.action}`, "report", id, { note: p.note ?? null, postId: r.post_id, contributionId: r.contribution_id, solutionId: r.solution_id });
  return { ok: true };
});
