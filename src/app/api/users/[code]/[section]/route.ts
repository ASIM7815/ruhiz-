import { code6, route } from "@/server/http";
import { q } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { itemMasked, toMember, userCols } from "@/server/mappers";
import { userIdByCode } from "@/server/repo/profiles";
import { getPostsByIds } from "@/server/repo/posts";
import { listContributionsByAuthor } from "@/server/repo/discussion";
import { listSolutions } from "@/server/repo/solutions";
import { notify } from "@/server/repo/notify";

/**
 * GET  /api/users/:code/posts?kind=photo|video|thought
 * GET  /api/users/:code/contributions
 * GET  /api/users/:code/people?list=supporters|supporting
 * POST/DELETE /api/users/:code/support   (support / stop supporting this person)
 */
async function target(code: string) {
  const parsed = code6.safeParse(code);
  if (!parsed.success) throw notFound("No user with that code.");
  const id = await userIdByCode(parsed.data);
  if (!id) throw notFound("No user with that code.");
  return id;
}

export const GET = route<{ code: string; section: string }>({}, async ({ req, viewer, params }) => {
  const uid = await target(params.code);
  const sp = req.nextUrl.searchParams;
  switch (params.section) {
    case "posts": {
      const kind = sp.get("kind");
      if (kind && !["photo", "video", "thought"].includes(kind)) throw badRequest("Invalid kind.");
      // Identity Saver posts of a revealed account never appear on its public profile.
      const rows = await q<{ id: string }>(
        `select x.id from posts x join profiles p on p.user_id = x.author_id
          where x.author_id = $1 and ($2::text is null or x.kind = $2) and (x.author_id = $3 or not ${itemMasked("p", "x.identity_mode")})
          order by x.created_at desc limit 60`,
        [uid, kind, viewer.id],
      );
      return getPostsByIds(viewer, rows.map((r) => r.id));
    }
    case "contributions":
      return { contributions: await listContributionsByAuthor(viewer, uid, 60), solutions: await listSolutions(viewer, "author", uid, 30) };
    case "people": {
      const list = sp.get("list") === "supporting" ? "supporting" : "supporters";
      const rows = await q(
        list === "supporters"
          ? `select ${userCols("p", "u_")}, exists(select 1 from user_supports x where x.supporter_id = $2 and x.supported_id = p.user_id) as on_
               from user_supports s join profiles p on p.user_id = s.supporter_id where s.supported_id = $1 order by s.created_at desc limit 200`
          : `select ${userCols("p", "u_")}, exists(select 1 from user_supports x where x.supporter_id = $2 and x.supported_id = p.user_id) as on_
               from user_supports s join profiles p on p.user_id = s.supported_id where s.supporter_id = $1 order by s.created_at desc limit 200`,
        [uid, viewer.id],
      );
      return rows.map((r) => ({ ...toMember(r, "u_"), supportedByMe: Boolean(r.on_), isMe: String(r.u_code).trim() === viewer.code }));
    }
    default:
      throw notFound();
  }
});

export const POST = route<{ code: string; section: string }>({ rateLimit: { key: "support-user", limit: 200, windowSec: 3600 } }, async ({ viewer, params }) => {
  if (params.section !== "support") throw notFound();
  const uid = await target(params.code);
  if (uid === viewer.id) throw badRequest("You can't support yourself.");
  const r = await q(`insert into user_supports (supporter_id, supported_id) values ($1, $2) on conflict do nothing returning 1`, [viewer.id, uid]);
  if (r.length) {
    await notify(uid, viewer.id, "supporter");
    // People you support shape your interests: boost their top categories slightly.
    await q(
      `select ruhiz_add_interest($1, category_id, 1) from (select category_id from posts where author_id = $2 group by category_id order by count(*) desc limit 3) t`,
      [viewer.id, uid],
    );
  }
  return { on: true };
});

export const DELETE = route<{ code: string; section: string }>({}, async ({ viewer, params }) => {
  if (params.section !== "support") throw notFound();
  const uid = await target(params.code);
  await q(`delete from user_supports where supporter_id = $1 and supported_id = $2`, [viewer.id, uid]);
  return { on: false };
});
