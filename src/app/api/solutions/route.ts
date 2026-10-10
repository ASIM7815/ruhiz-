import { body, parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { newSolution } from "@/server/schemas";
import { getSolution, listSolutions } from "@/server/repo/solutions";
import { advanceProblem } from "@/server/repo/lifecycle";
import { recordEvent } from "@/server/repo/posts";
import { notify } from "@/server/repo/notify";

export const GET = route({}, async ({ req, viewer }) => {
  const problem = req.nextUrl.searchParams.get("problem");
  if (!problem) throw badRequest("Specify ?problem=.");
  return listSolutions(viewer, "problem", parseId(problem));
});

export const POST = route({ rateLimit: { key: "solution", limit: 15, windowSec: 3600 } }, async ({ req, viewer }) => {
  const p = await body(req, newSolution);
  const problem = await one<{ author_id: string; status: string }>(`select author_id, status from posts where id = $1 and intent = 'problem'`, [p.problemId]);
  if (!problem) throw notFound("Problem not found.");
  if (problem.status === "solved") throw badRequest("This problem is already solved.");

  const phases = [
    { label: "Plan & validate", duration: "2 weeks" },
    { label: "Gather resources", duration: "3 weeks" },
    { label: "Implement", duration: p.timeline || "To be estimated" },
  ];
  const [row] = await q<{ id: string }>(
    `insert into solutions (problem_id, author_id, title, summary, approach, resources, funding_needed, timeline, phases, expected_outcome, evidence)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [p.problemId, viewer.id, p.title, p.summary, p.approach, p.resources, p.fundingNeeded, p.timeline, JSON.stringify(phases), p.expectedOutcome, p.evidence],
  );
  for (const label of [...new Set(p.skills)]) await q(`insert into solution_skills (solution_id, label, needed) values ($1, $2, 2) on conflict do nothing`, [row.id, label]);
  await q(`insert into solution_supports (solution_id, user_id) values ($1, $2) on conflict do nothing`, [row.id, viewer.id]);
  await advanceProblem(p.problemId, "solutions", `#${viewer.code} proposed a Solution Card: “${p.title}”.`);
  await recordEvent(viewer.id, p.problemId, "contribute", 2);
  await notify(problem.author_id, viewer.id, "solution", { postId: p.problemId, solutionId: row.id });
  return getSolution(viewer, row.id);
});
