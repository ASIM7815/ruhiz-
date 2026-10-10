import { body, code6, route } from "@/server/http";
import { one, q } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { openConversation } from "@/server/schemas";
import { userIdByCode } from "@/server/repo/profiles";
import { assertCanMessage, listConversations } from "@/server/repo/messages";
import { notify } from "@/server/repo/notify";

export const GET = route({}, async ({ viewer }) => listConversations(viewer));

/** Opens (or reuses) a 1:1 conversation with a user by code, optionally sending a first message. */
export const POST = route({ rateLimit: { key: "conversation", limit: 40, windowSec: 3600 } }, async ({ req, viewer }) => {
  const p = await body(req, openConversation);
  const code = code6.safeParse(p.code);
  if (!code.success) throw badRequest("Enter a valid 6-character code.");
  const other = await userIdByCode(code.data);
  if (!other) throw notFound(`No user with code #${code.data}.`);
  if (other === viewer.id) throw badRequest("You can't message yourself.");

  const [a, b] = viewer.id < other ? [viewer.id, other] : [other, viewer.id];
  let conv = await one<{ id: string }>(`select id from conversations where user_a = $1 and user_b = $2`, [a, b]);
  if (!conv) {
    await assertCanMessage(viewer.id, other);
    conv = (await q<{ id: string }>(
      `insert into conversations (user_a, user_b, context) values ($1, $2, $3)
       on conflict (user_a, user_b) do update set context = coalesce(conversations.context, excluded.context) returning id`,
      [a, b, p.context ?? null],
    ))[0];
  }
  if (p.text) {
    await assertCanMessage(viewer.id, other, conv.id);
    await q(`insert into messages (conversation_id, sender_id, body) values ($1, $2, $3)`, [conv.id, viewer.id, p.text]);
    await q(`update conversations set last_message_at = now(), context = coalesce(context, $2) where id = $1`, [conv.id, p.context ?? null]);
    await notify(other, viewer.id, "message", { conversationId: conv.id });
  }
  return { id: conv.id };
});
