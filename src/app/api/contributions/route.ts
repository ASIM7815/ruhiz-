import { body, parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { newContribution } from "@/server/schemas";
import { getContribution, listContributions } from "@/server/repo/discussion";
import { recordEvent } from "@/server/repo/posts";
import { advanceProblem } from "@/server/repo/lifecycle";
import { notify } from "@/server/repo/notify";

export const GET = route({}, async ({ req, viewer }) => {
  const sp = req.nextUrl.searchParams;
  if (sp.get("post")) return listContributions(viewer, { kind: "post", id: parseId(sp.get("post")!) });
  if (sp.get("solution")) return listContributions(viewer, { kind: "solution", id: parseId(sp.get("solution")!) });
  throw badRequest("Specify ?post= or ?solution=.");
});

export const POST = route({ rateLimit: { key: "contribution", limit: 90, windowSec: 3600 } }, async ({ req, viewer }) => {
  const p = await body(req, newContribution);
  if (p.identity === "revealer" && viewer.identityMode !== "revealer")
    throw badRequest("Reveal your identity in Settings before posting as Identity Revealer.");

  let ownerId: string | null = null;
  let isProblem = false;
  if (p.postId) {
    const post = await one<{ author_id: string; intent: string }>(`select author_id, intent from posts where id = $1`, [p.postId]);
    if (!post) throw notFound("This post isn't available.");
    ownerId = post.author_id;
    isProblem = post.intent === "problem";
  } else {
    const sol = await one<{ author_id: string }>(`select author_id from solutions where id = $1`, [p.solutionId]);
    if (!sol) throw notFound("This solution isn't available.");
    ownerId = sol.author_id;
  }

  let parentAuthor: string | null = null;
  if (p.parentId) {
    const parent = await one<{ author_id: string; post_id: string | null; solution_id: string | null }>(
      `select author_id, post_id, solution_id from contributions where id = $1`,
      [p.parentId],
    );
    if (!parent || parent.post_id !== (p.postId ?? null) || parent.solution_id !== (p.solutionId ?? null)) throw badRequest("You can only reply within the same discussion.");
    parentAuthor = parent.author_id;
  }

  const [row] = await q<{ id: string }>(
    `insert into contributions (post_id, solution_id, parent_id, author_id, type, body, source, identity_mode)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [p.postId ?? null, p.solutionId ?? null, p.parentId ?? null, viewer.id, p.type, p.text, p.type === "evidence" ? p.source || null : null, p.identity],
  );

  if (p.postId) {
    await recordEvent(viewer.id, p.postId, "contribute", 1);
    if (isProblem) {
      if (p.type === "solution") await advanceProblem(p.postId, "solutions", "A member proposed a solution in the discussion.");
      else if (p.type !== "support") await advanceProblem(p.postId, "discussion", "Discussion started.");
    }
  }
  await notify(ownerId, viewer.id, "response", { postId: p.postId, solutionId: p.solutionId });
  if (parentAuthor && parentAuthor !== ownerId) await notify(parentAuthor, viewer.id, "response", { postId: p.postId, solutionId: p.solutionId });

  return getContribution(viewer, row.id);
});
