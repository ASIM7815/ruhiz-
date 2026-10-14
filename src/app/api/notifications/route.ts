import { z } from "zod";
import { body, route } from "@/server/http";
import { q } from "@/server/db";
import { ms, toUser, userCols } from "@/server/mappers";

/*
 * The actor is shown at account level, except where the notification is about something they did
 * under an item-level identity: a reply (contribution) or a status change on their own problem.
 * If any of those items is Identity Saver, the actor is masked like the item itself.
 */
const ACTOR_IDENTITY = `case
    when n.type = 'response' and exists (select 1 from contributions c where c.author_id = n.actor_id and c.identity_mode = 'saver'
           and (c.post_id = n.post_id or c.solution_id = n.solution_id)) then 'saver'
    when n.type = 'response' and n.post_id is not null and n.solution_id is null and exists (select 1 from posts r where r.author_id = n.actor_id
           and r.addresses_post_id = n.post_id and r.identity_mode = 'saver') then 'saver'
    when n.type = 'status' and p.author_id = n.actor_id and p.identity_mode = 'saver' then 'saver'
    else 'revealer' end`;
import type { AppNotification, NotificationType } from "@/lib/types";

const TEXT: Record<NotificationType, (t: string) => string> = {
  support: (t) => `supported ${t ? `“${t}”` : "your contribution"}.`,
  response: (t) => `responded to ${t ? `“${t}”` : "your post"}.`,
  solution: (t) => `proposed a Solution Card on “${t}”.`,
  message: () => "sent you a message.",
  help: (t) => `offered help on “${t}”.`,
  status: (t) => `moved “${t}” forward.`,
  supporter: () => "is now one of your Supporters.",
};

export const GET = route({}, async ({ viewer }) => {
  const rows = await q(
    `select n.id, n.type, n.created_at, n.read_at, n.post_id, n.solution_id, n.conversation_id,
            coalesce(s.title, p.title, left(p.body, 60)) as title, ${userCols("a", "a_", ACTOR_IDENTITY)}
       from notifications n join profiles a on a.user_id = n.actor_id
       left join posts p on p.id = n.post_id left join solutions s on s.id = n.solution_id
      where n.user_id = $1 order by n.created_at desc limit 60`,
    [viewer.id],
  );
  return rows.map((r): AppNotification => {
    const type = r.type as NotificationType;
    const actor = toUser(r, "a_");
    const href =
      type === "message" ? `/messages?c=${r.conversation_id}`
      : type === "supporter" && actor.code ? `/profile/${actor.code}`
      : r.solution_id ? `/solution/${r.solution_id}`
      : r.post_id ? `/post/${r.post_id}` : "/home";
    return { id: String(r.id), type, actor, text: TEXT[type](String(r.title ?? "").slice(0, 70)), at: ms(r.created_at), read: Boolean(r.read_at), href };
  });
});

/** Mark specific notifications (or all) as read — only the viewer's own. */
export const POST = route({}, async ({ req, viewer }) => {
  const p = await body(req, z.object({ ids: z.array(z.string().uuid()).max(100).optional(), all: z.boolean().optional() }).strict());
  if (p.all) await q(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [viewer.id]);
  else if (p.ids?.length) await q(`update notifications set read_at = now() where user_id = $1 and id = any($2::uuid[]) and read_at is null`, [viewer.id, p.ids]);
  return { ok: true };
});
