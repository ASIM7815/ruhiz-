import { parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { notFound } from "@/server/errors";

async function count(id: string) {
  const r = await one<{ n: number }>(`select count(*)::int as n from contribution_helpful where contribution_id = $1`, [id]);
  return r?.n ?? 0;
}

export const POST = route<{ id: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  if (!(await one(`select 1 from contributions where id = $1`, [id]))) throw notFound();
  await q(`insert into contribution_helpful (contribution_id, user_id) values ($1, $2) on conflict do nothing`, [id, viewer.id]);
  return { on: true, helpful: await count(id) };
});

export const DELETE = route<{ id: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  await q(`delete from contribution_helpful where contribution_id = $1 and user_id = $2`, [id, viewer.id]);
  return { on: false, helpful: await count(id) };
});
