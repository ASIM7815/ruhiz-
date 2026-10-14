import "server-only";
import type { ConversationSummary, Message } from "@/lib/types";
import { resolveSettings } from "@/lib/settings";
import { one, q } from "../db";
import { forbidden, notFound } from "../errors";
import { ms, toMember, userCols } from "../mappers";
import type { Viewer } from "../session";

export async function listConversations(viewer: Viewer): Promise<ConversationSummary[]> {
  const rows = await q(
    `select c.id, c.context, ${userCols("o", "o_")},
            lm.body as last_body, lm.sender_id as last_sender, lm.created_at as last_at,
            (select count(*)::int from messages m where m.conversation_id = c.id and m.sender_id <> $1
               and m.created_at > coalesce(r.last_read_at, '-infinity')) as unread
       from conversations c
       join profiles o on o.user_id = case when c.user_a = $1 then c.user_b else c.user_a end
       left join conversation_reads r on r.conversation_id = c.id and r.user_id = $1
       left join lateral (select body, sender_id, created_at from messages m where m.conversation_id = c.id order by created_at desc limit 1) lm on true
      where c.user_a = $1 or c.user_b = $1
      order by coalesce(c.last_message_at, c.created_at) desc limit 100`,
    [viewer.id],
  );
  return rows.map((r) => ({
    id: String(r.id),
    with: toMember(r, "o_"),
    context: (r.context as string) ?? null,
    lastMessage: r.last_body ? { text: String(r.last_body), fromMe: r.last_sender === viewer.id, at: ms(r.last_at) } : null,
    unread: Number(r.unread),
  }));
}

/** Loads a conversation only if the viewer is one of its two participants (prevents IDOR). */
export async function loadConversation(viewer: Viewer, id: string) {
  const c = await one<{ id: string; user_a: string; user_b: string; context: string | null }>(
    `select id, user_a, user_b, context from conversations where id = $1 and (user_a = $2 or user_b = $2)`,
    [id, viewer.id],
  );
  if (!c) throw notFound("Conversation not found.");
  return { ...c, otherId: c.user_a === viewer.id ? c.user_b : c.user_a };
}

export async function listMessages(viewer: Viewer, conversationId: string): Promise<Message[]> {
  const rows = await q(
    `select m.id, m.sender_id, m.body, m.created_at, m.attachment_post_id, m.attachment_solution_id,
            coalesce(p.title, left(p.body, 80)) as post_title, s.title as solution_title
       from messages m left join posts p on p.id = m.attachment_post_id left join solutions s on s.id = m.attachment_solution_id
      where m.conversation_id = $1 order by m.created_at desc limit 300`,
    [conversationId],
  );
  return rows.reverse().map((r) => ({
    id: String(r.id),
    fromMe: r.sender_id === viewer.id,
    text: String(r.body),
    at: ms(r.created_at),
    attachment: r.attachment_post_id
      ? { kind: "post", id: String(r.attachment_post_id), title: String(r.post_title ?? "Post") }
      : r.attachment_solution_id
        ? { kind: "solution", id: String(r.attachment_solution_id), title: String(r.solution_title ?? "Solution") }
        : null,
  }));
}

/** Enforces the recipient's "Who can message you" setting for new conversations. */
export async function assertCanMessage(senderId: string, recipientId: string, conversationId?: string) {
  if (conversationId) {
    const replied = await one(`select 1 from messages where conversation_id = $1 and sender_id = $2 limit 1`, [conversationId, recipientId]);
    if (replied) return;
  }
  const r = await one<{ settings: unknown }>(`select settings from profiles where user_id = $1`, [recipientId]);
  if (!r) throw notFound("That person isn't on RUHIZ anymore.");
  const pref = resolveSettings(r.settings).messagesFrom;
  if (pref === "none") throw forbidden("This person isn't accepting new messages.");
  if (pref === "supporters") {
    const ok = await one(`select 1 from user_supports where supporter_id = $1 and supported_id = $2`, [senderId, recipientId]);
    if (!ok) throw forbidden("This person only accepts messages from their Supporters. Support them first.");
  }
}
