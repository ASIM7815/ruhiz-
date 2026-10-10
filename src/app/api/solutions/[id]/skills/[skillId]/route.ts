import { parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { getSolution } from "@/server/repo/solutions";

async function check(id: string, skillId: string) {
  const k = await one<{ needed: number; filled: number; stage: string }>(
    `select k.needed, (select count(*)::int from solution_skill_members m where m.skill_id = k.id) as filled, s.stage
       from solution_skills k join solutions s on s.id = k.solution_id where k.id = $1 and k.solution_id = $2`,
    [skillId, id],
  );
  if (!k) throw notFound("Role not found.");
  return k;
}

/** Join an open role on a Solution Card as yourself. */
export const POST = route<{ id: string; skillId: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  const skillId = parseId(params.skillId);
  const k = await check(id, skillId);
  if (k.stage === "completed") throw badRequest("This solution is completed.");
  const already = await one(`select 1 from solution_skill_members where skill_id = $1 and user_id = $2`, [skillId, viewer.id]);
  if (!already && k.filled >= k.needed) throw badRequest("This role is already filled.");
  await q(`insert into solution_skill_members (skill_id, user_id) values ($1, $2) on conflict do nothing`, [skillId, viewer.id]);
  return getSolution(viewer, id);
});

export const DELETE = route<{ id: string; skillId: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  const skillId = parseId(params.skillId);
  await check(id, skillId);
  await q(`delete from solution_skill_members where skill_id = $1 and user_id = $2`, [skillId, viewer.id]);
  return getSolution(viewer, id);
});
