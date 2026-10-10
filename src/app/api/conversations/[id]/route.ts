import { body, parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { notFound } from "@/server/errors";
import { newMessage } from "@/server/schemas";
import { assertCanMessage, listMessages, loadConversation } from "@/server/repo/messages";
import { notify } from "@/server/repo/notify";
import { toUser, userCols } from "@/server/mappers";

/** Messages in a conversation the viewer belongs to. Reading marks it read. */
export const GET = route<{ id: string }>({ rateLimit: { key: "read-messages", limit: 2000, windowSec: 3600 } }, async ({ viewer, params }) => {
  const c = await loadConversation(viewer, parseId(params.id));
  const other = await one(`select ${userCols("p", "u_")}, p.identity_mode from profiles p where p.user_id = $1`, [c.otherId]);
  const messages = await listMessages(viewer, c.id);
  await q(
    `insert into conversation_reads (conversation_id, user_id, last_read_at) values ($1, $2, now())
     on conflict (conversation_id, user_id) do update set last_read_at = now()`,
    [c.id, viewer.id],
  );
  await q(`update notifications set read_at = now() where user_id = $1 and conversation_id = $2 and read_at is null`, [viewer.id, c.id]);
  return { id: c.id, context: c.context, with: other ? { ...toUser(other, "u_"), identity: other.identity_mode } : null, messages };
});

export const POST = route<{ id: string }>({ rateLimit: { key: "message", limit: 300, windowSec: 3600 } }, async ({ req, viewer, params }) => {
  const c = await loadConversation(viewer, parseId(params.id));
  const p = await body(req, newMessage);
  await assertCanMessage(viewer.id, c.otherId, c.id);
  if (p.attachment) {
    const table = p.attachment.kind === "post" ? "posts" : "solutions";
    if (!(await one(`select 1 from ${table} where id = $1`, [p.attachment.id]))) throw notFound("The shared item no longer exists.");
  }
  await q(
    `insert into messages (conversation_id, sender_id, body, attachment_post_id, attachment_solution_id) values ($1, $2, $3, $4, $5)`,
    [c.id, viewer.id, p.text, p.attachment?.kind === "post" ? p.attachment.id : null, p.attachment?.kind === "solution" ? p.attachment.id : null],
  );
  await q(`update conversations set last_message_at = now() where id = $1`, [c.id]);
  await q(
    `insert into conversation_reads (conversation_id, user_id, last_read_at) values ($1, $2, now())
     on conflict (conversation_id, user_id) do update set last_read_at = now()`,
    [c.id, viewer.id],
  );
  if (p.attachment?.kind === "post") await q(`insert into post_shares (post_id, user_id, channel) values ($1, $2, 'message')`, [p.attachment.id, viewer.id]);
  await notify(c.otherId, viewer.id, "message", { conversationId: c.id });
  return { messages: await listMessages(viewer, c.id) };
});
