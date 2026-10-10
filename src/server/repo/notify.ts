import "server-only";
import type { NotificationType } from "@/lib/types";
import { resolveSettings } from "@/lib/settings";
import { one, q } from "../db";

const PREF: Record<NotificationType, keyof ReturnType<typeof resolveSettings>["notify"] | null> = {
  support: "supports",
  supporter: "supports",
  response: "responses",
  solution: "solutions",
  status: "solutions",
  help: "help",
  message: "messages",
};

/** Creates a notification unless the recipient is the actor or opted out of that type. Never throws. */
export async function notify(
  recipientId: string | null | undefined,
  actorId: string,
  type: NotificationType,
  refs: { postId?: string; solutionId?: string; conversationId?: string } = {},
) {
  if (!recipientId || recipientId === actorId) return;
  try {
    const r = await one<{ settings: unknown }>(`select settings from profiles where user_id = $1`, [recipientId]);
    if (!r) return;
    const pref = PREF[type];
    if (pref && !resolveSettings(r.settings).notify[pref]) return;
    // Collapse repeats of the same event (e.g. support → unsupport → support).
    if (type === "message") {
      const unread = await one(`select 1 from notifications where user_id = $1 and conversation_id = $2 and read_at is null`, [recipientId, refs.conversationId ?? null]);
      if (unread) return;
    } else {
      const dup = await one(
        `select 1 from notifications where user_id = $1 and actor_id = $2 and type = $3
            and post_id is not distinct from $4 and solution_id is not distinct from $5 and created_at > now() - interval '1 day'`,
        [recipientId, actorId, type, refs.postId ?? null, refs.solutionId ?? null],
      );
      if (dup) return;
    }
    await q(
      `insert into notifications (user_id, actor_id, type, post_id, solution_id, conversation_id) values ($1, $2, $3, $4, $5, $6)`,
      [recipientId, actorId, type, refs.postId ?? null, refs.solutionId ?? null, refs.conversationId ?? null],
    );
  } catch (e) {
    console.error("[notify] failed", e);
  }
}
