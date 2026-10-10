import { body, code6, route } from "@/server/http";
import { one, q } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { newReport } from "@/server/schemas";
import { userIdByCode } from "@/server/repo/profiles";

/** Any member can report content; only administrators can act on reports. */
export const POST = route({ rateLimit: { key: "report", limit: 20, windowSec: 3600 } }, async ({ req, viewer }) => {
  const p = await body(req, newReport);
  let col: string;
  let id: string;
  if (p.target === "user") {
    const c = code6.safeParse(p.id);
    const uid = c.success ? await userIdByCode(c.data) : null;
    if (!uid) throw notFound("User not found.");
    if (uid === viewer.id) throw badRequest("You can't report yourself.");
    col = "reported_user_id";
    id = uid;
  } else {
    const table = { post: "posts", contribution: "contributions", solution: "solutions" }[p.target];
    if (!/^[0-9a-f-]{36}$/i.test(p.id) || !(await one(`select 1 from ${table} where id = $1`, [p.id]))) throw notFound();
    col = `${p.target}_id`;
    id = p.id;
  }
  const dup = await one(`select 1 from reports where reporter_id = $1 and ${col} = $2 and status = 'open'`, [viewer.id, id]);
  if (!dup) await q(`insert into reports (reporter_id, ${col}, reason, details) values ($1, $2, $3, $4)`, [viewer.id, id, p.reason, p.details ?? null]);
  return { ok: true };
});
