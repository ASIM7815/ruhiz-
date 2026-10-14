import "server-only";
import type { ProblemStatus, Solution, SolutionStage } from "@/lib/types";
import { q } from "../db";
import { itemMasked, ms, toMember, userCols } from "../mappers";
import type { Viewer } from "../session";

const SOL_SELECT = `
  select s.*, ${userCols("pr", "a_")},
         p.title as problem_title, left(p.body, 90) as problem_body, p.status as problem_status, p.author_id as problem_author_id,
         case when ${itemMasked("pp", "p.identity_mode")} then null else pp.code end as problem_author_code,
         (select count(*) from solution_supports x where x.solution_id = s.id) as supports,
         exists(select 1 from solution_supports x where x.solution_id = s.id and x.user_id = $1) as supported_by_me,
         exists(select 1 from solution_saves x where x.solution_id = s.id and x.user_id = $1) as saved_by_me,
         coalesce((select sum(amount) from solution_pledges x where x.solution_id = s.id), 0) as raised,
         coalesce((select sum(amount) from solution_pledges x where x.solution_id = s.id and x.user_id = $1), 0) as my_pledge,
         (select coalesce(json_agg(json_build_object('id', k.id, 'label', k.label, 'needed', k.needed,
                    'filled', (select count(*) from solution_skill_members m where m.skill_id = k.id),
                    'joined', exists(select 1 from solution_skill_members m where m.skill_id = k.id and m.user_id = $1)) order by k.label), '[]')
            from solution_skills k where k.solution_id = s.id) as skills,
         (select coalesce(array_agg(distinct cp.code), '{}') from profiles cp where cp.user_id in (
            select s.author_id
            union select m.user_id from solution_skill_members m join solution_skills k on k.id = m.skill_id where k.solution_id = s.id
            union select x.user_id from solution_pledges x where x.solution_id = s.id)) as contributors
    from solutions s
    join profiles pr on pr.user_id = s.author_id
    join posts p on p.id = s.problem_id
    join profiles pp on pp.user_id = p.author_id`;

function toSolution(viewer: Viewer, r: Record<string, unknown>): Solution {
  const canManage = viewer.isAdmin || r.author_id === viewer.id || r.problem_author_id === viewer.id;
  return {
    id: String(r.id),
    problem: {
      id: String(r.problem_id),
      title: String(r.problem_title ?? r.problem_body ?? ""),
      status: (r.problem_status as ProblemStatus) ?? null,
      authorCode: r.problem_author_code ? String(r.problem_author_code).trim() : null,
      isMine: r.problem_author_id === viewer.id,
    },
    author: toMember(r, "a_"),
    title: String(r.title),
    summary: String(r.summary),
    approach: r.approach as string[],
    resources: r.resources as string[],
    funding: { needed: Number(r.funding_needed), raised: Number(r.raised) },
    skills: (r.skills as { id: string; label: string; needed: number; filled: number; joined: boolean }[]).map((k) => ({ ...k, filled: Number(k.filled), needed: Number(k.needed) })),
    timeline: String(r.timeline),
    phases: (r.phases as { label: string; duration: string }[]) ?? [],
    expectedOutcome: String(r.expected_outcome),
    evidence: r.evidence as string[],
    supports: Number(r.supports),
    supportedByMe: Boolean(r.supported_by_me),
    savedByMe: Boolean(r.saved_by_me),
    stage: r.stage as SolutionStage,
    contributors: (r.contributors as string[]).map((c) => c.trim()),
    createdAt: ms(r.created_at),
    outcome: (r.outcome as string) ?? null,
    myPledge: Number(r.my_pledge),
    canManage,
    canDelete: viewer.isAdmin || r.author_id === viewer.id,
  };
}

export async function getSolution(viewer: Viewer, id: string) {
  const rows = await q(`${SOL_SELECT} where s.id = $2`, [viewer.id, id]);
  return rows[0] ? toSolution(viewer, rows[0]) : null;
}

export async function listSolutions(viewer: Viewer, where: "problem" | "author" | "contributor" | "popular", arg?: string | null, limit = 50) {
  const clause =
    where === "problem"
      ? `where s.problem_id = $2 order by supports desc, s.created_at`
      : where === "author"
        ? `where s.author_id = $2 order by s.created_at desc`
        : where === "contributor"
          ? `where s.author_id = $2 or exists (select 1 from solution_skill_members m join solution_skills k on k.id = m.skill_id where k.solution_id = s.id and m.user_id = $2)
               or exists (select 1 from solution_pledges x where x.solution_id = s.id and x.user_id = $2) order by s.created_at desc`
          : `where ($2::text is null or p.category_id = $2) order by supports desc, s.created_at desc`;
  const rows = await q(`${SOL_SELECT} ${clause} limit ${Math.min(limit, 100)}`, [viewer.id, arg ?? null]);
  return rows.map((r) => toSolution(viewer, r));
}
