import { route } from "@/server/http";
import { one } from "@/server/db";

/** Lightweight badge counts, polled by the shell. */
export const GET = route({}, async ({ viewer }) => {
  const r = await one<{ notifications: number; messages: number }>(
    `select (select count(*)::int from notifications where user_id = $1 and read_at is null) as notifications,
            (select count(*)::int from conversations c
              where (c.user_a = $1 or c.user_b = $1)
                and exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id <> $1
                              and m.created_at > coalesce((select last_read_at from conversation_reads r where r.conversation_id = c.id and r.user_id = $1), '-infinity'))
            ) as messages`,
    [viewer.id],
  );
  return r ?? { notifications: 0, messages: 0 };
});
