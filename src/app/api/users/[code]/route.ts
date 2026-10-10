import { code6, route } from "@/server/http";
import { notFound } from "@/server/errors";
import { getProfileByCode } from "@/server/repo/profiles";

export const GET = route<{ code: string }>({}, async ({ viewer, params }) => {
  const parsed = code6.safeParse(params.code);
  if (!parsed.success) throw notFound("No user with that code.");
  const p = await getProfileByCode(viewer, parsed.data);
  if (!p) throw notFound("No user with that code.");
  return p;
});
