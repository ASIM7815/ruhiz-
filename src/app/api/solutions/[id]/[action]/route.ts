import { z } from "zod";
import { body, parseId, route } from "@/server/http";
import { one, q, tx } from "@/server/db";
import { badRequest, forbidden, notFound } from "@/server/errors";
import { getSolution } from "@/server/repo/solutions";
import { advanceProblem } from "@/server/repo/lifecycle";
import { notify } from "@/server/repo/notify";
import { audit } from "@/server/session";

/**
 * POST /api/solutions/:id/support|save   (DELETE to undo)
 * POST /api/solutions/:id/advance        (solution author, problem author or admin)
 * POST /api/solutions/:id/pledge         { amount } — commitment only, no payment
 */
const STAGES = ["proposed", "reviewing", "funding", "implementing", "completed"];

async function load(id: string) {
  const s = await one<{ author_id: string; problem_id: string; stage: string; title: string; funding_needed: string; expected_outcome: string; problem_author_id: string }>(
    `select s.author_id, s.problem_id, s.stage, s.title, s.funding_needed, s.expected_outcome, p.author_id as problem_author_id
       from solutions s join posts p on p.id = s.problem_id where s.id = $1`,
    [id],
  );
  if (!s) throw notFound("Solution not found.");
  return s;
}

export const POST = route<{ id: string; action: string }>({}, async ({ req, viewer, params }) => {
  const id = parseId(params.id);
  const s = await load(id);

  switch (params.action) {
    case "support": {
      const r = await q(`insert into solution_supports (solution_id, user_id) values ($1, $2) on conflict do nothing returning 1`, [id, viewer.id]);
      if (r.length) await notify(s.author_id, viewer.id, "support", { solutionId: id, postId: s.problem_id });
      break;
    }
    case "save":
      await q(`insert into solution_saves (solution_id, user_id) values ($1, $2) on conflict do nothing`, [id, viewer.id]);
      break;
    case "pledge": {
      const { amount } = await body(req, z.object({ amount: z.number().int().min(1).max(100_000_000) }).strict());
      const raised = await one<{ n: string }>(`select coalesce(sum(amount), 0) as n from solution_pledges where solution_id = $1`, [id]);
      const remaining = Number(s.funding_needed) - Number(raised?.n ?? 0);
      if (remaining <= 0) throw badRequest("This solution is already fully pledged.");
      await q(`insert into solution_pledges (solution_id, user_id, amount) values ($1, $2, $3)`, [id, viewer.id, Math.min(amount, remaining)]);
      await notify(s.author_id, viewer.id, "support", { solutionId: id, postId: s.problem_id });
      break;
    }
    case "advance": {
      const isSolAuthor = s.author_id === viewer.id;
      const isProblemAuthor = s.problem_author_id === viewer.id;
      if (!isSolAuthor && !isProblemAuthor && !viewer.isAdmin) throw forbidden("Only the solution's author, the problem's author or a moderator can advance this.");
      const i = STAGES.indexOf(s.stage);
      if (i >= STAGES.length - 1) throw badRequest("This solution is already completed.");
      const next = STAGES[i + 1];
      // Completing a solution marks the problem solved, so only the problem owner (or admin) may do it.
      if (next === "completed" && !isProblemAuthor && !viewer.isAdmin) throw forbidden("Only the person who raised the problem can confirm it's completed.");
      await q(`update solutions set stage = $2, outcome = case when $2 = 'completed' then coalesce(outcome, expected_outcome) else outcome end where id = $1`, [id, next]);
      if (next === "implementing" || next === "completed") await advanceProblem(s.problem_id, "implementation", `Solution “${s.title}” moved into implementation.`);
      if (next === "completed") {
        await tx([
          { text: `update posts set status = 'solved', outcome = coalesce(outcome, $2) where id = $1 and status <> 'solved'`, params: [s.problem_id, s.expected_outcome] },
          { text: `insert into post_lifecycle_updates (post_id, status, note, actor_id) values ($1, 'solved', $2, $3)`, params: [s.problem_id, `Outcome reached through “${s.title}”.`, viewer.id] },
        ]);
      }
      if (!isSolAuthor && !isProblemAuthor) await audit(viewer, "advance_solution", "solution", id, { to: next });
      if (!isSolAuthor) await notify(s.author_id, viewer.id, "status", { solutionId: id, postId: s.problem_id });
      break;
    }
    default:
      throw notFound();
  }
  return getSolution(viewer, id);
});

export const DELETE = route<{ id: string; action: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  await load(id);
  if (params.action === "support") await q(`delete from solution_supports where solution_id = $1 and user_id = $2`, [id, viewer.id]);
  else if (params.action === "save") await q(`delete from solution_saves where solution_id = $1 and user_id = $2`, [id, viewer.id]);
  else throw notFound();
  return getSolution(viewer, id);
});
