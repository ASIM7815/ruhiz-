import { z } from "zod";
import { body, parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { notFound } from "@/server/errors";
import { recordEvent } from "@/server/repo/posts";

export const POST = route<{ id: string }>({ rateLimit: { key: "share", limit: 120, windowSec: 3600 } }, async ({ req, viewer, params }) => {
  const id = parseId(params.id);
  const { channel } = await body(req, z.object({ channel: z.enum(["link", "device", "message"]) }).strict());
  if (!(await one(`select 1 from posts where id = $1`, [id]))) throw notFound();
  await q(`insert into post_shares (post_id, user_id, channel) values ($1, $2, $3)`, [id, viewer.id, channel]);
  await recordEvent(viewer.id, id, "share", 1);
  return { ok: true };
});
